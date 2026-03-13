import { Region, TablePosition } from "../../types"

export interface ILayoutEngine {
    // Full rebuild: layout + geometry
    rebuild(): void

    // Individual phases (for optimized updates)
    rebuildLayout(): void
    rebuildGeometry(): void

    // Layout methods (existing)
    applyHeaderLayout(region: Region, rowOffset: number, colOffset: number): void
    applyBodyLayout(rowOffset: number, colOffset: number): void

    // Main grid dimension arrays (theader + lheader + rheader + body)
    setColumnWidth(colIndex: number, width: number): void
    setRowHeight(rowIndex: number, height: number): void
    insertColumnWidth(colIndex: number, width: number): void
    removeColumnWidth(colIndex: number): void
    insertRowHeight(rowIndex: number, height: number): void
    removeRowHeight(rowIndex: number): void
    setDefaultCellWidth(width: number): void
    setDefaultCellHeight(height: number): void
    getDefaultCellWidth(): number
    getDefaultCellHeight(): number
    getColumnWidths(): number[]
    getRowHeights(): number[]

    // Footer dimension arrays (independent from main grid, per-cell per-row)
    setFooterRowHeight(rowIndex: number, height: number): void
    getFooterRowHeights(): number[]

    // Footer cell dimensions (per-cell, independent per row)
    getFooterCellWidths(): number[][]
    setFooterCellWidth(rowIndex: number, colIndex: number, width: number): void
    insertFooterCell(rowIndex: number, colIndex: number, width: number): void
    removeFooterCell(rowIndex: number, colIndex: number): void
    insertFooterRow(rowIndex: number, height: number): void
    removeFooterRow(rowIndex: number): void

    // Table position (renderer offset)
    setTablePosition(position: TablePosition): void
    getTablePosition(): TablePosition

    getCompleteGrid(): string[][]

    // Constraint enforcement (called from Table.rebuildAndEvaluate)
    enforceMinRows(minRows: number): void
    enforceMaxRows(maxRows: number): void
    enforceMinCols(minCols: number): void
    enforceMaxCols(maxCols: number): void

    // Reset all dimension arrays to default values
    resetDimensionsToDefaults(): void
}
