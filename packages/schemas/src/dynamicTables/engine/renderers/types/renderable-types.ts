import { CellLayout, CellStyle, TableSettings, TableStyle, RegionStyleMap, Region, Rect } from "../../types"
import { EvaluationResult } from "../../rules/types/evaluation.types"

/**
 * Renderable version of a cell - optimized for rendering
 * Contains all calculated and style information needed by renderers.
 * style is the fully resolved CellStyle (after cascade).
 */
export interface RenderableCell {
  // Cell identity
  cellID: string
  rawValue: string | number
  computedValue?: string | number

  // Layout (calculated by layout engine)
  layout: CellLayout  // row, col, rowSpan, colSpan, x, y, width, height

  // Styling (fully resolved via cascade: default → region → cell → rules)
  style: CellStyle

  // Region (theader, lheader, rheader, footer, body)
  inRegion: Region

  // Rule evaluation result (if dynamic)
  evaluationResult?: EvaluationResult
  isDynamic: boolean

  // Merge info (if part of a merge)
  mergeRect?: Rect
}

/**
 * Renderable row - groups cells that belong to same row
 */
export interface RenderableRow {
  rowIndex: number
  region: Region
  height: number  // calculated row height

  // Cells keyed by column index for fast access
  cells: Map<number, RenderableCell>

  // Raw row values (for export/debugging)
  rawValues: (string | number)[]
}

/**
 * Column information with calculated width
 */
export interface RenderableColumn {
  colIndex: number
  width: number  // calculated column width
}

/**
 * Renderable merge - tracks merged cell regions
 */
export interface RenderableMerge {
  cellID: string
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  primaryRegion: Region
}

/**
 * Complete renderable table instance
 * Everything needed to render without touching the Table facade
 */
export interface RenderableTableInstance {
  // Settings and styling
  settings: TableSettings
  tableStyle: TableStyle
  regionStyles: RegionStyleMap

  // Structural
  columns: RenderableColumn[]

  // Regions as maps for efficient access
  regions: {
    theader: RenderableRow[]
    lheader: RenderableRow[]
    rheader: RenderableRow[]
    footer: RenderableRow[]
    body: RenderableRow[]
  }

  // All cells by ID for quick lookup
  cellsById: Map<string, RenderableCell>

  // Merges
  merges: RenderableMerge[]

  // Rule results
  evaluationResults: Map<string, EvaluationResult>

  // Helper methods
  getCellAt(row: number, col: number, region: Region): RenderableCell | undefined
  getCellByID(cellID: string): RenderableCell | undefined
  getRowsInRegion(region: Region): RenderableRow[]
  getWidth(): number
  getHeight(): number
  getHeadHeight(): number
  getBodyHeight(): number
  getFooterHeight(): number
}
