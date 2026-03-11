import { ICellRegistry, ILayoutEngine, IMergeRegistry, IStructureStore, ITable } from "../interfaces"
import { ICell } from "../interfaces/core"
import { IRuleEngine } from "../interfaces/rules/rule-engine.interface"
import { EvaluationResult } from "../rules/types/evaluation.types"
import { CellPayload, CellStyle, Region, TableSettings, TableStyle, RegionStyle, BodyRegionStyle, RegionStyleMap, UIState } from "../types"
import { Rect } from "../types/common"
import type { SerializedHeaderNode, SerializedBodyCell, TableExportData } from "../renderers/types/serialization.types"
import { StructureStore } from "../stores/structure.store"
import { CellRegistry } from "../stores/cell-registry.store"
import { MergeRegistry } from "../stores/merge-registry.stores"
import { LayoutEngine } from "../engines/layout.engine"
import { OverflowEngine } from "../engines/overflow.engine"
import { RuleRegistry } from "../rules/rule-registry"
import { RuleEngine } from "../rules/rule-engine"
import { defaultTableStyle } from "../styles/defaults"
import { resolveStyle } from "../styles/resolve"
import type {
    RenderableCell,
    RenderableRow,
    RenderableColumn,
    RenderableMerge,
    RenderableTableInstance,
} from "../renderers/types/renderable-types"

const DEFAULT_TABLE_SETTINGS: TableSettings = {
    overflow: 'increase-height',
    footer: { mode: 'last-page' },
    headerVisibility: { theader: true, lheader: true, rheader: true },
    showGridLines: true,
    defaultCellWidth: 30,
    defaultCellHeight: 10,
}

export class Table implements ITable {
    private structureStore: IStructureStore
    private cellRegistry: ICellRegistry
    private layoutEngine: ILayoutEngine
    private mergeRegistry: IMergeRegistry
    private overflowEngine: OverflowEngine
    private settings: TableSettings
    private ruleEngine: IRuleEngine
    private _tableStyle: TableStyle
    private _regionStyles: RegionStyleMap
    private _overflowStylePatches: Map<string, Partial<CellStyle>> = new Map()

    // Available space for the table (set from page boundaries)
    private _availableWidth: number = Infinity
    private _availableHeight: number = Infinity

    // Transient UI state (not serialized)
    private _uiState: { editingCellId: string | null; selectedCells: Set<string>; selectionAnchor: { row: number; col: number; region: string } | null; mergeMode: 'none' | 'selecting' | 'unmerging' } = {
        editingCellId: null,
        selectedCells: new Set(),
        selectionAnchor: null,
        mergeMode: 'none',
    }

    constructor(
        structureStore: IStructureStore,
        cellRegistry: ICellRegistry,
        layoutEngine: ILayoutEngine,
        mergeRegistry: IMergeRegistry,
        ruleEngine: IRuleEngine,
        settings?: TableSettings,
        tableStyle?: TableStyle,
        regionStyles?: RegionStyleMap,
    ) {
        this.structureStore = structureStore
        this.cellRegistry = cellRegistry
        this.layoutEngine = layoutEngine
        this.mergeRegistry = mergeRegistry
        this.overflowEngine = new OverflowEngine(cellRegistry, structureStore, layoutEngine)
        this.ruleEngine = ruleEngine
        this.settings = { ...DEFAULT_TABLE_SETTINGS, ...settings }
        this._tableStyle = { ...defaultTableStyle, ...tableStyle }
        this._regionStyles = regionStyles ? { ...regionStyles } : {}

        // Sync default cell dimensions from settings to layout engine
        if (this.settings.defaultCellWidth !== undefined) {
            this.layoutEngine.setDefaultCellWidth(this.settings.defaultCellWidth)
        }
        if (this.settings.defaultCellHeight !== undefined) {
            this.layoutEngine.setDefaultCellHeight(this.settings.defaultCellHeight)
        }
    }

    getEvaluationResult(cellId: string): EvaluationResult | undefined {
        return this.ruleEngine?.getResult(cellId)
    }

    getOverflowStylePatch(cellId: string): Partial<CellStyle> | undefined {
        return this._overflowStylePatches.get(cellId)
    }

    private rebuildAndEvaluate(): void {
        this.ensureMinRows()
        this.ensureMaxRows()
        this.ensureMinCols()
        this.ensureMaxCols()
        this.layoutEngine.rebuild()
        this.applyOverflowConstraints()
        this.ruleEngine?.evaluateAll()
        this.applyRuleResults()
    }

    private rebuildGeometryAndEvaluate(): void {
        this.layoutEngine.rebuildGeometry()
        this.applyOverflowConstraints()
        this.ruleEngine?.evaluateAll()
        this.applyRuleResults()
    }

    private applyOverflowConstraints(): void {
        const mode = this.settings.overflow ?? 'wrap'
        this._overflowStylePatches.clear()
        if (mode === 'wrap') {
            this.overflowEngine.applyWrap(this._regionStyles, this._overflowStylePatches)
        } else {
            this.overflowEngine.apply(mode, this._regionStyles)
        }
    }

