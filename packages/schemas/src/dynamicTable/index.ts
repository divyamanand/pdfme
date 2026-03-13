import type { Plugin } from '@pdfme/common';
import type { DynamicTableSchema } from './types.js';
import { pdfRender } from './pdfRender.js';
import { uiRender } from './uiRender.js';
import { propPanel } from './propPanel.js';
import { createSvgStr } from '../utils.js';
import { Table } from 'lucide';

const dynamicTableSchema: Plugin<DynamicTableSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon: createSvgStr(Table),
  uninterruptedEditMode: true,
};
export default dynamicTableSchema;
