import type { Plugin } from '@pdfme/common';
import { pdfRender } from './pdfRender.js';
import { uiRender } from './uiRender.js';
import { propPanel } from './propPanel.js';
import type { ExpressionFieldSchema } from './types.js';
import { Braces } from 'lucide';
import { createSvgStr } from '../utils.js';

const expressionField: Plugin<ExpressionFieldSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon: createSvgStr(Braces),
};

export default expressionField;
