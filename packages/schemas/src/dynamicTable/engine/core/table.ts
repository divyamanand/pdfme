import { ICellRegistry, ILayoutEngine, IMergeRegistry, IStructureStore, ITable } from "../interfaces"
import { ICell } from "../interfaces/core"
import { IRuleEngine } from "../interfaces/rules/rule-engine.interface"
import { EvaluationResult } from "../rules/types/evaluation.types"
import { CellPayload, CellStyle, Region, TableSettings, TableStyle, RegionStyle, BodyRegionStyle, RegionStyleMap, UIState } from "../types"
import { Rect } from "../types/common"
import type { SerializedHeaderNode, SerializedBodyCell, TableExportData } from "../renderers/types/serialization.types"
import { SettingsValidator } from './settings-validator'
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
    // Available space for the table (set from page boundaries)
    private _availableWidth: number = Infinity
    private _availableHeight: number = Infinity

    // Transient UI state (not serialized)
    private _onSelectionChange?: () => void
    private _requestRender?: () => void
    private _uiState: { editingCellId: string | null; selectedCells: Set<string>; selectionAnchor: { row: number; col: number; region: string } | null; mergeMode: 'none' | 'selecting' | 'unmerging' | 'styling' } = {
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
        return this.overflowEngine.getStylePatch(cellId)
    }

    private rebuildAndEvaluate(): void {
        const minRows = this.settings.minRows
        const maxRows = SettingsValidator.getEffectiveMaxRows(this.settings)
        const minCols = this.settings.minCols
        const maxCols = SettingsValidator.getEffectiveMaxCols(this.settings)
        if (minRows !== undefined) this.layoutEngine.enforceMinRows(minRows)
        if (maxRows !== undefined) this.layoutEngine.enforceMaxRows(maxRows)
        if (minCols !== undefined) this.layoutEngine.enforceMinCols(minCols)
        if (maxCols !== undefined) this.layoutEngine.enforceMaxCols(maxCols)
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
        this.overflowEngine.applyAll(mode, this._regionStyles)
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
        const error = SettingsValidator.validate(patch, merged)
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
            this.layoutEngine.resetDimensionsToDefaults()
        }
        this.rebuildAndEvaluate()
        return null
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

    /** Sum of max footer row width across all footer rows */
    private getFooterGridWidth(): number {
        const cellWidths = this.layoutEngine.getFooterCellWidths()
        if (cellWidths.length === 0) return 0
        return Math.max(...cellWidths.map(row => row.reduce((s, w) => s + w, 0)))
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
            if (!wasLeaf && this.structureStore.needsBodySliceForRegion(region)) {
                const newLeafIndex = this.structureStore.getBodyIndexForHeaderLeafCell(region, cellId)
                this.insertBodySliceForRegion(region, newLeafIndex)
            }
        } else {
            this.structureStore.addRootCell(cellId, region)
            if (this.structureStore.needsBodySliceForRegion(region)) {
                const leafIndex = this.structureStore.getBodyIndexForHeaderLeafCell(region, cellId)
                this.insertBodySliceForRegion(region, leafIndex)
            }
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
        const effectiveMax = SettingsValidator.getEffectiveMaxRows(this.settings)
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

    insertBodyCol(colIndex: number, data?: (string | number)[]): 'added' | 'max-reached' | 'exceeds-bounds' {
        const effectiveMax = SettingsValidator.getEffectiveMaxCols(this.settings)
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

    /**
     * Clear specific style override keys on a cell, reverting them to the region/default cascade.
     * Pass key names to clear, or no keys to clear all overrides.
     */
    clearCellStyleOverrides(cellId: string, ...keys: (keyof CellStyle)[]): void {
        const cell = this.cellRegistry.getCellById(cellId)
        if (!cell) return
        if (keys.length === 0) {
            cell.styleOverrides = {}
        } else {
            const overrides = { ...cell.styleOverrides }
            for (const key of keys) {
                delete overrides[key]
            }
            cell.styleOverrides = overrides
        }
        this.applyOverflowConstraints()
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

    // --- Footer Geometry (independent, per-cell per-row) ---

    setFooterRowHeight(rowIndex: number, height: number): void {
        this.layoutEngine.setFooterRowHeight(rowIndex, height)
        this.rebuildGeometryAndEvaluate()
    }

    getFooterRowHeights(): number[] {
        return this.layoutEngine.getFooterRowHeights()
    }

    getFooterCellWidths(): number[][] {
        return this.layoutEngine.getFooterCellWidths()
    }

    setFooterCellWidth(rowIndex: number, colIndex: number, width: number): void {
        this.layoutEngine.setFooterCellWidth(rowIndex, colIndex, width)
        this.rebuildGeometryAndEvaluate()
    }

    // --- Footer Structure ---

    getFooter(): readonly (readonly string[])[] {
        return this.structureStore.getFooter()
    }

    addFooterRow(): void {
        const cellId = this.cellRegistry.createCell('footer', '')
        this.structureStore.addFooterRow(cellId)
        const rowIdx = this.structureStore.getFooter().length - 1
        this.layoutEngine.insertFooterRow(rowIdx, this.layoutEngine.getDefaultCellHeight())
        this.layoutEngine.insertFooterCell(rowIdx, 0, this.layoutEngine.getDefaultCellWidth())
        this.rebuildAndEvaluate()
    }

    addFooterCell(rowIndex: number): void {
        const cellId = this.cellRegistry.createCell('footer', '')
        this.structureStore.addFooterCell(rowIndex, cellId)
        const colIdx = this.structureStore.getFooter()[rowIndex].length - 1
        this.layoutEngine.insertFooterCell(rowIndex, colIdx, this.layoutEngine.getDefaultCellWidth())
        this.rebuildAndEvaluate()
    }

    removeFooterCell(rowIndex: number, colIndex: number): void {
        const cellId = this.structureStore.removeFooterCell(rowIndex, colIndex)
        if (cellId) this.cellRegistry.deleteCell(cellId)
        this.layoutEngine.removeFooterCell(rowIndex, colIndex)
        this.rebuildAndEvaluate()
    }

    removeFooterRow(rowIndex: number): void {
        const removed = this.structureStore.removeFooterRow(rowIndex)
        for (const id of removed) this.cellRegistry.deleteCell(id)
        this.layoutEngine.removeFooterRow(rowIndex)
        if (this.structureStore.getFooter().length === 0) {
            this.settings = { ...this.settings, footer: undefined }
        }
        this.rebuildAndEvaluate()
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

    setMergeMode(mode: 'none' | 'selecting' | 'unmerging' | 'styling'): void {
        this._uiState.mergeMode = mode
        if (mode !== 'none') {
            this._uiState.editingCellId = null
            this._uiState.selectedCells.clear()
            this._uiState.selectionAnchor = null
        }
    }

    onSelectionChange(cb: (() => void) | undefined): void {
        this._onSelectionChange = cb
    }

    /** Store a callback that re-renders the canvas (called from uiRender). */
    requestRender(cb: (() => void) | undefined): void {
        this._requestRender = cb
    }

    /** Ask the canvas to re-render (e.g. after a mode change from the propPanel). */
    triggerRender(): void {
        this._requestRender?.()
    }

    toggleMergeSelection(cellId: string): void {
        if (this._uiState.selectedCells.has(cellId)) {
            this._uiState.selectedCells.delete(cellId)
        } else {
            this._uiState.selectedCells.add(cellId)
        }
        this._onSelectionChange?.()
    }

    // --- Render Snapshot ---

    getRenderSnapshot(): RenderableTableInstance {
        const settings = this.getSettings()
        const tableStyle = this.getTableStyle()
        const regionStyles = this.getRegionStyles()
        const columnWidths = this.getColumnWidths()
        const rowHeights = this.getRowHeights()
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
            const rulePatches = evalResult?.stylePatches?.map(p => p.style) ?? []
            const resolvedStyle = resolveStyle(regionStyle, cell.styleOverrides, overflowPatch, ...rulePatches)

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
                if (!cell) continue
                // Skip covered cells (consumed by a merge, rowSpan=0/colSpan=0)
                if (cell.layout && cell.layout.rowSpan === 0 && cell.layout.colSpan === 0) continue
                const renderableCell = buildRenderableCell(cell)
                cellsById.set(cell.cellID, renderableCell)
                if (rowCellsByRegion[cell.inRegion]) {
                    rowCellsByRegion[cell.inRegion].push(renderableCell)
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

        // Footer region: iterate 2D grid
        const footerGrid = this.structureStore.getFooter()
        const footerCellWidths = this.layoutEngine.getFooterCellWidths()
        for (let r = 0; r < footerGrid.length; r++) {
            const cells = new Map<number, RenderableCell>()
            const rawValues: (string | number)[] = []
            for (let c = 0; c < footerGrid[r].length; c++) {
                const cellId = footerGrid[r][c]
                const cell = this.getCellById(cellId)
                if (!cell?.layout || cell.layout.rowSpan === 0 || cell.layout.colSpan === 0) continue
                const renderableCell = buildRenderableCell(cell)
                cellsById.set(cell.cellID, renderableCell)
                cells.set(c, renderableCell)
                rawValues.push(cell.rawValue)
            }
            regions.footer.push({
                rowIndex: r,
                globalRowIndex: r,
                region: 'footer',
                height: footerRowHeights[r] ?? this.layoutEngine.getDefaultCellHeight(),
                cells,
                rawValues,
            })
        }

        const columns: RenderableColumn[] = columnWidths.map((width, idx) => ({
            colIndex: idx,
            width,
        }))

        // footer columns: flatten per-row widths into a single representative column list
        // (use the widest row, or first row if all same length)
        const footerCellWidthsSnapshot = footerCellWidths
        const longestFooterRow = footerCellWidthsSnapshot.reduce(
            (best, row) => row.length > best.length ? row : best,
            [] as number[],
        )
        const footerColumns: RenderableColumn[] = longestFooterRow.map((width, idx) => ({
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

        // Populate mergeRect on root cells so renderers can identify merged cells
        for (const [cellId, rect] of mergeSet) {
            const rc = cellsById.get(cellId)
            if (rc) rc.mergeRect = rect
        }

        // Compute region dimension offsets for visibility-aware size calculations
        // Column layout: [lhD cols | thL cols | rhD cols]
        // Row layout:    [thD rows | bodyRows rows]
        // lheader/rheader share rows with body (side-by-side), they don't add height
        const vis = settings.headerVisibility ?? {}
        const hasFooter = !!settings.footer
        const lhD = this.structureStore.getRoots('lheader')
            ? this.structureStore.getRoots('lheader')!.reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
            : 0
        const thD = this.structureStore.getRoots('theader')
            ? this.structureStore.getRoots('theader')!.reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
            : 0
        const thL = this.structureStore.getLeafCount('theader')
        const rhD = this.structureStore.getRoots('rheader')
            ? this.structureStore.getRoots('rheader')!.reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
            : 0

        // Compute position offsets for hidden regions
        // When theader is hidden, all cells below shift up by theader's total height
        let yOffset = 0
        if (vis.theader === false) {
            for (let i = 0; i < thD && i < rowHeights.length; i++) yOffset += rowHeights[i]
        }
        // When lheader is hidden, all cells to the right shift left by lheader's total width
        let xOffset = 0
        if (vis.lheader === false) {
            for (let i = 0; i < lhD && i < columnWidths.length; i++) xOffset += columnWidths[i]
        }

        // Apply position offsets to all renderable cells
        // Footer uses independent x coordinates (its own column prefix sums starting from 0),
        // so xOffset (from hidden lheader) must NOT be applied to footer cells.
        // yOffset (from hidden theader) applies to all cells including footer since
        // footer Y = mainTableHeight which includes theader rows.
        if (xOffset > 0 || yOffset > 0) {
            for (const [, rc] of cellsById) {
                const applyX = rc.inRegion === 'footer' ? 0 : xOffset
                rc.layout = {
                    ...rc.layout,
                    x: rc.layout.x - applyX,
                    y: rc.layout.y - yOffset,
                }
            }
        }

        const getTheaderHeight = (): number => {
            if (vis.theader === false) return 0
            let h = 0
            for (let i = 0; i < thD && i < rowHeights.length; i++) h += rowHeights[i]
            return h
        }

        const getBodyHeight = (): number => {
            let h = 0
            for (let i = thD; i < rowHeights.length; i++) h += rowHeights[i]
            return h
        }

        const getFooterHeight = (): number => {
            if (!hasFooter) return 0
            return regions.footer.reduce((s, r) => s + r.height, 0)
        }

        const getMainWidth = (): number => {
            let w = 0
            if (vis.lheader === true) {
                for (let i = 0; i < lhD && i < columnWidths.length; i++) w += columnWidths[i]
            }
            for (let i = lhD; i < lhD + thL && i < columnWidths.length; i++) w += columnWidths[i]
            if (vis.rheader === true) {
                for (let i = lhD + thL; i < lhD + thL + rhD && i < columnWidths.length; i++) w += columnWidths[i]
            }
            return w
        }

        const getFooterWidth = (): number => {
            if (!hasFooter) return 0
            return footerColumns.reduce((s, c) => s + c.width, 0)
        }

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
            getHeight() { return getTheaderHeight() + getBodyHeight() + getFooterHeight() },
            getHeadHeight() { return getTheaderHeight() },
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
        const headerRegions: ('theader' | 'lheader' | 'rheader')[] = ['theader', 'lheader', 'rheader']
        const headerTrees = {} as Record<'theader' | 'lheader' | 'rheader', SerializedHeaderNode[]>

        for (const region of headerRegions) {
            const roots = this.structureStore.getRoots(region)
            headerTrees[region] = roots
                ? roots.map(rootId => this.serializeHeaderNode(rootId))
                : []
        }

        const bodyGrid = this.structureStore.getBody()
        const body: SerializedBodyCell[][] = bodyGrid.map(row =>
            row.map(cellId => {
                const cell = this.cellRegistry.getCellById(cellId)!
                return {
                    cellId: cell.cellID,
                    rawValue: cell.rawValue,
                    style: { ...cell.styleOverrides },
                    overflow: cell.overflow,
                    isDynamic: cell.isDynamic,
                    computedValue: cell.computedValue,
                }
            })
        )

        const footer: SerializedBodyCell[][] = this.structureStore.getFooter().map(row =>
            row.map(cellId => {
                const cell = this.cellRegistry.getCellById(cellId)!
                return {
                    cellId: cell.cellID,
                    rawValue: cell.rawValue,
                    style: { ...cell.styleOverrides },
                    overflow: cell.overflow,
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
            footer,
            body,
            merges,
            settings: { ...this.settings },
            tableStyle: { ...this._tableStyle },
            regionStyles: { ...this._regionStyles },
            columnWidths: [...this.layoutEngine.getColumnWidths()],
            rowHeights: [...this.layoutEngine.getRowHeights()],
            footerCellWidths: this.layoutEngine.getFooterCellWidths(),
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
            overflow: cell.overflow,
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

        // Restore header trees (theader, lheader, rheader only — footer is now a flat 2D grid)
        const headerRegions: ('theader' | 'lheader' | 'rheader')[] = ['theader', 'lheader', 'rheader']
        for (const region of headerRegions) {
            const trees = data.headerTrees?.[region] ?? []
            for (const node of trees) {
                Table.restoreHeaderNode(node, region, cellRegistry, structureStore, undefined)
            }
        }

        // Restore body grid
        for (let rowIdx = 0; rowIdx < (data.body ?? []).length; rowIdx++) {
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
                    cellData.overflow,
                )
                cellIds.push(cellData.cellId)
            }
            structureStore.insertBodyRow(rowIdx, cellIds)
        }

        // Restore footer 2D grid (new format)
        const footerRows = data.footer ?? []
        if (footerRows.length > 0) {
            for (let r = 0; r < footerRows.length; r++) {
                const row = footerRows[r]
                if (row.length === 0) continue
                const firstCd = row[0]
                cellRegistry.createCellWithId(
                    firstCd.cellId, 'footer', firstCd.rawValue?.toString(),
                    firstCd.style, firstCd.isDynamic, firstCd.computedValue, firstCd.overflow,
                )
                structureStore.addFooterRow(firstCd.cellId)
                layoutEngine.insertFooterRow(r, data.footerRowHeights?.[r] ?? layoutEngine.getDefaultCellHeight())
                layoutEngine.insertFooterCell(r, 0, data.footerCellWidths?.[r]?.[0] ?? layoutEngine.getDefaultCellWidth())
                for (let c = 1; c < row.length; c++) {
                    const cd = row[c]
                    cellRegistry.createCellWithId(
                        cd.cellId, 'footer', cd.rawValue?.toString(),
                        cd.style, cd.isDynamic, cd.computedValue, cd.overflow,
                    )
                    structureStore.addFooterCell(r, cd.cellId)
                    layoutEngine.insertFooterCell(r, c, data.footerCellWidths?.[r]?.[c] ?? layoutEngine.getDefaultCellWidth())
                }
            }
        } else {
            // Backward compat: migrate old tree-based footer (headerTrees.footer) to flat first row
            const oldFooterNodes = (data as any).headerTrees?.footer as any[] | undefined
            if (oldFooterNodes && oldFooterNodes.length > 0) {
                const collectLeaves = (nodes: any[]): any[] => {
                    const leaves: any[] = []
                    const walk = (n: any) => {
                        if (!n.children || n.children.length === 0) leaves.push(n)
                        else n.children.forEach(walk)
                    }
                    nodes.forEach(walk)
                    return leaves
                }
                const leaves = collectLeaves(oldFooterNodes)
                if (leaves.length > 0) {
                    cellRegistry.createCellWithId(leaves[0].cellId, 'footer', String(leaves[0].rawValue ?? ''), leaves[0].style, leaves[0].isDynamic, leaves[0].computedValue, leaves[0].overflow)
                    structureStore.addFooterRow(leaves[0].cellId)
                    layoutEngine.insertFooterRow(0, layoutEngine.getDefaultCellHeight())
                    layoutEngine.insertFooterCell(0, 0, layoutEngine.getDefaultCellWidth())
                    for (let c = 1; c < leaves.length; c++) {
                        cellRegistry.createCellWithId(leaves[c].cellId, 'footer', String(leaves[c].rawValue ?? ''), leaves[c].style, leaves[c].isDynamic, leaves[c].computedValue, leaves[c].overflow)
                        structureStore.addFooterCell(0, leaves[c].cellId)
                        layoutEngine.insertFooterCell(0, c, layoutEngine.getDefaultCellWidth())
                    }
                }
            }
            // Also restore old flat footerColumnWidths if present (further backward compat)
            const oldFooterColWidths = (data as any).footerColumnWidths as number[] | undefined
            if (oldFooterColWidths && oldFooterColWidths.length > 0 && footerRows.length === 0) {
                for (let i = 0; i < oldFooterColWidths.length; i++) {
                    layoutEngine.setFooterCellWidth(0, i, oldFooterColWidths[i])
                }
            }
            // Restore old footer row heights if no new data
            const oldFooterRowHts = (data as any).footerRowHeights as number[] | undefined
            if (oldFooterRowHts) {
                for (let i = 0; i < oldFooterRowHts.length; i++) {
                    layoutEngine.setFooterRowHeight(i, oldFooterRowHts[i])
                }
            }
        }

        // Restore geometry (default dimensions now live in settings)
        layoutEngine.setDefaultCellWidth(data.settings?.defaultCellWidth ?? 30)
        layoutEngine.setDefaultCellHeight(data.settings?.defaultCellHeight ?? 10)
        for (let i = 0; i < (data.columnWidths ?? []).length; i++) {
            if (i < layoutEngine.getColumnWidths().length) {
                layoutEngine.setColumnWidth(i, data.columnWidths[i])
            } else {
                layoutEngine.insertColumnWidth(i, data.columnWidths[i])
            }
        }
        for (let i = 0; i < (data.rowHeights ?? []).length; i++) {
            if (i < layoutEngine.getRowHeights().length) {
                layoutEngine.setRowHeight(i, data.rowHeights[i])
            } else {
                layoutEngine.insertRowHeight(i, data.rowHeights[i])
            }
        }

        // Footer row heights for new format (already set per-row above, but apply saved values if present)
        if (footerRows.length > 0) {
            const footerRowHts = data.footerRowHeights ?? []
            for (let i = 0; i < footerRowHts.length; i++) {
                layoutEngine.setFooterRowHeight(i, footerRowHts[i])
            }
        }

        // Create Table with styles
        const table = new Table(
            structureStore,
            cellRegistry,
            layoutEngine,
            mergeRegistry,
            undefined as unknown as IRuleEngine,
            data.settings ?? {},
            data.tableStyle ?? {},
            data.regionStyles ?? {},
        )

        // Create real rule engine and wire it up
        const ruleEngine = new RuleEngine(ruleRegistry, cellRegistry, structureStore, table)
        ;(table as any).ruleEngine = ruleEngine

        // Import rules
        if ((data.rules ?? []).length > 0) {
            ruleEngine.importRules(data.rules)
        }

        // Restore merges (must be done after layout engine has structure)
        for (const merge of (data.merges ?? [])) {
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
            node.overflow,
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
