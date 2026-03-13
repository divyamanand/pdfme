import {
  multiVariableText,
  image,
  line,
  rectangle,
  ellipse,
  dynamicTable,
  dynamicQrCode,
  dynamicBarcode,
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
    QR: dynamicQrCode,
    Barcode: dynamicBarcode,
  };
};