    private applyRuleResults(): void {
        if (!this.ruleEngine) return

        let geometryChanged = false
        for (const [cellId, result] of this.ruleEngine.getAllResults()) {
            // Apply computedValue back to cell
            if (result.computedValue !== undefined) {
                this.cellRegistry.updateCell(cellId, { computedValue: result.computedValue })
            }

            // Apply deltaInstructions to layout engine
            for (const delta of result.deltaInstructions) {
                if (delta.type === 'row-height-min') {
                    const currentHeights = this.layoutEngine.getRowHeights()
                    if (delta.rowIndex < currentHeights.length && currentHeights[delta.rowIndex] < delta.minHeight) {
                        this.layoutEngine.setRowHeight(delta.rowIndex, delta.minHeight)
                        geometryChanged = true
                    }
                } else if (delta.type === 'col-width-min') {
                    const currentWidths = this.layoutEngine.getColumnWidths()
                    if (delta.colIndex < currentWidths.length && currentWidths[delta.colIndex] < delta.minWidth) {
                        this.layoutEngine.setColumnWidth(delta.colIndex, delta.minWidth)
                        geometryChanged = true
                    }
                }
            }
        }

        // Re-apply geometry if any dimensions changed
        if (geometryChanged) {
            this.layoutEngine.rebuildGeometry()
        }
    }

    // --- Settings (logical config) ---

    getSettings(): TableSettings {
        return { ...this.settings }
    }

    updateSettings(patch: Partial<TableSettings>): string | null {
        const merged = { ...this.settings, ...patch }
        const error = this.validateConstraints(patch, merged)
        if (error) return error

        const overflowChanged = patch.overflow !== undefined && patch.overflow !== this.settings.overflow
        this.settings = merged

        if (patch.defaultCellWidth !== undefined) {
            this.layoutEngine.setDefaultCellWidth(patch.defaultCellWidth)
        }
        if (patch.defaultCellHeight !== undefined) {
            this.layoutEngine.setDefaultCellHeight(patch.defaultCellHeight)
        }
        if (overflowChanged) {
            this.resetDimensionsToDefaults()
        }
        this.rebuildAndEvaluate()
        return null
    }

    private validateConstraints(
        patch: Partial<TableSettings>,
        merged: TableSettings,
    ): string | null {
        // Row constraints
        const { minRows, maxRows } = merged
        if (minRows !== undefined && maxRows !== undefined && minRows > maxRows) {
            if (patch.minRows !== undefined) {
                return `Min Rows (${minRows}) cannot exceed Max Rows (${maxRows})`
            }
            if (patch.maxRows !== undefined) {
                return `Max Rows (${maxRows}) cannot be less than Min Rows (${minRows})`
            }
        }
        // Col constraints
        const { minCols, maxCols } = merged
        if (minCols !== undefined && maxCols !== undefined && minCols > maxCols) {
            if (patch.minCols !== undefined) {
                return `Min Cols (${minCols}) cannot exceed Max Cols (${maxCols})`
            }
            if (patch.maxCols !== undefined) {
                return `Max Cols (${maxCols}) cannot be less than Min Cols (${minCols})`
            }
        }
        return null
    }

    private resetDimensionsToDefaults(): void {
        const defaultW = this.layoutEngine.getDefaultCellWidth()
        const defaultH = this.layoutEngine.getDefaultCellHeight()
        const colWidths = this.layoutEngine.getColumnWidths()
        const rowHeights = this.layoutEngine.getRowHeights()
        for (let i = 0; i < colWidths.length; i++) {
            this.layoutEngine.setColumnWidth(i, defaultW)
        }
        for (let i = 0; i < rowHeights.length; i++) {
            this.layoutEngine.setRowHeight(i, defaultH)
        }
        const footerColWidths = this.layoutEngine.getFooterColumnWidths()
        const footerRowHeights = this.layoutEngine.getFooterRowHeights()
        for (let i = 0; i < footerColWidths.length; i++) {
            this.layoutEngine.setFooterColumnWidth(i, defaultW)
        }
        for (let i = 0; i < footerRowHeights.length; i++) {
            this.layoutEngine.setFooterRowHeight(i, defaultH)
        }
    }

    // --- Styles ---

    getTableStyle(): TableStyle {
        return { ...this._tableStyle }
    }

    setTableStyle(patch: Partial<TableStyle>): void {
        this._tableStyle = { ...this._tableStyle, ...patch }
    }

    getRegionStyles(): RegionStyleMap {
        return { ...this._regionStyles }
    }

    getRegionStyle(region: Region): RegionStyle | BodyRegionStyle | undefined {
        return this._regionStyles[region]
    }

    setRegionStyle(region: Region, style: RegionStyle | BodyRegionStyle): void {
        this._regionStyles = { ...this._regionStyles, [region]: style }
    }

    // --- Available space (page boundary constraints) ---

    setAvailableSpace(width: number, height: number): void {
        this._availableWidth = width
        this._availableHeight = height
    }

