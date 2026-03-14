import type {
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
} from '@pdfme/common';

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
};

export type TemplateVariable = { label: string; value: string };

export type TemplateVariables = {
  textVariables: TemplateVariable[];
  imageVariables: TemplateVariable[];
};

export type PdfmeProviderProps = {
  template: Template;
  plugins: Record<string, Plugin>;
  options?: UIOptions & { variables?: TemplateVariables };
  children: React.ReactNode;
};

export type DesignerContextValue = {
  // State
  schemasList: SchemaForUI[][];
  pageCursor: number;
  activeElements: HTMLElement[];
  hoveringSchemaId: string | null;
  zoomLevel: number;
  sidebarOpen: boolean;
  scale: number;
  backgrounds: string[];
  pageSizes: Size[];
  currentBasePdf: BasePdf;
  size: Size;
  error: Error | null;

  // Refs
  containerRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLDivElement>;
  paperRefs: React.MutableRefObject<HTMLDivElement[]>;

  // Schema CRUD
  commitSchemas: (newSchemas: SchemaForUI[]) => void;
  changeSchemas: ChangeSchemas;
  removeSchemas: (ids: string[]) => void;
  addSchema: (defaultSchema: Schema) => void;

  // Selection
  onEdit: (targets: HTMLElement[]) => void;
  onEditEnd: () => void;
  onChangeHoveringSchemaId: (id: string | null) => void;
  onSortEnd: (sortedSchemas: SchemaForUI[]) => void;

  // Page management
  setPageCursor: (page: number) => void;
  addPageAfter: () => void;
  removePage: () => void;
  clonePageAfter: () => void;
  handleChangePageSize: (w: number, h: number) => void;
  handleChangePadding: (padding: [number, number, number, number]) => void;
  handleChangeBasePdf: (basePdf: BasePdf) => void;

  // Zoom & UI
  setZoomLevel: (level: number) => void;
  setSidebarOpen: (open: boolean) => void;

  // Template
  getTemplate: () => Template;
  updateTemplate: (t: Template) => Promise<void>;

  // Callbacks
  onChangeTemplateCallback: React.MutableRefObject<((t: Template) => void) | undefined>;
  onSaveTemplateCallback: React.MutableRefObject<((t: Template) => void) | undefined>;
  onPageChangeCallback: React.MutableRefObject<
    ((info: { pageCursor: number; totalPages: number }) => void) | undefined
  >;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};
