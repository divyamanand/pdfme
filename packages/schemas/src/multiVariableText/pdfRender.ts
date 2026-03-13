import { PDFRenderProps } from '@pdfme/common';
import { MultiVariableTextSchema } from './types.js';
import { pdfRender as parentPdfRender } from '../text/pdfRender.js';
import { substituteVariables, validateVariables } from './helper.js';

export const pdfRender = async (arg: PDFRenderProps<MultiVariableTextSchema>) => {
  const { value, schema, pageContext, ...rest } = arg;

  // Static mode: no template text → render value directly as plain text
  if (!schema.text) {
    await parentPdfRender({ value, schema, pageContext, ...rest });
    return;
  }

  // Dynamic mode: substitute variables in template
  if (!validateVariables(value, schema)) {
    return;
  }

  const renderArgs = {
    value: substituteVariables(schema.text, value || '{}', pageContext),
    schema,
    pageContext,
    ...rest,
  };

  await parentPdfRender(renderArgs);
};