    getAvailableSpace(): { width: number; height: number } {
        return { width: this._availableWidth, height: this._availableHeight }
    }

    /** Sum of all main-grid column widths */
    private getMainGridWidth(): number {
        return this.layoutEngine.getColumnWidths().reduce((s, w) => s + w, 0)
    }

    /** Sum of all main-grid row heights + footer row heights */
    private getTotalHeight(): number {
        const mainH = this.layoutEngine.getRowHeights().reduce((s, h) => s + h, 0)
        const footerH = this.layoutEngine.getFooterRowHeights().reduce((s, h) => s + h, 0)
        return mainH + footerH
    }

    /** Sum of all footer column widths */
    private getFooterGridWidth(): number {
        return this.layoutEngine.getFooterColumnWidths().reduce((s, w) => s + w, 0)
    }

    /** Current total width (max of main grid and footer) */
    getTotalWidth(): number {
        return Math.max(this.getMainGridWidth(), this.getFooterGridWidth())
    }

    /** Check if adding a new column would exceed available width */
    wouldExceedWidth(extraWidth?: number): boolean {
        const extra = extraWidth ?? this.layoutEngine.getDefaultCellWidth()
        return this.getMainGridWidth() + extra > this._availableWidth
    }

    /** Check if adding a new row would exceed available height */
    wouldExceedHeight(extraHeight?: number): boolean {
        const extra = extraHeight ?? this.layoutEngine.getDefaultCellHeight()
        return this.getTotalHeight() + extra > this._availableHeight
    }

    // --- Header operations ---

    addHeaderCell(region: Region, parentId?: string, index?: number): string | 'exceeds-bounds' {
        // Boundary check: theader adds a column (width), lheader/rheader adds a row (height)
        if (region === 'theader' && !parentId && this.wouldExceedWidth()) return 'exceeds-bounds'
        if ((region === 'lheader' || region === 'rheader') && !parentId && this.wouldExceedHeight()) return 'exceeds-bounds'

        const cellId = this.cellRegistry.createCell(region)

        if (parentId) {
            const wasLeaf = this.structureStore.isLeafCell(parentId)
            this.structureStore.addChildCell(parentId, region, cellId, index)
            if (!wasLeaf) {
                const newLeafIndex = this.structureStore.getBodyIndexForHeaderLeafCell(region, cellId)
                this.insertBodySliceForRegion(region, newLeafIndex)
            }
        } else {
            const leafIndex = this.structureStore.getLeafCount(region)
            this.structureStore.addRootCell(cellId, region)
            this.insertBodySliceForRegion(region, leafIndex)
        }

        this.rebuildAndEvaluate()
        return cellId
    }

    removeHeaderCell(cellId: string, region: Region, isRoot: boolean, parentId?: string): void {
        const isLeaf = this.structureStore.isLeafCell(cellId)
        const bodyIndex = this.structureStore.getBodyIndexForHeaderLeafCell(region, cellId)

        if (isRoot) {
            this.structureStore.removeRootCell(cellId, region)
        } else if (parentId) {
            this.structureStore.removeChildCell(parentId, cellId, region)
        }

        if (isLeaf) {
            this.removeBodySliceForRegion(region, bodyIndex)
        }

        this.cellRegistry.deleteCell(cellId)
        this.rebuildAndEvaluate()
    }

    // --- Body slice helpers ---

    private insertBodySliceForRegion(region: Region, index: number): void {
        if (region === "theader") this.insertBodyCol(index)
        else if (region === "lheader" || region === "rheader") this.insertBodyRow(index)
    }

    private removeBodySliceForRegion(region: Region, index: number): void {
        if (region === "theader") this.removeBodyCol(index)
        else if (region === "lheader" || region === "rheader") this.removeBodyRow(index)
    }

    // --- Body operations ---

    buildBody(data: (string | number)[][]): void {
        while (this.structureStore.getBody().length > 0) {
            this.removeBodyRow(0)
        }
        for (let i = 0; i < data.length; i++) {
            this.insertBodyRow(i, data[i])
        }
        // pad with empty rows up to minRows
        const minRows = this.settings.minRows
        if (minRows !== undefined) {
            while (this.structureStore.getBody().length < minRows) {
                this.insertBodyRow(this.structureStore.getBody().length)
            }
        }
    }

    insertBodyRow(rowIndex: number, data?: (string | number)[]): 'added' | 'max-reached' | 'exceeds-bounds' {
        const effectiveMax = this.getEffectiveMaxRows()
        if (effectiveMax !== undefined &&
            this.structureStore.getBody().length >= effectiveMax) return 'max-reached'
        if (this.wouldExceedHeight()) return 'exceeds-bounds'

        const numCols = this.structureStore.getBody().length > 0
            ? this.structureStore.getBody()[0].length
            : this.structureStore.getLeafCount("theader")
        const cellIds: string[] = []
        for (let i = 0; i < numCols; i++) {
            // If data is shorter, use undefined (createCell will use default "Cell"); if longer, trim to numCols
            const value = data?.[i]?.toString()
            cellIds.push(this.cellRegistry.createCell("body", value))
        }
        this.structureStore.insertBodyRow(rowIndex, cellIds)
        this.layoutEngine.insertRowHeight(rowIndex, this.layoutEngine.getDefaultCellHeight())
        this.rebuildAndEvaluate()
        return 'added'
    }

