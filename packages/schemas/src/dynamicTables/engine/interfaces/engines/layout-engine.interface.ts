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

    // Dimension arrays (LayoutEngine owns these)
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

    // Table position (renderer offset)
    setTablePosition(position: TablePosition): void
    getTablePosition(): TablePosition

    getCompleteGrid(): string[][]
}
