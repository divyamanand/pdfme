import type { BarcodeSchema } from '../barcodes/types.js';

export interface VariableBarcodeSchema extends BarcodeSchema {
  /** Template string with {variable} placeholders and/or JS expressions. */
  text: string;
  /** Simple-identifier variable names extracted from text — drives form-mode inputs. */
  variables: string[];
  // schema.content stores JSON of variable values: '{"orderId":"ABC","userId":"U42"}'
}