    removeBodyRow(rowIndex: number): 'removed' | 'cleared' {
        if (this.settings.minRows !== undefined &&
            this.structureStore.getBody().length <= this.settings.minRows) {
            const row = this.structureStore.getBody()[rowIndex]
            if (row) {
                for (const cellId of row) {
                    this.cellRegistry.updateCell(cellId, { rawValue: "", computedValue: undefined })
                }
            }
            this.rebuildAndEvaluate()
            return 'cleared'
        }

        const removedIds = this.structureStore.removeBodyRow(rowIndex)
        for (const id of removedIds) this.cellRegistry.deleteCell(id)
        this.layoutEngine.removeRowHeight(rowIndex)
        this.rebuildAndEvaluate()
        return 'removed'
    }

    private ensureMinRows(): void {
        const minRows = this.settings.minRows
        if (minRows === undefined) return
        const body = this.structureStore.getBody()
        const numCols = body.length > 0
            ? body[0].length
            : this.structureStore.getLeafCount("theader")
        while (this.structureStore.getBody().length < minRows) {
            const cellIds: string[] = []
            for (let i = 0; i < numCols; i++) {
                cellIds.push(this.cellRegistry.createCell("body", ""))
            }
            const idx = this.structureStore.getBody().length
            this.structureStore.insertBodyRow(idx, cellIds)
            this.layoutEngine.insertRowHeight(idx, this.layoutEngine.getDefaultCellHeight())
        }
    }

    private getEffectiveMaxRows(): number | undefined {
        const { maxRows, minRows } = this.settings
        if (maxRows === undefined && minRows === undefined) return undefined
        if (maxRows === undefined) return undefined
        if (minRows === undefined) return maxRows
        return Math.max(maxRows, minRows)
    }

    private ensureMaxRows(): void {
        const maxRows = this.getEffectiveMaxRows()
        if (maxRows === undefined) return
        while (this.structureStore.getBody().length > maxRows) {
            const lastIdx = this.structureStore.getBody().length - 1
            const removedIds = this.structureStore.removeBodyRow(lastIdx)
            for (const id of removedIds) this.cellRegistry.deleteCell(id)
            this.layoutEngine.removeRowHeight(lastIdx)
        }
    }

    insertBodyCol(colIndex: number, data?: (string | number)[]): 'added' | 'max-reached' | 'exceeds-bounds' {
        const effectiveMax = this.getEffectiveMaxCols()
        if (effectiveMax !== undefined &&
            (this.structureStore.getBody()[0]?.length ?? 0) >= effectiveMax) return 'max-reached'
        if (this.wouldExceedWidth()) return 'exceeds-bounds'

        const numRows = this.structureStore.getBody().length
        const cellIds: string[] = []
        for (let i = 0; i < numRows; i++) {
            cellIds.push(this.cellRegistry.createCell("body", data?.[i]?.toString()))
        }
        this.structureStore.insertBodyCol(colIndex, cellIds)
        this.layoutEngine.insertColumnWidth(colIndex, this.layoutEngine.getDefaultCellWidth())
        this.rebuildAndEvaluate()
        return 'added'
    }

    removeBodyCol(colIndex: number): 'removed' | 'cleared' {
        if (this.settings.minCols !== undefined &&
            (this.structureStore.getBody()[0]?.length ?? 0) <= this.settings.minCols) {
            // Clear column cells instead of removing
            const body = this.structureStore.getBody()
            for (const row of body) {
                if (colIndex < row.length) {
                    this.cellRegistry.updateCell(row[colIndex], { rawValue: "", computedValue: undefined })
                }
            }
            this.rebuildAndEvaluate()
            return 'cleared'
        }

        const removedIds = this.structureStore.removeBodyCol(colIndex)
        for (const id of removedIds) this.cellRegistry.deleteCell(id)
        this.layoutEngine.removeColumnWidth(colIndex)
        this.rebuildAndEvaluate()
        return 'removed'
    }

    private getEffectiveMaxCols(): number | undefined {
        const { maxCols, minCols } = this.settings
        if (maxCols === undefined) return undefined
        if (minCols === undefined) return maxCols
        return Math.max(maxCols, minCols)
    }

    private ensureMinCols(): void {
        const minCols = this.settings.minCols
        if (minCols === undefined) return
        const body = this.structureStore.getBody()
        const currentCols = body.length > 0 ? body[0].length : 0
        for (let c = currentCols; c < minCols; c++) {
            const cellIds: string[] = []
            for (let r = 0; r < body.length; r++) {
                cellIds.push(this.cellRegistry.createCell("body", ""))
            }
            this.structureStore.insertBodyCol(c, cellIds)
            this.layoutEngine.insertColumnWidth(c, this.layoutEngine.getDefaultCellWidth())
        }
    }

