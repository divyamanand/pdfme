import type { PDFRenderProps } from '@pdfme/common';
import type { ExpressionFieldSchema } from './types.js';
import { pdfRender as textPdfRender } from '../text/pdfRender.js';
import type { TextSchema } from '../text/types.js';

/**
 * PDF rendering for Expression Field.
 *
 * The generator has already evaluated the expression before calling this
 * function — `arg.value` contains the resolved string (e.g. "50" instead
 * of "{Number(price) * quantity}").  We simply delegate to the text
 * plugin's pdfRender which handles fonts, alignment, colours, etc.
 */
export const pdfRender = async (arg: PDFRenderProps<ExpressionFieldSchema>) => {
  await textPdfRender(arg as unknown as PDFRenderProps<TextSchema>);
};
