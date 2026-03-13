import { QrCode, Barcode } from 'lucide';
import type { Plugin } from '@pdfme/common';
import type { VariableBarcodeSchema } from './types.js';
import type { BarcodeTypes } from '../barcodes/types.js';
import { BARCODE_TYPES } from '../barcodes/constants.js';
import { createSvgStr } from '../utils.js';
import { pdfRender } from './pdfRender.js';
import { uiRender } from './uiRender.js';
import { getPropPanelByType } from './propPanel.js';

const variableBarcodes = BARCODE_TYPES.reduce(
  (acc, type) =>
    Object.assign(acc, {
      [type]: {
        pdf: pdfRender,
        ui: uiRender,
        propPanel: getPropPanelByType(type),
        icon: createSvgStr(type === 'qrcode' ? QrCode : Barcode),
      } satisfies Plugin<VariableBarcodeSchema>,
    }),
  {} as Record<BarcodeTypes, Plugin<VariableBarcodeSchema>>,
);

export const dynamicQrCode = variableBarcodes['qrcode'];
export const dynamicBarcode = variableBarcodes['code128'];
export default variableBarcodes;