    private ensureMaxCols(): void {
        const maxCols = this.getEffectiveMaxCols()
        if (maxCols === undefined) return
        while ((this.structureStore.getBody()[0]?.length ?? 0) > maxCols) {
            const lastIdx = this.structureStore.getBody()[0].length - 1
            const removedIds = this.structureStore.removeBodyCol(lastIdx)
            for (const id of removedIds) this.cellRegistry.deleteCell(id)
            this.layoutEngine.removeColumnWidth(lastIdx)
        }
    }

    // --- Cell access ---

    getCellById(cellId: string): ICell | undefined {
        return this.cellRegistry.getCellById(cellId)
    }

    getCellByAddress(row: number, col: number): ICell | undefined {
        return this.cellRegistry.getCellByAddress(`${row},${col}`)
    }

    updateCell(cellId: string, payload: CellPayload): void {
        this.cellRegistry.updateCell(cellId, payload)
        this.applyOverflowConstraints()
        if (this.ruleEngine) {
            const cell = this.cellRegistry.getCellById(cellId)
            if (cell) this.ruleEngine.evaluateCell(cell)
            this.applyRuleResults()
        }
    }

    // --- Merge ---

    mergeCells(rect: Rect): void {
        this.mergeRegistry.createMerge(rect)
        this.rebuildAndEvaluate()
    }

    unmergeCells(cellId: string): void {
        this.mergeRegistry.deleteMerge(cellId)
        this.rebuildAndEvaluate()
    }

    getMerges(): Map<string, Rect> {
        return this.mergeRegistry.getMergeSet()
    }

    // --- Geometry ---

    setColumnWidth(colIndex: number, width: number): void {
        this.layoutEngine.setColumnWidth(colIndex, width)
        this.rebuildGeometryAndEvaluate()
    }

    setRowHeight(rowIndex: number, height: number): void {
        this.layoutEngine.setRowHeight(rowIndex, height)
        this.rebuildGeometryAndEvaluate()
    }

    setDefaultCellWidth(width: number): void {
        this.layoutEngine.setDefaultCellWidth(width)
    }

    setDefaultCellHeight(height: number): void {
        this.layoutEngine.setDefaultCellHeight(height)
    }

    getColumnWidths(): number[] {
        return this.layoutEngine.getColumnWidths()
    }

    getRowHeights(): number[] {
        return this.layoutEngine.getRowHeights()
    }

    // --- Footer Geometry (independent) ---

    setFooterColumnWidth(colIndex: number, width: number): void {
        this.layoutEngine.setFooterColumnWidth(colIndex, width)
        this.rebuildGeometryAndEvaluate()
    }

    setFooterRowHeight(rowIndex: number, height: number): void {
        this.layoutEngine.setFooterRowHeight(rowIndex, height)
        this.rebuildGeometryAndEvaluate()
    }

    getFooterColumnWidths(): number[] {
        return this.layoutEngine.getFooterColumnWidths()
    }

    getFooterRowHeights(): number[] {
        return this.layoutEngine.getFooterRowHeights()
    }

    setTablePosition(position: { x: number; y: number }): void {
        this.layoutEngine.setTablePosition(position)
    }

    getTablePosition(): { x: number; y: number } {
        return this.layoutEngine.getTablePosition()
    }

    // --- Layout ---

    getCompleteGrid(): string[][] {
        return this.layoutEngine.getCompleteGrid()
    }

    // --- UI State (transient, not serialized) ---

    getUIState(): UIState {
        return {
            editingCellId: this._uiState.editingCellId,
            selectedCells: this._uiState.selectedCells,
            selectionAnchor: this._uiState.selectionAnchor,
            mergeMode: this._uiState.mergeMode,
        }
    }

    startEditing(cellId: string): void {
        this._uiState.editingCellId = cellId
    }

    stopEditing(): void {
        this._uiState.editingCellId = null
    }

    selectCell(cellId: string): void {
        this._uiState.selectedCells.clear()
        this._uiState.selectedCells.add(cellId)
    }

    selectCells(cellIds: string[]): void {
        this._uiState.selectedCells.clear()
        for (const id of cellIds) this._uiState.selectedCells.add(id)
    }

    setSelectionAnchor(anchor: { row: number; col: number; region: string } | null): void {
        this._uiState.selectionAnchor = anchor
    }

    clearSelection(): void {
        this._uiState.selectedCells.clear()
        this._uiState.selectionAnchor = null
    }

    resetUIState(): void {
        this._uiState.editingCellId = null
        this._uiState.selectedCells.clear()
        this._uiState.selectionAnchor = null
        this._uiState.mergeMode = 'none'
    }

    setMergeMode(mode: 'none' | 'selecting' | 'unmerging'): void {
        this._uiState.mergeMode = mode
        if (mode !== 'none') {
            this._uiState.editingCellId = null
            this._uiState.selectedCells.clear()
            this._uiState.selectionAnchor = null
        }
    }

