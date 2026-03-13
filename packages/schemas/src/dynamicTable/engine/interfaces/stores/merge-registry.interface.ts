import { Rect } from "../../types/common";

export interface IMergeRegistry {
    //keep private in class
    // mergeRegistry: Map<string, MergeRegion>

    //it will take all the cells and the root will be the minimum of col or row

    /**
     * Create a merge for the given rectangle of cells
     */
    createMerge(rect: Rect): void

    /**
     * Validate if a merge rectangle is valid for the current table structure
     */
    isValidMerge(rect: Rect): boolean

    /**
     * Get merge by root cell ID
     * Returns the merge rectangle if it exists
     */
    getMergeByRootId(cellId: string): Rect | undefined

    /**
     * Delete a merge by its root cell ID
     * After deletion, cells are unmerged and layout must be rebuilt
     */
    deleteMerge(cellId: string): void

    /**
     * Get all merges organized as top-level rects
     * Filters nested merges to only return the parent merges
     */
    getMergeSet(): Map<string, Rect>

    /**
     * Find a merge that contains a specific cell
     * Returns the root cell ID and merge rectangle if found
     */
    findMergeByContainedCell(cellId: string): { rootCellId: string; merge: Rect } | undefined

    /**
     * Check if a cell ID is a merge root
     */
    isMergeRoot(cellId: string): boolean

    /**
     * Get all cell IDs that are merge roots
     */
    getMergeRoots(): string[]
}