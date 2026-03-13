/**
 * Maps RenderableCell (our type) → PdfmeCellSchema (pdfme-compatible type).
 *
 * This is the bridge between our style system and pdfme's rendering system.
 * Our CellStyle maps ~1:1 to pdfme's CellStyle / CellSchema.
 */

import type { RenderableCell } from '../engine/index.js';
import type { PdfmeCellSchema } from '../types.js';

/**
 * Convert a RenderableCell to a PdfmeCellSchema for delegation to pdfme renderers.
 *
 * @param cell — The RenderableCell with fully resolved style and layout
 * @param tableOffsetX — The table's X offset on the page/canvas (schema.position.x)
 * @param tableOffsetY — The table's Y offset on the page/canvas (schema.position.y)
 */
export function toPdfmeCellSchema(
  cell: RenderableCell,
  tableOffsetX: number,
  tableOffsetY: number,
): PdfmeCellSchema {
  const { layout, style } = cell;

  return {
    name: '',
    type: 'cell',
    position: {
      x: tableOffsetX + layout.x,
      y: tableOffsetY + layout.y,
    },
    width: layout.width,
    height: layout.height,

    // Font
    fontName: style.fontName,
    bold: style.bold,
    italic: style.italic,

    // Alignment
    alignment: style.alignment,
    verticalAlignment: style.verticalAlignment,

    // Text metrics
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    characterSpacing: style.characterSpacing,

    // Colors
    fontColor: style.fontColor,
    backgroundColor: style.backgroundColor,

    // Borders
    borderColor: style.borderColor,
    borderWidth: { ...style.borderWidth },

    // Padding
    padding: { ...style.padding },
  };
}

/**
 * Get the display value for a RenderableCell.
 * Uses computedValue for dynamic cells, rawValue otherwise.
 */
export function getCellDisplayValue(cell: RenderableCell): string {
  const value = cell.isDynamic
    ? (cell.computedValue ?? cell.rawValue)
    : cell.rawValue;
  return String(value);
}
