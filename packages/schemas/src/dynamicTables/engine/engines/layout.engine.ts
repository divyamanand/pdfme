import { ICellRegistry, ILayoutEngine, IMergeRegistry, IStructureStore } from "../interfaces";
import { Cell } from "../core/cell";
import { Region, TablePosition } from "../types";

export class LayoutEngine implements ILayoutEngine {
    
    
    private tablePosition: TablePosition = { x: 0, y: 0 }
    private columnWidths: number[] = []
    private rowHeights: number[] = []
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
        const footerD = (this.structureStore.getRoots("footer") ?? [])
            .reduce((max, r) => Math.max(max, this.structureStore.getHeightOfCell(r)), 0)
        const totalRows = thD + bodyRows + footerD
    
        // Grow arrays if needed (pad with defaults), never shrink automatically
        while (this.columnWidths.length < totalCols)
            this.columnWidths.push(this.defaultCellWidth)
        while (this.rowHeights.length < totalRows)
            this.rowHeights.push(this.defaultCellHeight)
    
        // Trim if grid shrank (e.g. after delete)
        if (this.columnWidths.length > totalCols)
            this.columnWidths.length = totalCols
        if (this.rowHeights.length > totalRows)
            this.rowHeights.length = totalRows
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
    
        // Walk header trees
        for (const region of ['theader', 'lheader', 'rheader', 'footer'] as const) {
            const walkTree = (cellId: string) => {
                computeForCell(cellId)
                for (const child of this.structureStore.getChildren(cellId) ?? [])
                    walkTree(child)
            }
            for (const root of this.structureStore.getRoots(region) ?? [])
                walkTree(root)
        }
    
        // Walk body cells
        for (const row of this.structureStore.getBody())
            for (const cellId of row)
                computeForCell(cellId)
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
        orientation: "horizontal" | "vertical"
    ): void {
        const cell = this.cellRegistry.getCellById(cellId) as Cell
        const primarySpan = primarySpanMap.get(cellId) ?? 1
        const secondarySpan = secondarySpanMap.get(cellId) ?? 1

        const row = orientation === "horizontal" ? secondaryStart : primaryStart
        const col = orientation === "horizontal" ? primaryStart : secondaryStart
        const rowSpan = orientation === "horizontal" ? secondarySpan : primarySpan
        const colSpan = orientation === "horizontal" ? primarySpan : secondarySpan

        cell._setLayout({ row, col, rowSpan, colSpan, x: 0, y: 0, width: 0, height: 0 })
        this.cellRegistry.setCellAddress(cellId, row, col)

        let childPrimaryStart = primaryStart
        for (const child of this.structureStore.getChildren(cellId) ?? []) {
            this.applyLayoutForCell(
                child,
                childPrimaryStart,
                secondaryStart + secondarySpan,
                primarySpanMap,
                secondarySpanMap,
                orientation
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
                orientation
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

                    // mark children as skipped (body-local coords)
                    for (let mr = r; mr < r + rowSpan; mr++) {
                        for (let mc = c; mc < c + colSpan; mc++) {
                            if (mr !== r || mc !== c) {
                                skips.add(`${mr}:${mc}`)
                            }
                        }
                    }
                }

                const row = rowOffset + r
                const col = colOffset + c
                const cell = this.cellRegistry.getCellById(cellId) as Cell
                cell._setLayout({ row, col, rowSpan, colSpan, x: 0, y: 0, width: 0, height: 0 })
                this.cellRegistry.setCellAddress(cellId, row, col)
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
}