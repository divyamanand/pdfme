import multiVariableText from './multiVariableText/index.js';
import text from './text/index.js';
import image from './graphics/image.js';
import svg from './graphics/svg.js';
import { signature } from './graphics/signature.js';
import barcodes from './barcodes/index.js';
import line from './shapes/line.js';
import table from './tables/index.js';
import { rectangle, ellipse } from './shapes/rectAndEllipse.js';
import dateTime from './date/dateTime.js';
import date from './date/date.js';
import time from './date/time.js';
import select from './select/index.js';
import radioGroup from './radioGroup/index.js';
import checkbox from './checkbox/index.js';
import dynamicTable from './dynamicTable/index.js';
import variableBarcodes, { dynamicQrCode, dynamicBarcode } from './variableBarcode/index.js';

const builtInPlugins = { Text: multiVariableText };

export {
  builtInPlugins,
  // schemas
  text,
  multiVariableText,
  image,
  svg,
  signature,
  table,
  barcodes,
  line,
  rectangle,
  ellipse,
  dateTime,
  date,
  time,
  select,
  radioGroup,
  checkbox,
  dynamicTable,
  variableBarcodes,
  dynamicQrCode,
  dynamicBarcode,
};

// Export utility functions
export { getDynamicHeightsForTable } from './tables/dynamicTemplate.js';
