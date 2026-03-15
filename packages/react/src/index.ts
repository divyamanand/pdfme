// Components
export { PdfmeProvider } from './PdfmeProvider.js';
export { Canvas } from './Canvas.js';
export type { CanvasProps } from './Canvas.js';
export { PropPanel } from './PropPanel.js';
export type { PropPanelProps } from './PropPanel.js';
export { SchemaList } from './SchemaList.js';
export type { SchemaListProps } from './SchemaList.js';

// Hooks
export { useDesigner } from './useDesigner.js';
export { useDesignerContext } from './useDesignerContext.js';

// Utilities
export { convertPdfToBase64 } from './utils.js';

// Extra exports specifically for Print Designer
export { generate } from '@pdfme/generator';
export { getInputFromTemplate, getDefaultFont, getBuiltinFontsData, getAllFonts } from '@pdfme/common';

// Plugins
export { plugins } from './plugins.js';

// Types
export type {
  Template,
  Schema,
  SchemaForUI,
  ChangeSchemas,
  Size,
  BasePdf,
  Font,
  Lang,
  UIOptions,
  Plugin,
  PluginRegistry,
  PdfmeProviderProps,
  DesignerContextValue,
  TemplateVariable,
  TemplateVariables,
} from './types.js';
