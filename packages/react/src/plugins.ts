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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const plugins: Record<string, any> = {
  Text: multiVariableText,
  Image: image,
  Table: dynamicTable,
  Line: line,
  Rectangle: rectangle,
  Ellipse: ellipse,
  QR: dynamicQrCode,
  Barcode: dynamicBarcode,
} as const;
