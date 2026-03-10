/**
 * Palette Dictionary — what condition/result items users can pick per rule scope.
 * Canvas uses this to render the condition builder UI.
 * Engine evaluates the resulting expression strings; never reads this file.
 */

export type RuleScope = 'table' | 'region' | 'column' | 'row' | 'cell' | 'selection';
export type ReturnType = 'string' | 'number' | 'boolean';

/** A single palette item the user can pick from the condition builder */
export interface PaletteItem {
  /** Display label in canvas UI */
  label: string;
  /** The expression string to insert (e.g., "cell.value", "SUM(col:self)") */
  exprTemplate: string;
  /** What type this item evaluates to (for operator compatibility checking) */
  returnType: ReturnType;
  /** Whether this item needs additional parameters (e.g., CELL needs row, col) */
  requiresParams?: boolean;
  /** Help text for canvas tooltip */
  description?: string;
}

/**
 * Scope → Palette mapping.
 * When canvas user selects a scope, show only items from that scope's palette.
 */
export const SCOPE_VOCABULARY: Record<RuleScope, PaletteItem[]> = {
  /**
   * scope: 'table'
   * Condition evaluates once for the entire table (usually boolean aggregates).
   */
  table: [
    {
      label: 'Row count',
      exprTemplate: 'table.rowCount',
      returnType: 'number',
      description: 'Total number of body rows',
    },
    {
      label: 'Column count',
      exprTemplate: 'table.colCount',
      returnType: 'number',
      description: 'Total number of columns',
    },
    {
      label: 'Sum of column',
      exprTemplate: 'SUM(col:0)',
      returnType: 'number',
      requiresParams: true,
      description: 'Sum of numeric values in a column (pick column index)',
    },
    {
      label: 'Sum of body',
      exprTemplate: 'SUM(body)',
      returnType: 'number',
      description: 'Sum of all body cells',
    },
    {
      label: 'Count non-empty',
      exprTemplate: 'COUNT(body)',
      returnType: 'number',
      description: 'Count of non-empty cells in body',
    },
    {
      label: 'Average of column',
      exprTemplate: 'AVG(col:0)',
      returnType: 'number',
      requiresParams: true,
      description: 'Average of numeric values in a column',
    },
  ],

  /**
   * scope: 'region'
   * Condition evaluates per cell in the named region.
   */
  region: [
    {
      label: 'Cell value',
      exprTemplate: 'cell.value',
      returnType: 'string',
      description: 'Display value of this cell',
    },
    {
      label: 'Cell number',
      exprTemplate: 'cell.numericValue',
      returnType: 'number',
      description: 'Numeric value (parseFloat or 0)',
    },
    {
      label: 'Row index',
      exprTemplate: 'cell.rowIndex',
      returnType: 'number',
      description: 'Body row index of this cell (0-based)',
    },
    {
      label: 'Column index',
      exprTemplate: 'cell.colIndex',
      returnType: 'number',
      description: 'Column index of this cell (0-based)',
    },
    {
      label: 'Cell overflows',
      exprTemplate: 'cell.overflows',
      returnType: 'boolean',
      description: 'Whether text overflows cell bounds',
    },
    {
      label: 'Cell width',
      exprTemplate: 'cell.width',
      returnType: 'number',
      description: 'Layout width in mm',
    },
    {
      label: 'Cell height',
      exprTemplate: 'cell.height',
      returnType: 'number',
      description: 'Layout height in mm',
    },
    {
      label: 'Font size',
      exprTemplate: 'cell.fontSize',
      returnType: 'number',
      description: 'Current font size',
    },
    {
      label: 'Font name',
      exprTemplate: 'cell.fontName',
      returnType: 'string',
      description: 'Current font name',
    },
    {
      label: 'Font color',
      exprTemplate: 'cell.fontColor',
      returnType: 'string',
      description: 'Font color (hex)',
    },
    {
      label: 'Background color',
      exprTemplate: 'cell.backgroundColor',
      returnType: 'string',
      description: 'Background color (hex)',
    },
    {
      label: 'Bold',
      exprTemplate: 'cell.bold',
      returnType: 'boolean',
      description: 'Whether cell is bold',
    },
    {
      label: 'Italic',
      exprTemplate: 'cell.italic',
      returnType: 'boolean',
      description: 'Whether cell is italic',
    },
    {
      label: 'Alignment',
      exprTemplate: 'cell.alignment',
      returnType: 'string',
      description: 'Text alignment (left/center/right/justify)',
    },
  ],

  /**
   * scope: 'column'
   * Condition evaluates per cell in the target column.
   */
  column: [
    {
      label: 'Cell value',
      exprTemplate: 'cell.value',
      returnType: 'string',
      description: 'Display value of this cell',
    },
    {
      label: 'Cell number',
      exprTemplate: 'cell.numericValue',
      returnType: 'number',
      description: 'Numeric value (parseFloat or 0)',
    },
    {
      label: 'Row index',
      exprTemplate: 'cell.rowIndex',
      returnType: 'number',
      description: 'Which row this cell is in',
    },
    {
      label: 'Cell overflows',
      exprTemplate: 'cell.overflows',
      returnType: 'boolean',
      description: 'Whether text overflows cell bounds',
    },
    {
      label: 'Column sum',
      exprTemplate: 'SUM(col:self)',
      returnType: 'number',
      description: 'Sum of all cells in this column',
    },
    {
      label: 'Column average',
      exprTemplate: 'AVG(col:self)',
      returnType: 'number',
      description: 'Average of numeric cells in this column',
    },
    {
      label: 'Column max',
      exprTemplate: 'MAX(col:self)',
      returnType: 'number',
      description: 'Maximum value in this column',
    },
    {
      label: 'Column count',
      exprTemplate: 'COUNT(col:self)',
      returnType: 'number',
      description: 'Count of non-empty cells in this column',
    },
    {
      label: 'Another column sum',
      exprTemplate: 'SUM(col:0)',
      returnType: 'number',
      requiresParams: true,
      description: 'Sum of a different column (pick index)',
    },
  ],

  /**
   * scope: 'row'
   * Condition evaluates per cell in the target row.
   */
  row: [
    {
      label: 'Cell value',
      exprTemplate: 'cell.value',
      returnType: 'string',
      description: 'Display value of this cell',
    },
    {
      label: 'Cell number',
      exprTemplate: 'cell.numericValue',
      returnType: 'number',
      description: 'Numeric value (parseFloat or 0)',
    },
    {
      label: 'Column index',
      exprTemplate: 'cell.colIndex',
      returnType: 'number',
      description: 'Which column this cell is in',
    },
    {
      label: 'Cell overflows',
      exprTemplate: 'cell.overflows',
      returnType: 'boolean',
      description: 'Whether text overflows cell bounds',
    },
    {
      label: 'Row sum',
      exprTemplate: 'SUM(row:self)',
      returnType: 'number',
      description: 'Sum of all cells in this row',
    },
    {
      label: 'Row average',
      exprTemplate: 'AVG(row:self)',
      returnType: 'number',
      description: 'Average of numeric cells in this row',
    },
    {
      label: 'Row count',
      exprTemplate: 'COUNT(row:self)',
      returnType: 'number',
      description: 'Count of non-empty cells in this row',
    },
  ],

  /**
   * scope: 'cell'
   * Condition evaluates once for that specific cell.
   */
  cell: [
    {
      label: 'Value',
      exprTemplate: 'cell.value',
      returnType: 'string',
      description: 'Display value of the cell',
    },
    {
      label: 'Numeric value',
      exprTemplate: 'cell.numericValue',
      returnType: 'number',
      description: 'Numeric value (parseFloat or 0)',
    },
    {
      label: 'Row index',
      exprTemplate: 'cell.rowIndex',
      returnType: 'number',
      description: 'Body row index',
    },
    {
      label: 'Column index',
      exprTemplate: 'cell.colIndex',
      returnType: 'number',
      description: 'Column index',
    },
    {
      label: 'Width',
      exprTemplate: 'cell.width',
      returnType: 'number',
      description: 'Cell width in mm',
    },
    {
      label: 'Height',
      exprTemplate: 'cell.height',
      returnType: 'number',
      description: 'Cell height in mm',
    },
    {
      label: 'Font size',
      exprTemplate: 'cell.fontSize',
      returnType: 'number',
      description: 'Current font size',
    },
    {
      label: 'Overflows',
      exprTemplate: 'cell.overflows',
      returnType: 'boolean',
      description: 'Whether text overflows bounds',
    },
    {
      label: 'Another cell value',
      exprTemplate: 'CELL(0,0)',
      returnType: 'string',
      requiresParams: true,
      description: 'Get value from another cell (pick row, col)',
    },
    {
      label: 'Text height',
      exprTemplate: 'TEXT_HEIGHT(cell.value, cell.fontSize)',
      returnType: 'number',
      description: 'Estimated height of text in this cell',
    },
  ],

  /**
   * scope: 'selection'
   * Condition evaluates per cell in the rectangular selection.
   */
  selection: [
    {
      label: 'Cell value',
      exprTemplate: 'cell.value',
      returnType: 'string',
      description: 'Display value of this cell',
    },
    {
      label: 'Cell number',
      exprTemplate: 'cell.numericValue',
      returnType: 'number',
      description: 'Numeric value (parseFloat or 0)',
    },
    {
      label: 'Cell overflows',
      exprTemplate: 'cell.overflows',
      returnType: 'boolean',
      description: 'Whether text overflows bounds',
    },
    {
      label: 'Selection sum',
      exprTemplate: 'SUM(self)',
      returnType: 'number',
      description: 'Sum of all cells in selection',
    },
    {
      label: 'Selection count',
      exprTemplate: 'COUNT(self)',
      returnType: 'number',
      description: 'Count of non-empty cells in selection',
    },
    {
      label: 'Selection average',
      exprTemplate: 'AVG(self)',
      returnType: 'number',
      description: 'Average of numeric cells in selection',
    },
  ],
};