    toggleMergeSelection(cellId: string): void {
        if (this._uiState.selectedCells.has(cellId)) {
            this._uiState.selectedCells.delete(cellId)
        } else {
            this._uiState.selectedCells.add(cellId)
        }
    }

    // --- Render Snapshot ---

    getRenderSnapshot(): RenderableTableInstance {
        const settings = this.getSettings()
        const tableStyle = this.getTableStyle()
        const regionStyles = this.getRegionStyles()
        const columnWidths = this.getColumnWidths()
        const rowHeights = this.getRowHeights()
        const footerColumnWidths = this.getFooterColumnWidths()
        const footerRowHeights = this.getFooterRowHeights()
        const uiState = this.getUIState()

        const cellsById = new Map<string, RenderableCell>()
        const evaluationResults = new Map<string, any>()

        const regions: Record<Region, RenderableRow[]> = {
            theader: [], lheader: [], rheader: [], footer: [], body: [],
        }

        const rowIndexByRegion: Record<Region, number> = {
            theader: 0, lheader: 0, rheader: 0, footer: 0, body: 0,
        }

        // Helper to build a RenderableCell from a cell interface
        const buildRenderableCell = (cell: ICell): RenderableCell => {
            const evalResult = cell.isDynamic ? this.getEvaluationResult(cell.cellID) : undefined
            if (evalResult) evaluationResults.set(cell.cellID, evalResult)

            const regionStyle = regionStyles[cell.inRegion]
            const overflowPatch = this.getOverflowStylePatch(cell.cellID)
            const resolvedStyle = resolveStyle(regionStyle, cell.styleOverrides, overflowPatch)

            return {
                cellID: cell.cellID,
                rawValue: cell.rawValue,
                computedValue: cell.computedValue,
                layout: cell.layout!,
                style: resolvedStyle,
                inRegion: cell.inRegion,
                evaluationResult: evalResult,
                isDynamic: cell.isDynamic,
                mergeRect: undefined,
            }
        }

        // Main grid: theader + lheader + rheader + body (NOT footer)
        const mainRegionList: Region[] = ['theader', 'lheader', 'rheader', 'body']

        for (let rowIdx = 0; rowIdx < rowHeights.length; rowIdx++) {
            const rowCellsByRegion: Record<string, RenderableCell[]> = {
                theader: [], lheader: [], rheader: [], body: [],
            }

            for (let colIdx = 0; colIdx < columnWidths.length; colIdx++) {
                const cell = this.getCellByAddress(rowIdx, colIdx)
                if (cell) {
                    const renderableCell = buildRenderableCell(cell)
                    cellsById.set(cell.cellID, renderableCell)
                    if (rowCellsByRegion[cell.inRegion]) {
                        rowCellsByRegion[cell.inRegion].push(renderableCell)
                    }
                }
            }

            // Apply alternating background color for odd body rows
            const bodyAltBg = (regionStyles.body as BodyRegionStyle | undefined)?.alternateBackgroundColor
            if (bodyAltBg && rowCellsByRegion['body'].length > 0 && rowIndexByRegion['body'] % 2 === 1) {
                for (const rc of rowCellsByRegion['body']) {
                    if (!this.cellRegistry.getCellById(rc.cellID)?.styleOverrides?.backgroundColor) {
                        rc.style = { ...rc.style, backgroundColor: bodyAltBg }
                    }
                }
            }

            for (const region of mainRegionList) {
                if (rowCellsByRegion[region].length > 0) {
                    const cells = new Map<number, RenderableCell>()
                    const rawValues: (string | number)[] = []
                    let colIdx = 0
                    for (const c of rowCellsByRegion[region]) {
                        cells.set(colIdx, c)
                        rawValues.push(c.rawValue)
                        colIdx++
                    }
                    regions[region].push({
                        rowIndex: rowIndexByRegion[region],
                        globalRowIndex: rowIdx,
                        region,
                        height: rowHeights[rowIdx] || 20,
                        cells,
                        rawValues,
                    })
                    rowIndexByRegion[region]++
                }
            }
        }

        // Footer region: walk footer tree independently
        // Footer cells use global coords; map to local row indices for dimension lookup
        const footerRowStart = rowHeights.length  // = thD + bodyRows
        const footerCellsByLocalRow = new Map<number, ICell[]>()
        const walkFooterTree = (cellId: string) => {
            const cell = this.getCellById(cellId)
            if (cell?.layout && cell.layout.rowSpan > 0 && cell.layout.colSpan > 0) {
                const localRow = cell.layout.row - footerRowStart
                if (!footerCellsByLocalRow.has(localRow)) footerCellsByLocalRow.set(localRow, [])
                footerCellsByLocalRow.get(localRow)!.push(cell)
            }
            const children = this.structureStore.getChildren(cellId)
            if (children) {
                for (const child of children) walkFooterTree(child)
            }
        }
        const footerRoots = this.structureStore.getRoots('footer')
        if (footerRoots) {
            for (const root of footerRoots) walkFooterTree(root)
        }

        const sortedFooterRows = [...footerCellsByLocalRow.keys()].sort((a, b) => a - b)
        for (const localRowIdx of sortedFooterRows) {
            const rowCells = footerCellsByLocalRow.get(localRowIdx)!
            rowCells.sort((a, b) => a.layout!.col - b.layout!.col)
            const cells = new Map<number, RenderableCell>()
            const rawValues: (string | number)[] = []
            let colIdx = 0
            for (const cell of rowCells) {
                const renderableCell = buildRenderableCell(cell)
                cellsById.set(cell.cellID, renderableCell)
                cells.set(colIdx, renderableCell)
                rawValues.push(cell.rawValue)
                colIdx++
            }
            regions.footer.push({
                rowIndex: localRowIdx,
                globalRowIndex: localRowIdx,
                region: 'footer',
                height: footerRowHeights[localRowIdx] || this.layoutEngine.getDefaultCellHeight(),
                cells,
                rawValues,
            })
        }

        const columns: RenderableColumn[] = columnWidths.map((width, idx) => ({
            colIndex: idx,
            width,
        }))

        const footerColumns: RenderableColumn[] = footerColumnWidths.map((width, idx) => ({
            colIndex: idx,
            width,
        }))

        const mergeSet = this.getMerges()
        const merges: RenderableMerge[] = Array.from(mergeSet.values()).map((rect) => ({
            cellID: rect.cellId,
            startRow: rect.startRow,
            startCol: rect.startCol,
            endRow: rect.endRow,
            endCol: rect.endCol,
            primaryRegion: rect.primaryRegion || 'body',
        }))

        const getHeadHeight = (): number =>
            (regions.theader.reduce((s, r) => s + r.height, 0)) +
            (regions.lheader.reduce((s, r) => s + r.height, 0)) +
            (regions.rheader.reduce((s, r) => s + r.height, 0))

        const getBodyHeight = (): number =>
            regions.body.reduce((s, r) => s + r.height, 0)

        const getFooterHeight = (): number =>
            regions.footer.reduce((s, r) => s + r.height, 0)

        const getMainWidth = (): number =>
            columns.reduce((s, c) => s + c.width, 0)

        const getFooterWidth = (): number =>
            footerColumns.reduce((s, c) => s + c.width, 0)

        return {
            settings,
            tableStyle,
            regionStyles,
            columns,
            footerColumns,
            regions,
            cellsById,
            merges,
            evaluationResults,
            editingCellId: uiState.editingCellId,
            selectedCellIds: uiState.selectedCells,
            mergeMode: uiState.mergeMode,
            getCellAt(row, col, region) { return this.regions[region][row]?.cells.get(col) },
            getCellByID(cellID) { return this.cellsById.get(cellID) },
            getRowsInRegion(region) { return this.regions[region] },
            getWidth() { return Math.max(getMainWidth(), getFooterWidth()) },
            getHeight() { return getHeadHeight() + getBodyHeight() + getFooterHeight() },
            getHeadHeight() { return getHeadHeight() },
            getBodyHeight() { return getBodyHeight() },
            getFooterHeight() { return getFooterHeight() },
        }
    }

