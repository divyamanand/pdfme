import { ICellRegistry, ILayoutEngine, IMergeRegistry, IStructureStore } from "../interfaces";
import { Cell } from "../core/cell";
import { Region, TablePosition } from "../types";

export class LayoutEngine implements ILayoutEngine {
    
    
    private tablePosition: TablePosition = { x: 0, y: 0 }
    private columnWidths: number[] = []
    private rowHeights: number[] = []
    private footerColumnWidths: number[] = []
    private footerRowHeights: number[] = []
    private defaultCellWidth: number = 30    // mm
    private defaultCellHeight: number = 10   // mm
    
    constructor(
        private mergeRegistry: IMergeRegistry,
        private structureStore: IStructureStore,
        private cellRegistry: ICellRegistry,
    ) {}
    
    
    // Ensure dimension arrays match grid size (called in rebuildGeometry)
    private initDimensions(): void {
        const lhD = (this.structureStore.getRoots("lheader") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const thL = this.structureStore.getLeafCount("theader")
        const rhD = (this.structureStore.getRoots("rheader") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const totalCols = lhD + thL + rhD
    
        const thD = (this.structureStore.getRoots("theader") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const bodyRows = this.structureStore.getBody().length
        const totalRows = thD + bodyRows
    
        // Main grid arrays (theader + lheader + rheader + body)
        while (this.columnWidths.length < totalCols)
            this.columnWidths.push(this.defaultCellWidth)
        while (this.rowHeights.length < totalRows)
            this.rowHeights.push(this.defaultCellHeight)
    
        if (this.columnWidths.length > totalCols)
            this.columnWidths.length = totalCols
        if (this.rowHeights.length > totalRows)
            this.rowHeights.length = totalRows

        // Footer arrays (independent from main grid)
        const footerD = (this.structureStore.getRoots("footer") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const footerL = this.structureStore.getLeafCount("footer")

        while (this.footerColumnWidths.length < footerL)
            this.footerColumnWidths.push(this.defaultCellWidth)
        while (this.footerRowHeights.length < footerD)
            this.footerRowHeights.push(this.defaultCellHeight)

        if (this.footerColumnWidths.length > footerL)
            this.footerColumnWidths.length = footerL
        if (this.footerRowHeights.length > footerD)
            this.footerRowHeights.length = footerD
    }
    
    // Compute x/y/width/height via prefix sums
    private applyGeometry(): void {
        const colPrefixSums = [0]
        for (let i = 0; i < this.columnWidths.length; i++)
            colPrefixSums.push(colPrefixSums[i] + this.columnWidths[i])
    
        const rowPrefixSums = [0]
        for (let i = 0; i < this.rowHeights.length; i++)
            rowPrefixSums.push(rowPrefixSums[i] + this.rowHeights[i])
    
        const computeForCell = (cellId: string) => {
            const cell = this.cellRegistry.getCellById(cellId) as Cell
            const layout = cell.layout
            if (!layout) return
    
            const x = colPrefixSums[layout.col] ?? 0
            const y = rowPrefixSums[layout.row] ?? 0
            const width = (colPrefixSums[layout.col + layout.colSpan] ?? colPrefixSums[colPrefixSums.length - 1]) - x
            const height = (rowPrefixSums[layout.row + layout.rowSpan] ?? rowPrefixSums[rowPrefixSums.length - 1]) - y
    
            cell._setLayout({ ...layout, x, y, width, height })
        }
    
        // Walk non-footer header trees
        for (const region of ['theader', 'lheader', 'rheader'] as const) {
            const walkTree = (cellId: string) => {
                computeForCell(cellId)
                for (const child of this.structureStore.getChildren(cellId) ?? [])
                    walkTree(child)
            }
            for (const root of this.structureStore.getRoots(region) ?? [])
                walkTree(root)
        }
    
        // Walk body cells (skip cells hidden by merges)
        for (const row of this.structureStore.getBody())
            for (const cellId of row) {
                const cell = this.cellRegistry.getCellById(cellId) as Cell
                if (cell?.layout && cell.layout.rowSpan === 0 && cell.layout.colSpan === 0) continue
                computeForCell(cellId)
            }

        // Footer geometry (independent prefix sums, Y offset = main table height)
        // Footer cells use global coordinates; map to local indices for footer dimension arrays
        const footerColStart = (this.structureStore.getRoots("lheader") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const footerRowStart = this.rowHeights.length  // = thD + bodyRows

        const footerColPrefixSums = [0]
        for (let i = 0; i < this.footerColumnWidths.length; i++)
            footerColPrefixSums.push(footerColPrefixSums[i] + this.footerColumnWidths[i])

        const mainTableHeight = rowPrefixSums[rowPrefixSums.length - 1] ?? 0
        const footerRowPrefixSums = [mainTableHeight]
        for (let i = 0; i < this.footerRowHeights.length; i++)
            footerRowPrefixSums.push(footerRowPrefixSums[i] + this.footerRowHeights[i])

        const computeForFooterCell = (cellId: string) => {
            const cell = this.cellRegistry.getCellById(cellId) as Cell
            const layout = cell.layout
            if (!layout) return

            const localCol = layout.col - footerColStart
            const localRow = layout.row - footerRowStart
            const x = footerColPrefixSums[localCol] ?? 0
            const y = footerRowPrefixSums[localRow] ?? mainTableHeight
            const width = (footerColPrefixSums[localCol + layout.colSpan] ?? footerColPrefixSums[footerColPrefixSums.length - 1]) - x
            const height = (footerRowPrefixSums[localRow + layout.rowSpan] ?? footerRowPrefixSums[footerRowPrefixSums.length - 1]) - y

            cell._setLayout({ ...layout, x, y, width, height })
        }

        const walkFooterTree = (cellId: string) => {
            computeForFooterCell(cellId)
            for (const child of this.structureStore.getChildren(cellId) ?? [])
                walkFooterTree(child)
        }
        for (const root of this.structureStore.getRoots('footer') ?? [])
            walkFooterTree(root)
    }
    
    private calculateColSpan(cellId: string, res: Map<string, number>): number {
        if (this.structureStore.isLeafCell(cellId)) {
            res.set(cellId, 1)
            return 1
        }

        let total = 0
        const children = this.structureStore.getChildren(cellId) ?? []

        for (const child of children) {
            total += this.calculateColSpan(child, res)
        }

        res.set(cellId, total)
        return total
    }

    private calculateRowSpan(cellId: string, res: Map<string, number>, currLevel: number, heightMax: number): void {
        if (this.structureStore.isLeafCell(cellId)) {
            res.set(cellId, heightMax - currLevel + 1)
            return
        } else {
            res.set(cellId, 1)
        }

        const children = this.structureStore.getChildren(cellId) ?? []

        for (const child of children) {
            this.calculateRowSpan(child, res, currLevel + 1, heightMax)
        }

    }
    
    private applyLayoutForCell(
        cellId: string,
        primaryStart: number,
        secondaryStart: number,
        primarySpanMap: Map<string, number>,
        secondarySpanMap: Map<string, number>,
        orientation: "horizontal" | "vertical",
    ): void {
        const cell = this.cellRegistry.getCellById(cellId) as Cell
        const primarySpan = primarySpanMap.get(cellId) ?? 1
        const secondarySpan = secondarySpanMap.get(cellId) ?? 1

        const row = orientation === "horizontal" ? secondaryStart : primaryStart
        const col = orientation === "horizontal" ? primaryStart : secondaryStart
        const rowSpan = orientation === "horizontal" ? secondarySpan : primarySpan
        const colSpan = orientation === "horizontal" ? primarySpan : secondarySpan

        cell._setLayout({ row, col, rowSpan, colSpan, x: 0, y: 0, width: 0, height: 0 })
        this.cellRegistry.setCellAddress(cellId, `${row},${col}`)

        let childPrimaryStart = primaryStart
        for (const child of this.structureStore.getChildren(cellId) ?? []) {
            this.applyLayoutForCell(
                child,
                childPrimaryStart,
                secondaryStart + secondarySpan,
                primarySpanMap,
                secondarySpanMap,
                orientation,
            )
            childPrimaryStart += primarySpanMap.get(child) ?? 1
        }
    }

    applyHeaderLayout(region: Region, rowOffset: number, colOffset: number): void {
        const roots = this.structureStore.getRoots(region) ?? []
        if (roots.length === 0) return

        const orientation: "horizontal" | "vertical" =
            (region === "theader" || region === "footer") ? "horizontal" : "vertical"

        const maxDepth = roots.reduce((max, root) =>
            Math.max(max, this.structureStore.getHeightOfCell(root)), 0)

        const fixedOffset = orientation === "horizontal" ? rowOffset : colOffset
        let advancingStart = orientation === "horizontal" ? colOffset : rowOffset

        for (const root of roots) {
            const primarySpanMap = new Map<string, number>()
            const secondarySpanMap = new Map<string, number>()

            this.calculateColSpan(root, primarySpanMap)
            this.calculateRowSpan(root, secondarySpanMap, 1, maxDepth)

            this.applyLayoutForCell(
                root,
                advancingStart,
                fixedOffset,
                primarySpanMap,
                secondarySpanMap,
                orientation,
            )

            advancingStart += primarySpanMap.get(root) ?? 1
        }
    }

    applyBodyLayout(rowOffset: number, colOffset: number): void {
        const body = this.structureStore.getBody()
        const merges = this.mergeRegistry.getMergeSet()
        const skips = new Set<string>()

        for (let r = 0; r < body.length; r++) {
            for (let c = 0; c < body[r].length; c++) {
                if (skips.has(`${r}:${c}`)) continue

                const cellId = body[r][c]
                let rowSpan = 1
                let colSpan = 1

                if (merges.has(cellId)) {
                    const { startRow, startCol, endRow, endCol } = merges.get(cellId)!
                    rowSpan = endRow - startRow + 1
                    colSpan = endCol - startCol + 1

                    // mark children as skipped and hidden (body-local coords)
                    for (let mr = r; mr < r + rowSpan; mr++) {
                        for (let mc = c; mc < c + colSpan; mc++) {
                            if (mr !== r || mc !== c) {
                                skips.add(`${mr}:${mc}`)
                                // Mark covered cell as hidden so renderers skip it
                                const coveredId = body[mr]?.[mc]
                                if (coveredId) {
                                    const coveredCell = this.cellRegistry.getCellById(coveredId) as Cell
                                    if (coveredCell) {
                                        const coveredRow = rowOffset + mr
                                        const coveredCol = colOffset + mc
                                        coveredCell._setLayout({ row: coveredRow, col: coveredCol, rowSpan: 0, colSpan: 0, x: 0, y: 0, width: 0, height: 0 })
                                        this.cellRegistry.setCellAddress(coveredId, `${coveredRow},${coveredCol}`)
                                    }
                                }
                            }
                        }
                    }
                }

                const row = rowOffset + r
                const col = colOffset + c
                const cell = this.cellRegistry.getCellById(cellId) as Cell
                cell._setLayout({ row, col, rowSpan, colSpan, x: 0, y: 0, width: 0, height: 0 })
                this.cellRegistry.setCellAddress(cellId, `${row},${col}`)
            }
        }
    }

    /**
     * Apply merges to header regions (post-pass after tree-based layout)
     *
     * After applyHeaderLayout runs, header cells have row/col set and are registered
     * in cellRegistry. This method:
     * 1. Iterates mergeRegistry for entries matching this region
     * 2. Overrides root cell's rowSpan/colSpan from the Rect
     * 3. Marks covered (non-root) cells as hidden (rowSpan=0, colSpan=0)
     *
     * This allows header merges without modifying the tree topology.
     */
    private applyHeaderMerges(region: Region): void {
        const allMerges = this.mergeRegistry.getMergeSet()

        for (const [cellId, rect] of allMerges) {
            // Only process merges for this specific region
            if (rect.primaryRegion !== region) continue

            // Get the root cell of the merge
            const rootCell = this.cellRegistry.getCellById(cellId) as Cell
            if (!rootCell?.layout) continue

            // Calculate span from merge rect (must be in global grid coordinates)
            const rowSpan = rect.endRow - rect.startRow + 1
            const colSpan = rect.endCol - rect.startCol + 1

            // Override root cell with merged span
            rootCell._setLayout({ ...rootCell.layout, rowSpan, colSpan })

            // Mark all covered cells (except the root) as hidden (rowSpan=0, colSpan=0)
            // This prevents them from being rendered separately
            for (let r = rect.startRow; r <= rect.endRow; r++) {
                for (let c = rect.startCol; c <= rect.endCol; c++) {
                    // Skip the root cell itself
                    if (r === rootCell.layout.row && c === rootCell.layout.col) continue

                    // Look up the covered cell by its address
                    const covered = this.cellRegistry.getCellByAddress(`${r},${c}`) as Cell | undefined
                    if (covered?.layout) {
                        // Set hidden marker: rowSpan=0, colSpan=0 signals "consumed by merge"
                        covered._setLayout({ ...covered.layout, rowSpan: 0, colSpan: 0 })
                    }
                }
            }
        }
    }

    // Dimension array management
    setColumnWidth(colIndex: number, width: number): void {
        if (colIndex >= 0 && colIndex < this.columnWidths.length)
            this.columnWidths[colIndex] = width
    }

    setRowHeight(rowIndex: number, height: number): void {
        if (rowIndex >= 0 && rowIndex < this.rowHeights.length)
            this.rowHeights[rowIndex] = height
    }

    insertColumnWidth(colIndex: number, width: number): void {
        this.columnWidths.splice(colIndex, 0, width)
    }

    removeColumnWidth(colIndex: number): void {
        this.columnWidths.splice(colIndex, 1)
    }

    insertRowHeight(rowIndex: number, height: number): void {
        this.rowHeights.splice(rowIndex, 0, height)
    }

    removeRowHeight(rowIndex: number): void {
        this.rowHeights.splice(rowIndex, 1)
    }

    // Footer dimension management (independent from main grid)
    setFooterColumnWidth(colIndex: number, width: number): void {
        if (colIndex >= 0 && colIndex < this.footerColumnWidths.length)
            this.footerColumnWidths[colIndex] = width
    }

    setFooterRowHeight(rowIndex: number, height: number): void {
        if (rowIndex >= 0 && rowIndex < this.footerRowHeights.length)
            this.footerRowHeights[rowIndex] = height
    }

    insertFooterColumnWidth(colIndex: number, width: number): void {
        this.footerColumnWidths.splice(colIndex, 0, width)
    }

    removeFooterColumnWidth(colIndex: number): void {
        this.footerColumnWidths.splice(colIndex, 1)
    }

    insertFooterRowHeight(rowIndex: number, height: number): void {
        this.footerRowHeights.splice(rowIndex, 0, height)
    }

    removeFooterRowHeight(rowIndex: number): void {
        this.footerRowHeights.splice(rowIndex, 1)
    }

    getFooterColumnWidths(): number[] { return [...this.footerColumnWidths] }
    getFooterRowHeights(): number[] { return [...this.footerRowHeights] }

    setDefaultCellWidth(width: number): void { this.defaultCellWidth = width }
    setDefaultCellHeight(height: number): void { this.defaultCellHeight = height }
    getDefaultCellWidth(): number { return this.defaultCellWidth }
    getDefaultCellHeight(): number { return this.defaultCellHeight }
    getColumnWidths(): number[] { return [...this.columnWidths] }
    getRowHeights(): number[] { return [...this.rowHeights] }
    setTablePosition(pos: TablePosition): void { this.tablePosition = { ...pos } }
    getTablePosition(): TablePosition { return { ...this.tablePosition } }



    rebuildLayout(): void {
        const lhD = (this.structureStore.getRoots("lheader") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const thD = (this.structureStore.getRoots("theader") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const thL = this.structureStore.getLeafCount("theader")
        const bodyRows = this.structureStore.getBody().length

        // Apply header layouts and merge overrides for each region
        this.applyHeaderLayout("lheader", thD, 0)
        this.applyHeaderMerges("lheader")

        this.applyHeaderLayout("theader", 0, lhD)
        this.applyHeaderMerges("theader")

        this.applyHeaderLayout("rheader", thD, lhD + thL)
        this.applyHeaderMerges("rheader")

        // Body layout already handles merges internally
        this.applyBodyLayout(thD, lhD)

        // Footer uses global coordinates but independent dimension arrays for resizing
        this.applyHeaderLayout("footer", thD + bodyRows, lhD)
        this.applyHeaderMerges("footer")
    }

    rebuildGeometry(): void {
        this.initDimensions()
        this.applyGeometry()
    }

    rebuild(): void {
        this.rebuildLayout()
        this.rebuildGeometry()
    }


    getCompleteGrid(): string[][] {
        const body = this.structureStore.getBody()
        // For tests, just return the body grid as-is
        // Headers can be accessed separately via their root cells and tree traversal
        return body as string[][]
    }

    resetDimensionsToDefaults(): void {
        const defaultW = this.defaultCellWidth
        const defaultH = this.defaultCellHeight
        for (let i = 0; i < this.columnWidths.length; i++) this.columnWidths[i] = defaultW
        for (let i = 0; i < this.rowHeights.length; i++) this.rowHeights[i] = defaultH
        for (let i = 0; i < this.footerColumnWidths.length; i++) this.footerColumnWidths[i] = defaultW
        for (let i = 0; i < this.footerRowHeights.length; i++) this.footerRowHeights[i] = defaultH
    }

    enforceMinRows(minRows: number): void {
        const body = this.structureStore.getBody()
        const numCols = body.length > 0
            ? body[0].length
            : this.structureStore.getLeafCount('theader')
        while (this.structureStore.getBody().length < minRows) {
            const cellIds: string[] = []
            for (let i = 0; i < numCols; i++) {
                cellIds.push(this.cellRegistry.createCell('body', ''))
            }
            const idx = this.structureStore.getBody().length
            this.structureStore.insertBodyRow(idx, cellIds)
            this.insertRowHeight(idx, this.defaultCellHeight)
        }
    }

    enforceMaxRows(maxRows: number): void {
        while (this.structureStore.getBody().length > maxRows) {
            const lastIdx = this.structureStore.getBody().length - 1
            const removedIds = this.structureStore.removeBodyRow(lastIdx)
            for (const id of removedIds) this.cellRegistry.deleteCell(id)
            this.removeRowHeight(lastIdx)
        }
    }

    enforceMinCols(minCols: number): void {
        const body = this.structureStore.getBody()
        const currentCols = body.length > 0 ? body[0].length : 0
        for (let c = currentCols; c < minCols; c++) {
            const currentBody = this.structureStore.getBody()
            const cellIds: string[] = []
            for (let r = 0; r < currentBody.length; r++) {
                cellIds.push(this.cellRegistry.createCell('body', ''))
            }
            this.structureStore.insertBodyCol(c, cellIds)
            this.insertColumnWidth(c, this.defaultCellWidth)
        }
    }

    enforceMaxCols(maxCols: number): void {
        while ((this.structureStore.getBody()[0]?.length ?? 0) > maxCols) {
            const lastIdx = this.structureStore.getBody()[0].length - 1
            const removedIds = this.structureStore.removeBodyCol(lastIdx)
            for (const id of removedIds) this.cellRegistry.deleteCell(id)
            this.removeColumnWidth(lastIdx)
        }
    }
}