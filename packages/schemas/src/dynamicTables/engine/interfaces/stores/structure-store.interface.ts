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
}
