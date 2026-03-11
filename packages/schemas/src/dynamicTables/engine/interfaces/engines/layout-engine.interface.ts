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

    // Footer dimension arrays (independent from main grid)
    setFooterColumnWidth(colIndex: number, width: number): void
    setFooterRowHeight(rowIndex: number, height: number): void
    insertFooterColumnWidth(colIndex: number, width: number): void
    removeFooterColumnWidth(colIndex: number): void
    insertFooterRowHeight(rowIndex: number, height: number): void
    removeFooterRowHeight(rowIndex: number): void
    getFooterColumnWidths(): number[]
    getFooterRowHeights(): number[]

    // Table position (renderer offset)
    setTablePosition(position: TablePosition): void
    getTablePosition(): TablePosition

    getCompleteGrid(): string[][]
}
