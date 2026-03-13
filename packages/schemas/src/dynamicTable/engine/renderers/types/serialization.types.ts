import type { CellStyle, OverflowMode, Rect, Region, TableSettings, TableStyle, RegionStyleMap } from '../../types'
import type { RulePayload } from '../../rules/types/rule.types'

/**
 * JSON-serializable representation of a header tree node.
 * Used only for transport/storage — at runtime, StructureStore is the source of truth.
 */
export interface SerializedHeaderNode {
  cellId: string
  rawValue: string | number
  style: Partial<CellStyle>
  overflow?: OverflowMode
  isDynamic: boolean
  computedValue?: string | number
  children: SerializedHeaderNode[]
}

/**
 * Serialized body cell data (one entry per body grid position).
 */
export interface SerializedBodyCell {
  cellId: string
  rawValue: string | number
  style: Partial<CellStyle>
  overflow?: OverflowMode
  isDynamic: boolean
  computedValue?: string | number
}

/**
 * Complete export of a Table's state — everything needed to reconstruct
 * the Table instance from scratch.
 *
 * CellLayout is NOT included because it is always recomputed by LayoutEngine.rebuild().
 */
export interface TableExportData {
  headerTrees: Record<'theader' | 'lheader' | 'rheader', SerializedHeaderNode[]>
  footer: SerializedBodyCell[][]         // flat 2D array (independent per-row cells)
  body: SerializedBodyCell[][]
  merges: Rect[]
  settings: TableSettings
  tableStyle: TableStyle
  regionStyles: RegionStyleMap
  columnWidths: number[]
  rowHeights: number[]
  footerCellWidths: number[][]           // per-cell widths (replaces footerColumnWidths)
  footerRowHeights: number[]
  rules: RulePayload[]
}