    // --- Aliases ---

    toJSON(): string {
        return JSON.stringify(this.exportState())
    }

    static fromJSON(json: string): Table {
        return Table.fromExportData(JSON.parse(json))
    }

    // --- Serialization ---

    exportState(): TableExportData {
        const headerRegions: Region[] = ['theader', 'lheader', 'rheader', 'footer']
        const headerTrees = {} as Record<Region, SerializedHeaderNode[]>

        for (const region of headerRegions) {
            const roots = this.structureStore.getRoots(region)
            headerTrees[region] = roots
                ? roots.map(rootId => this.serializeHeaderNode(rootId))
                : []
        }
        // body region has no header tree
        headerTrees['body'] = []

        const bodyGrid = this.structureStore.getBody()
        const body: SerializedBodyCell[][] = bodyGrid.map(row =>
            row.map(cellId => {
                const cell = this.cellRegistry.getCellById(cellId)!
                return {
                    cellId: cell.cellID,
                    rawValue: cell.rawValue,
                    style: { ...cell.styleOverrides },
                    isDynamic: cell.isDynamic,
                    computedValue: cell.computedValue,
                }
            })
        )

        const mergeSet = this.mergeRegistry.getMergeSet()
        const merges: Rect[] = [...mergeSet.values()]

        const rules = this.ruleEngine?.exportRules() ?? []

        return {
            headerTrees,
            body,
            merges,
            settings: { ...this.settings },
            tableStyle: { ...this._tableStyle },
            regionStyles: { ...this._regionStyles },
            columnWidths: [...this.layoutEngine.getColumnWidths()],
            rowHeights: [...this.layoutEngine.getRowHeights()],
            footerColumnWidths: [...this.layoutEngine.getFooterColumnWidths()],
            footerRowHeights: [...this.layoutEngine.getFooterRowHeights()],
            rules,
        }
    }

