import { IMergeRegistry, IStructureStore } from "../interfaces";
import { Rect } from "../types/common";

export class MergeRegistry implements IMergeRegistry {

    private mergeRegistry: Map<string, Rect>
    private structureStore: IStructureStore

    constructor(
        structureStore: IStructureStore
    ) {
        this.mergeRegistry = new Map()
        this.structureStore = structureStore
    }

    /**
     * Create a merge for the given rectangle
     * Validates the merge before adding it
     */
    createMerge(rect: Rect): void {
        if (this.isValidMerge(rect)) {
            const {cellId} = rect
            this.mergeRegistry.set(cellId, rect)
        }
    }

    /**
     * Delete a merge by its root cell ID
     * The root cell ID is the primary key in the merge registry
     */
    deleteMerge(cellId: string): void {
        this.mergeRegistry.delete(cellId)
    }

    /**
     * Get merge by root cell ID
     * Returns the merge rectangle if it exists
     */
    getMergeByRootId(cellId: string): Rect | undefined {
        if (this.mergeRegistry.has(cellId)) {
            return this.mergeRegistry.get(cellId)
        }
    }

    /**
     * Find a merge that contains a specific cell by its ID
     * Returns the merge rectangle and the root cell ID if found
     * Useful when you have a cell ID and need to find its merge
     */
    findMergeByContainedCell(cellId: string): { rootCellId: string; merge: Rect } | undefined {
        // First check if this cell is a root cell of a merge
        if (this.mergeRegistry.has(cellId)) {
            const merge = this.mergeRegistry.get(cellId)!
            return { rootCellId: cellId, merge }
        }

        // If not a root, check all merges to see if this cell is contained within them
        // This requires accessing the table structure to check cell positions
        // For now, return undefined - this would need cellRegistry integration for full support
        return undefined
    }

    /**
     * Check if a cell is part of any merge
     * Returns true if the cell ID is a merge root
     */
    isMergeRoot(cellId: string): boolean {
        return this.mergeRegistry.has(cellId)
    }

    /**
     * Get all cells that are merge roots
     * These are the cellIds that have merges associated with them
     */
    getMergeRoots(): string[] {
        return Array.from(this.mergeRegistry.keys())
    }

    /**
     * Validate if a merge rectangle is valid for the table structure
     *
     * For body/undefined regions: validates against full table bounds
     * For header regions (theader, lheader, rheader, footer): skips strict validation
     * since header bounds are region-local and validated at layout time
     */
    isValidMerge(rect: Rect): boolean {
        const {startRow, startCol, endCol, endRow} = rect

        // Basic sanity checks (always required)
        if (startRow < 0 || startCol < 0) return false
        if (endRow < startRow || endCol < startCol) return false

        // For header regions, skip strict bounds validation
        // The layout engine will ignore out-of-bounds references safely
        // This allows header merges to be created without knowing all region dimensions
        if (rect.primaryRegion && rect.primaryRegion !== 'body') {
            return true
        }

        // For body region (or undefined), validate against full table bounds
        const maxPossibleRowsIndex = this.structureStore.countTotalRows() - 1
        const maxPossibleColsIndex = this.structureStore.countTotalCols() - 1

        return endCol <= maxPossibleColsIndex && endRow <= maxPossibleRowsIndex
    }

    private isChild(rect1: Rect, rect2: Rect): boolean {
        const {startRow: x1, startCol: y1, endRow: x2, endCol: y2} = rect1
        const {startRow: x3, startCol: y3, endRow: x4, endCol: y4} = rect2

        return x3 >= x1 && x4 <= x2 && y3 >= y1 && y4 <= y2
    }

    getMergeSet(): Map<string, Rect> {
        const rects = [...this.mergeRegistry.values()]

        rects.sort((a,b) =>  {
            if (a.startRow !== b.startRow) return a.startRow - b.startRow
            if (a.startCol !== b.startCol) return a.startCol - b.startCol
            if (a.endRow !== b.endRow) return b.endRow - a.endRow
            return b.endCol - a.endCol
        })

        const topLevel: Map<string, Rect> = new Map()
        let currentParent: Rect | null = null

        for (const rect of rects) {
            if (!currentParent || !this.isChild(currentParent, rect)) {
                topLevel.set(rect.cellId, rect)
                currentParent = rect
            }
        }

        return topLevel
    }
}
