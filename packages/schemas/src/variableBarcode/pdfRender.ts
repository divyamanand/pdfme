import { PDFRenderProps } from '@pdfme/common';
import { PDFImage } from '@pdfme/pdf-lib';
import { convertForPdfLayoutProps } from '../utils.js';
import { createBarCode, validateBarcodeInput } from '../barcodes/helper.js';
import { substituteVariables } from '../multiVariableText/helper.js';
import type { VariableBarcodeSchema } from './types.js';

const getCacheKey = (schema: VariableBarcodeSchema, resolved: string) =>
  `vb:${schema.type}:${schema.backgroundColor}:${schema.barColor}:${schema.textColor}:${resolved}:${schema.includetext}`;

export const pdfRender = async (arg: PDFRenderProps<VariableBarcodeSchema>): Promise<void> => {
  const { value, schema, pdfDoc, page, _cache, pageContext } = arg;

  // Dynamic mode: schema.text has a template → resolve with variables from value
  // Static mode: no schema.text → use value directly as barcode input
  const resolved = schema.text
    ? substituteVariables(schema.text, value || '{}', pageContext)
    : value || '';

  if (!resolved || !validateBarcodeInput(schema.type, resolved)) return;

  const cacheKey = getCacheKey(schema, resolved);
  let image = _cache.get(cacheKey) as PDFImage | undefined;
  if (!image) {
    const imageBuf = await createBarCode({ ...schema, type: schema.type, input: resolved });
    image = await pdfDoc.embedPng(imageBuf);
    _cache.set(cacheKey, image);
  }

  const pageHeight = page.getHeight();
  const {
    width,
    height,
    rotate,
    position: { x, y },
    opacity,
  } = convertForPdfLayoutProps({ schema, pageHeight });

  page.drawImage(image, { x, y, rotate, width, height, opacity });
};