    private serializeHeaderNode(cellId: string): SerializedHeaderNode {
        const cell = this.cellRegistry.getCellById(cellId)!
        const children = this.structureStore.getChildren(cellId) ?? []
        return {
            cellId: cell.cellID,
            rawValue: cell.rawValue,
            style: { ...cell.styleOverrides },
            isDynamic: cell.isDynamic,
            computedValue: cell.computedValue,
            children: children.map(childId => this.serializeHeaderNode(childId)),
        }
    }

    /**
     * Reconstruct a Table from exported data.
     * Creates fresh stores, restores all cells with original IDs,
     * rebuilds header trees, body grid, merges, geometry, and rules.
     */
    static fromExportData(data: TableExportData): Table {
        const structureStore = new StructureStore()
        const cellRegistry = new CellRegistry()
        const mergeRegistry = new MergeRegistry(structureStore)
        const layoutEngine = new LayoutEngine(mergeRegistry, structureStore, cellRegistry)
        const ruleRegistry = new RuleRegistry()

        // Restore header trees
        const headerRegions: Region[] = ['theader', 'lheader', 'rheader', 'footer']
        for (const region of headerRegions) {
            const trees = data.headerTrees[region] ?? []
            for (const node of trees) {
                Table.restoreHeaderNode(node, region, cellRegistry, structureStore, undefined)
            }
        }

        // Restore body grid
        for (let rowIdx = 0; rowIdx < data.body.length; rowIdx++) {
            const row = data.body[rowIdx]
            const cellIds: string[] = []
            for (const cellData of row) {
                cellRegistry.createCellWithId(
                    cellData.cellId,
                    'body',
                    cellData.rawValue?.toString(),
                    cellData.style,
                    cellData.isDynamic,
                    cellData.computedValue,
                )
                cellIds.push(cellData.cellId)
            }
            structureStore.insertBodyRow(rowIdx, cellIds)
        }

        // Restore geometry (default dimensions now live in settings)
        layoutEngine.setDefaultCellWidth(data.settings.defaultCellWidth ?? 30)
        layoutEngine.setDefaultCellHeight(data.settings.defaultCellHeight ?? 10)
        for (let i = 0; i < data.columnWidths.length; i++) {
            if (i < layoutEngine.getColumnWidths().length) {
                layoutEngine.setColumnWidth(i, data.columnWidths[i])
            } else {
                layoutEngine.insertColumnWidth(i, data.columnWidths[i])
            }
        }
        for (let i = 0; i < data.rowHeights.length; i++) {
            if (i < layoutEngine.getRowHeights().length) {
                layoutEngine.setRowHeight(i, data.rowHeights[i])
            } else {
                layoutEngine.insertRowHeight(i, data.rowHeights[i])
            }
        }

        // Restore footer dimensions (independent from main grid)
        const footerColWidths = data.footerColumnWidths ?? []
        for (let i = 0; i < footerColWidths.length; i++) {
            if (i < layoutEngine.getFooterColumnWidths().length) {
                layoutEngine.setFooterColumnWidth(i, footerColWidths[i])
            } else {
                layoutEngine.insertFooterColumnWidth(i, footerColWidths[i])
            }
        }
        const footerRowHts = data.footerRowHeights ?? []
        for (let i = 0; i < footerRowHts.length; i++) {
            if (i < layoutEngine.getFooterRowHeights().length) {
                layoutEngine.setFooterRowHeight(i, footerRowHts[i])
            } else {
                layoutEngine.insertFooterRowHeight(i, footerRowHts[i])
            }
        }

        // Create Table with styles
        const table = new Table(
            structureStore,
            cellRegistry,
            layoutEngine,
            mergeRegistry,
            undefined as unknown as IRuleEngine,
            data.settings,
            data.tableStyle,
            data.regionStyles,
        )

        // Create real rule engine and wire it up
        const ruleEngine = new RuleEngine(ruleRegistry, cellRegistry, structureStore, table)
        ;(table as any).ruleEngine = ruleEngine

        // Import rules
        if (data.rules.length > 0) {
            ruleEngine.importRules(data.rules)
        }

        // Restore merges (must be done after layout engine has structure)
        for (const merge of data.merges) {
            mergeRegistry.createMerge(merge)
        }

        // Rebuild layout + overflow + evaluate rules
        layoutEngine.rebuild()
        ;(table as any).applyOverflowConstraints()
        ruleEngine.evaluateAll()
        ;(table as any).applyRuleResults()

        return table
    }

    private static restoreHeaderNode(
        node: SerializedHeaderNode,
        region: Region,
        cellRegistry: CellRegistry,
        structureStore: StructureStore,
        parentId: string | undefined,
    ): void {
        cellRegistry.createCellWithId(
            node.cellId,
            region,
            node.rawValue?.toString(),
            node.style,
            node.isDynamic,
            node.computedValue,
        )

        if (parentId) {
            structureStore.addChildCell(parentId, region, node.cellId)
        } else {
            structureStore.addRootCell(node.cellId, region)
        }

        for (const child of node.children) {
            Table.restoreHeaderNode(child, region, cellRegistry, structureStore, node.cellId)
        }
    }
}
