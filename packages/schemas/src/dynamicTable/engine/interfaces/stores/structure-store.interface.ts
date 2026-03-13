import { Region } from "../../types"

export interface IStructureStore {

    // =====================================================
    // HEADER TREE (Topology)
    // =====================================================

    // Roots
    addRootCell(cellId: string, region: Region): void
    removeRootCell(cellId: string, region: Region): void
    getRoots(region: Region): readonly string[] | undefined

    // Parent-Child
    addChildCell(parentId: string, region: Region, childId: string, index?: number): void
    removeChildCell(parentId: string, childId: string, region: Region): void
    getChildren(parentId: string): readonly string[] | undefined


    // =====================================================
    // BODY GRID (2D Ordered Structure)
    // =====================================================

    insertBodyRow(rowIndex: number, cellIds: string[]): void
    removeBodyRow(rowIndex: number): string[]

    insertBodyCol(colIndex: number, cellIds: string[]): void
    removeBodyCol(colIndex: number): string[]

    getBodyCell(rowIndex: number, colIndex: number): string | undefined
    getBody(): readonly (readonly string[])[]

    countTotalRows(): number
    countTotalCols(): number

    // =====================================================
    // TREE QUERIES
    // =====================================================

    getLeafCells(cellId: string): string[]
    getHeightOfCell(cellId: string): number
    isLeafCell(cellId: string): boolean
    getLeafCount(region: Region): number
    getBodyIndexForHeaderLeafCell(region: Region, cellId: string): number

    reorderHeaderCell(region: Region, fromIndex: number, toIndex: number, withChildren?: boolean): void

    /** Check if the body grid needs a new row/col slice to match this region's current leaf count */
    needsBodySliceForRegion(region: Region): boolean

    // =====================================================
    // FOOTER GRID (independent 2D structure, no hierarchy)
    // =====================================================
    addFooterCell(rowIndex: number, cellId: string): void
    removeFooterCell(rowIndex: number, colIndex: number): string
    addFooterRow(cellId: string): void
    removeFooterRow(rowIndex: number): string[]
    getFooter(): readonly (readonly string[])[]
    getFooterCell(rowIndex: number, colIndex: number): string | undefined
}
