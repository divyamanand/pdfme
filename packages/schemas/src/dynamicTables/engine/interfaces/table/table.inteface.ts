import { ICell } from "../core"
import { CellPayload, CellStyle, Region, TableSettings, TablePosition, TableStyle, RegionStyle, BodyRegionStyle, RegionStyleMap, UIState } from "../../types"
import { Rect } from "../../types/common"
import type { IRuleEngine } from "../rules/rule-engine.interface"
import type { EvaluationResult } from "../../rules/types/evaluation.types"
import type { TableExportData } from "../../renderers/types/serialization.types"
import type { RenderableTableInstance } from "../../renderers/types/renderable-types"

export interface ITable {
    // Header operations
    addHeaderCell(region: Region, parentId?: string, index?: number): string
    removeHeaderCell(cellId: string, region: Region, isRoot: boolean, parentId?: string): void

    // Body operations
    buildBody(data: (string | number)[][]): void
    insertBodyRow(rowIndex: number, data?: (string | number)[]): 'added' | 'max-reached'
    removeBodyRow(rowIndex: number): 'removed' | 'cleared'
    insertBodyCol(colIndex: number, data?: (string | number)[]): 'added' | 'max-reached'
    removeBodyCol(colIndex: number): 'removed' | 'cleared'

    // Cell access
    getCellById(cellId: string): ICell | undefined
    getCellByAddress(row: number, col: number): ICell | undefined
    updateCell(cellId: string, payload: CellPayload): void

    // Merge
    mergeCells(rect: Rect): void
    unmergeCells(cellId: string): void
    getMerges(): Map<string, Rect>

    // Settings (logical config only)
    getSettings(): TableSettings
    updateSettings(settings: Partial<TableSettings>): string | null

    // Styles
    getTableStyle(): TableStyle
    setTableStyle(style: Partial<TableStyle>): void
    getRegionStyles(): RegionStyleMap
    getRegionStyle(region: Region): RegionStyle | BodyRegionStyle | undefined
    setRegionStyle(region: Region, style: RegionStyle | BodyRegionStyle): void

    // Geometry
    setColumnWidth(colIndex: number, width: number): void
    setRowHeight(rowIndex: number, height: number): void
    setDefaultCellWidth(width: number): void
    setDefaultCellHeight(height: number): void
    getColumnWidths(): number[]
    getRowHeights(): number[]
    setTablePosition(position: TablePosition): void
    getTablePosition(): TablePosition

    // Footer Geometry (independent)
    setFooterColumnWidth(colIndex: number, width: number): void
    setFooterRowHeight(rowIndex: number, height: number): void
    getFooterColumnWidths(): number[]
    getFooterRowHeights(): number[]

    // Layout
    getCompleteGrid(): string[][]

    getEvaluationResult(cellId: string): EvaluationResult | undefined

    // Overflow style patches (engine-computed, not user-set)
    getOverflowStylePatch(cellId: string): Partial<CellStyle> | undefined

    // Serialization
    exportState(): TableExportData

    // UI State (transient)
    getUIState(): UIState
    startEditing(cellId: string): void
    stopEditing(): void
    selectCell(cellId: string): void
    selectCells(cellIds: string[]): void
    setSelectionAnchor(anchor: { row: number; col: number; region: string } | null): void
    clearSelection(): void
    resetUIState(): void

    // Render snapshot
    getRenderSnapshot(): RenderableTableInstance

    // Aliases
    toJSON(): string
}
