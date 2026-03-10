import { ICellRegistry, ILayoutEngine, IMergeRegistry, IStructureStore, ITable } from "../interfaces"
import { ICell } from "../interfaces/core"
import { IRuleEngine } from "../interfaces/rules/rule-engine.interface"
import { EvaluationResult } from "../rules/types/evaluation.types"
import { CellPayload, Region, TableSettings, TableStyle, RegionStyle, BodyRegionStyle, RegionStyleMap } from "../types"
import { Rect } from "../types/common"
import type { SerializedHeaderNode, SerializedBodyCell, TableExportData } from "../renderers/types/serialization.types"
import { StructureStore } from "../stores/structure.store"
import { CellRegistry } from "../stores/cell-registry.store"
import { MergeRegistry } from "../stores/merge-registry.stores"
import { LayoutEngine } from "../engines/layout.engine"
import { RuleRegistry } from "../rules/rule-registry"
import { RuleEngine } from "../rules/rule-engine"
import { defaultTableStyle } from "../styles/defaults"

const DEFAULT_TABLE_SETTINGS: TableSettings = {
    overflow: 'wrap',
    footer: { mode: 'last-page' },
    headerVisibility: { theader: true, lheader: true, rheader: true },
    pagination: { repeatHeaders: true },
}

export class Table implements ITable {
    private structureStore: IStructureStore
    private cellRegistry: ICellRegistry
    private layoutEngine: ILayoutEngine
    private mergeRegistry: IMergeRegistry
    private settings: TableSettings
    private ruleEngine: IRuleEngine
    private _tableStyle: TableStyle
    private _regionStyles: RegionStyleMap

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
        this.ruleEngine = ruleEngine
        this.settings = { ...DEFAULT_TABLE_SETTINGS, ...settings }
        this._tableStyle = { ...defaultTableStyle, ...tableStyle }
        this._regionStyles = regionStyles ? { ...regionStyles } : {}
    }

    getEvaluationResult(cellId: string): EvaluationResult | undefined {
        return this.ruleEngine?.getResult(cellId)
    }

    private rebuildAndEvaluate(): void {
        this.layoutEngine.rebuild()
        this.ruleEngine?.evaluateAll()
        this.applyRuleResults()
    }

    private rebuildGeometryAndEvaluate(): void {
        this.layoutEngine.rebuildGeometry()
        this.ruleEngine?.evaluateAll()
        this.applyRuleResults()
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

    updateSettings(patch: Partial<TableSettings>): void {
        this.settings = { ...this.settings, ...patch }
        this.rebuildAndEvaluate()
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

    // --- Header operations ---

    addHeaderCell(region: Region, parentId?: string, index?: number): string {
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

    insertBodyRow(rowIndex: number, data?: (string | number)[]): void {
        if (this.settings.maxRows !== undefined &&
            this.structureStore.getBody().length >= this.settings.maxRows) return

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
    }

    removeBodyRow(rowIndex: number): void {
        if (this.settings.minRows !== undefined &&
            this.structureStore.getBody().length <= this.settings.minRows) {
            const row = this.structureStore.getBody()[rowIndex]
            if (row) {
                for (const cellId of row) {
                    this.cellRegistry.updateCell(cellId, { rawValue: "", computedValue: undefined })
                }
            }
            return
        }

        const removedIds = this.structureStore.removeBodyRow(rowIndex)
        for (const id of removedIds) this.cellRegistry.deleteCell(id)
        this.layoutEngine.removeRowHeight(rowIndex)
        this.rebuildAndEvaluate()
    }

    insertBodyCol(colIndex: number, data?: (string | number)[]): void {
        if (this.settings.maxCols !== undefined &&
            this.structureStore.getBody()[0]?.length >= this.settings.maxCols) return

        const numRows = this.structureStore.getBody().length
        const cellIds: string[] = []
        for (let i = 0; i < numRows; i++) {
            cellIds.push(this.cellRegistry.createCell("body", data?.[i]?.toString()))
        }
        this.structureStore.insertBodyCol(colIndex, cellIds)
        this.layoutEngine.insertColumnWidth(colIndex, this.layoutEngine.getDefaultCellWidth())
        this.rebuildAndEvaluate()
    }

    removeBodyCol(colIndex: number): void {
        if (this.settings.minCols !== undefined &&
            this.structureStore.getBody()[0]?.length <= this.settings.minCols) return

        const removedIds = this.structureStore.removeBodyCol(colIndex)
        for (const id of removedIds) this.cellRegistry.deleteCell(id)
        this.layoutEngine.removeColumnWidth(colIndex)
        this.rebuildAndEvaluate()
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
            defaultCellWidth: this.layoutEngine.getDefaultCellWidth(),
            defaultCellHeight: this.layoutEngine.getDefaultCellHeight(),
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

        // Restore geometry
        layoutEngine.setDefaultCellWidth(data.defaultCellWidth)
        layoutEngine.setDefaultCellHeight(data.defaultCellHeight)
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

        // Rebuild layout + evaluate rules
        layoutEngine.rebuild()
        ruleEngine.evaluateAll()

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
