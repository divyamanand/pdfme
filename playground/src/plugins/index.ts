import {
  multiVariableText,
  barcodes,
  image,
  line,
  rectangle,
  ellipse,
  dynamicTable
} from '@pdfme/schemas';
import { signature } from './signature';

export const getPlugins = () => {
  return {
    Text: multiVariableText,
    Table: dynamicTable,
    Line: line,
    Rectangle: rectangle,
    Ellipse: ellipse,
    Image: image,
    Signature: signature,
    QR: barcodes.qrcode,
    Barcode: barcodes.code128,
  };
};
