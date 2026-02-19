import type { Schema } from '@pdfme/common';

export type ALIGNMENT = 'left' | 'center' | 'right';
export type VERTICAL_ALIGNMENT = 'top' | 'middle' | 'bottom';

export interface ExpressionFieldSchema extends Schema {
  content: string; // Stored as "{{expression}}", e.g. "{{Number(price) * qty}}"
  readOnly: true; // Always true — expression is always calculated
  fontName?: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  alignment: ALIGNMENT;
  verticalAlignment: VERTICAL_ALIGNMENT;
  lineHeight: number;
  characterSpacing: number;
}
