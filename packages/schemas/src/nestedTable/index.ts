import type { Plugin } from '@pdfme/common';
import type { NestedTableSchema } from './types.js';
import { pdfRender } from './pdfRender.js';
import { uiRender } from './uiRender.js';
import { propPanel } from './propPanel.js';
import { Grid } from 'lucide';
import { createSvgStr } from '../utils.js';

const nestedTable: Plugin<NestedTableSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon: createSvgStr(Grid),
};

export default nestedTable;
