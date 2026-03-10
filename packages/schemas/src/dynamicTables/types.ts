import type { Schema } from '@pdfme/common';

export const SCHEMA_TYPE = 'dynamicTable' as const;

/**
 * Schema for the dynamic table plugin.
 * Extends pdfme's base Schema with table-specific display options.
 * The actual table data lives in the `value` field (JSON-encoded TableExportData).
 */
export interface DynamicTableSchema extends Schema {
  type: typeof SCHEMA_TYPE;
  showGridLines?: boolean;
}

/**
 * Maps our CellStyle to pdfme's cell schema shape.
 * Used when delegating rendering to pdfme's cell/text/rectangle/line renderers.
 */
export interface PdfmeCellSchema extends Schema {
  fontName?: string;
  bold?: boolean;
  italic?: boolean;
  alignment: string;
  verticalAlignment: string;
  fontSize: number;
  lineHeight: number;
  characterSpacing: number;
  fontColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
}
