import React, {
  createContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import {
  cloneDeep,
  ZOOM,
  Template,
  Schema,
  SchemaForUI,
  Size,
  isBlankPdf,
  px2mm,
  pluginRegistry,
  getDefaultFont,
} from '@pdfme/common';
import type { PdfmeProviderProps, DesignerContextValue } from './types.js';

// ---------- Re-use internal modules from @pdfme/ui ----------
// These are imported from @pdfme/ui's source files directly.
// The @pdfme/react package sits alongside @pdfme/ui in the monorepo,
// so we import from the built output or source via tsconfig paths.
import AppContextProvider from '../../ui/src/components/AppContextProvider.js';
import {
  schemasList2template,
  uuid,
  template2SchemasList,
  getPagesScrollTopByIndex,
  changeSchemas as _changeSchemas,
  useMaxZoom,
} from '../../ui/src/helper.js';
import {
  useUIPreProcessor,
  useScrollPageCursor,
  useInitEvents,
} from '../../ui/src/hooks.js';
import { I18nContext, OptionsContext, PluginsRegistry } from '../../ui/src/contexts.js';
import { RULER_HEIGHT } from '../../ui/src/constants.js';

export const DesignerContext = createContext<DesignerContextValue | null>(null);

const DesignerStateManager = ({
  template: templateProp,
  children,
}: {
  template: Template;
  children: React.ReactNode;
}) => {
  const past = useRef<SchemaForUI[][]>([]);
  const future = useRef<SchemaForUI[][]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const paperRefs = useRef<HTMLDivElement[]>([]);

  const i18n = useContext(I18nContext);
  const pluginsReg = useContext(PluginsRegistry);
  const options = useContext(OptionsContext);
  const maxZoom = useMaxZoom();

  const [hoveringSchemaId, setHoveringSchemaId] = useState<string | null>(null);
  const [activeElements, setActiveElements] = useState<HTMLElement[]>([]);
  const [schemasList, setSchemasList] = useState<SchemaForUI[][]>([[]] as SchemaForUI[][]);
  const [pageCursor, setPageCursor] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(options.zoomLevel ?? 1);
  const [sidebarOpen, setSidebarOpen] = useState(options.sidebarOpen ?? true);
  const [prevTemplate, setPrevTemplate] = useState<Template | null>(null);
  const [currentBasePdf, setCurrentBasePdf] = useState(templateProp.basePdf);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });

  // Callback refs
  const onChangeTemplateCallback = useRef<((t: Template) => void) | undefined>();
  const onSaveTemplateCallback = useRef<((t: Template) => void) | undefined>();
  const onPageChangeCallback = useRef<
    ((info: { pageCursor: number; totalPages: number }) => void) | undefined
  >();

  // Resize observer for the canvas container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { backgrounds, pageSizes, scale, error, refresh } = useUIPreProcessor({
    template: templateProp,
    size,
    zoomLevel,
    maxZoom,
  });

  const onEdit = useCallback((targets: HTMLElement[]) => {
    setActiveElements(targets);
    setHoveringSchemaId(null);
  }, []);

  const onEditEnd = useCallback(() => {
    setActiveElements([]);
    setHoveringSchemaId(null);
  }, []);

  useEffect(() => {
    if (typeof options.zoomLevel === 'number' && options.zoomLevel !== zoomLevel) {
      setZoomLevel(options.zoomLevel);
    }
    if (typeof options.sidebarOpen === 'boolean' && options.sidebarOpen !== sidebarOpen) {
      setSidebarOpen(options.sidebarOpen);
    }
    // eslint-disable-next-line
  }, [options]);

  useScrollPageCursor({
    ref: canvasRef,
    pageSizes,
    scale,
    pageCursor,
    onChangePageCursor: (p) => {
      setPageCursor(p);
      onPageChangeCallback.current?.({ pageCursor: p, totalPages: schemasList.length });
      onEditEnd();
    },
  });

  const _onChangeTemplate = useCallback(
    (t: Template) => {
      onChangeTemplateCallback.current?.(t);
    },
    [],
  );

  const _onSaveTemplate = useCallback(
    (t: Template) => {
      onSaveTemplateCallback.current?.(t);
    },
    [],
  );

  const commitSchemas = useCallback(
    (newSchemas: SchemaForUI[]) => {
      future.current = [];
      past.current.push(cloneDeep(schemasList[pageCursor]));
      const _schemasList = cloneDeep(schemasList);
      _schemasList[pageCursor] = newSchemas;
      setSchemasList(_schemasList);
      _onChangeTemplate(schemasList2template(_schemasList, currentBasePdf));
    },
    [schemasList, pageCursor, _onChangeTemplate, currentBasePdf],
  );

  const removeSchemas = useCallback(
    (ids: string[]) => {
      commitSchemas(schemasList[pageCursor].filter((schema) => !ids.includes(schema.id)));
      onEditEnd();
    },
    [schemasList, pageCursor, commitSchemas, onEditEnd],
  );

  const changeSchemas = useCallback(
    (objs: { key: string; value: unknown; schemaId: string }[]) => {
      _changeSchemas({
        objs,
        schemas: schemasList[pageCursor],
        basePdf: currentBasePdf,
        pluginsRegistry: pluginsReg,
        pageSize: pageSizes[pageCursor],
        commitSchemas,
      });
    },
    [commitSchemas, pageCursor, schemasList, pluginsReg, pageSizes, currentBasePdf],
  );

  useInitEvents({
    pageCursor,
    pageSizes,
    activeElements,
    template: templateProp,
    schemasList,
    changeSchemas,
    commitSchemas,
    removeSchemas,
    onSaveTemplate: (t) => _onSaveTemplate(t),
    past,
    future,
    setSchemasList,
    onEdit,
    onEditEnd,
  });

  const updateTemplate = useCallback(async (newTemplate: Template) => {
    const sl = await template2SchemasList(newTemplate);
    setSchemasList(sl);
    onEditEnd();
    setPageCursor(0);
    if (canvasRef.current?.scroll) {
      canvasRef.current.scroll({ top: 0, behavior: 'smooth' });
    }
  }, [onEditEnd]);

  const addSchema = useCallback(
    (defaultSchema: Schema) => {
      const [paddingTop, paddingRight, paddingBottom, paddingLeft] = isBlankPdf(currentBasePdf)
        ? currentBasePdf.padding
        : [0, 0, 0, 0];
      const pageSize = pageSizes[pageCursor];

      const newSchemaName = (prefix: string) => {
        let index = schemasList.reduce((acc, page) => acc + page.length, 1);
        let newName = prefix + index;
        while (schemasList.some((page) => page.find((s) => s.name === newName))) {
          index++;
          newName = prefix + index;
        }
        return newName;
      };
      const ensureMiddleValue = (min: number, value: number, max: number) =>
        Math.min(Math.max(min, value), max);

      const s = {
        id: uuid(),
        ...defaultSchema,
        name: newSchemaName(i18n('field')),
        position: {
          x: ensureMiddleValue(
            paddingLeft,
            defaultSchema.position.x,
            pageSize.width - paddingRight - defaultSchema.width,
          ),
          y: ensureMiddleValue(
            paddingTop,
            defaultSchema.position.y,
            pageSize.height - paddingBottom - defaultSchema.height,
          ),
        },
        required: defaultSchema.readOnly
          ? false
          : options.requiredByDefault || defaultSchema.required || false,
      } as SchemaForUI;

      if (defaultSchema.position.y === 0) {
        const paper = paperRefs.current[pageCursor];
        const rectTop = paper ? paper.getBoundingClientRect().top : 0;
        s.position.y = rectTop > 0 ? paddingTop : pageSizes[pageCursor].height / 2;
      }

      commitSchemas(schemasList[pageCursor].concat(s));
      const newElement = document.getElementById(s.id);
      if (newElement) onEdit([newElement]);
    },
    [currentBasePdf, pageSizes, pageCursor, schemasList, i18n, options, commitSchemas, onEdit],
  );

  const onSortEnd = useCallback(
    (sortedSchemas: SchemaForUI[]) => {
      commitSchemas(sortedSchemas);
    },
    [commitSchemas],
  );

  const onChangeHoveringSchemaId = useCallback((id: string | null) => {
    setHoveringSchemaId(id);
  }, []);

  const updatePage = useCallback(
    async (sl: SchemaForUI[][], newPageCursor: number) => {
      setPageCursor(newPageCursor);
      const newTemplate = schemasList2template(sl, currentBasePdf);
      _onChangeTemplate(newTemplate);
      await updateTemplate(newTemplate);
      void refresh(newTemplate);
      onPageChangeCallback.current?.({ pageCursor: newPageCursor, totalPages: sl.length });
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.scrollTop = getPagesScrollTopByIndex(pageSizes, newPageCursor, scale);
        }
      }, 0);
    },
    [currentBasePdf, _onChangeTemplate, updateTemplate, refresh, pageSizes, scale],
  );

  const handleRemovePage = useCallback(() => {
    if (pageCursor === 0) return;
    if (!window.confirm(i18n('removePageConfirm'))) return;
    const _schemasList = cloneDeep(schemasList);
    _schemasList.splice(pageCursor, 1);
    void updatePage(_schemasList, pageCursor - 1);
  }, [pageCursor, schemasList, i18n, updatePage]);

  const handleAddPageAfter = useCallback(() => {
    const _schemasList = cloneDeep(schemasList);
    _schemasList.splice(pageCursor + 1, 0, []);
    void updatePage(_schemasList, pageCursor + 1);
  }, [schemasList, pageCursor, updatePage]);

  const handleClonePageAfter = useCallback(() => {
    const _schemasList = cloneDeep(schemasList);
    const currentPage = cloneDeep(schemasList[pageCursor] || []);
    const clonedPage = currentPage.map((s) => ({ ...s, id: uuid() }));
    _schemasList.splice(pageCursor + 1, 0, clonedPage);
    void updatePage(_schemasList, pageCursor + 1);
  }, [schemasList, pageCursor, updatePage]);

  const handleChangePageSize = useCallback(
    (w: number, h: number) => {
      if (!isBlankPdf(currentBasePdf)) return;
      const newBasePdf = { ...currentBasePdf, width: w, height: h };
      setCurrentBasePdf(newBasePdf);
      const newTemplate = schemasList2template(schemasList, newBasePdf);
      _onChangeTemplate(newTemplate);
      void refresh(newTemplate);
    },
    [currentBasePdf, schemasList, _onChangeTemplate, refresh],
  );

  const handleChangePadding = useCallback(
    (padding: [number, number, number, number]) => {
      if (!isBlankPdf(currentBasePdf)) return;
      const newBasePdf = { ...currentBasePdf, padding };
      setCurrentBasePdf(newBasePdf);
      const newTemplate = schemasList2template(schemasList, newBasePdf);
      _onChangeTemplate(newTemplate);
      void refresh(newTemplate);
    },
    [currentBasePdf, schemasList, _onChangeTemplate, refresh],
  );

  // Detect external template changes — sync state derivation inline,
  // async work (updateTemplate) deferred to useEffect to avoid
  // "setState on unmounted component" warning.
  const templateChanged = prevTemplate !== templateProp;
  if (templateChanged) {
    setPrevTemplate(templateProp);
    setCurrentBasePdf(templateProp.basePdf);
  }

  useEffect(() => {
    void updateTemplate(templateProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateProp]);

  const getTemplate = useCallback(
    () => schemasList2template(schemasList, currentBasePdf),
    [schemasList, currentBasePdf],
  );

  // Undo/Redo
  const undo = useCallback(() => {
    if (past.current.length <= 0) return;
    future.current.push(cloneDeep(schemasList[pageCursor]));
    const s = cloneDeep(schemasList);
    s[pageCursor] = past.current.pop()!;
    setSchemasList(s);
  }, [schemasList, pageCursor]);

  const redo = useCallback(() => {
    if (future.current.length <= 0) return;
    past.current.push(cloneDeep(schemasList[pageCursor]));
    const s = cloneDeep(schemasList);
    s[pageCursor] = future.current.pop()!;
    setSchemasList(s);
  }, [schemasList, pageCursor]);

  const contextValue = useMemo<DesignerContextValue>(
    () => ({
      // State
      schemasList,
      pageCursor,
      activeElements,
      hoveringSchemaId,
      zoomLevel,
      sidebarOpen,
      scale,
      backgrounds,
      pageSizes,
      currentBasePdf,
      size,
      error,

      // Refs
      containerRef,
      canvasRef,
      paperRefs,

      // Schema CRUD
      commitSchemas,
      changeSchemas,
      removeSchemas,
      addSchema,

      // Selection
      onEdit,
      onEditEnd,
      onChangeHoveringSchemaId,
      onSortEnd,

      // Page management
      setPageCursor: (p: number) => {
        if (!canvasRef.current) return;
        canvasRef.current.scrollTop = getPagesScrollTopByIndex(pageSizes, p, scale);
        setPageCursor(p);
        onPageChangeCallback.current?.({ pageCursor: p, totalPages: schemasList.length });
        onEditEnd();
      },
      addPageAfter: handleAddPageAfter,
      removePage: handleRemovePage,
      clonePageAfter: handleClonePageAfter,
      handleChangePageSize,
      handleChangePadding,

      // Zoom & UI
      setZoomLevel,
      setSidebarOpen,

      // Template
      getTemplate,
      updateTemplate,

      // Callbacks
      onChangeTemplateCallback,
      onSaveTemplateCallback,
      onPageChangeCallback,

      // Undo/Redo
      undo,
      redo,
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
    }),
    [
      schemasList, pageCursor, activeElements, hoveringSchemaId, zoomLevel,
      sidebarOpen, scale, backgrounds, pageSizes, currentBasePdf, size, error,
      commitSchemas, changeSchemas, removeSchemas, addSchema,
      onEdit, onEditEnd, onChangeHoveringSchemaId, onSortEnd,
      handleAddPageAfter, handleRemovePage, handleClonePageAfter,
      handleChangePageSize, handleChangePadding,
      getTemplate, updateTemplate, undo, redo,
    ],
  );

  return (
    <DesignerContext.Provider value={contextValue}>
      {children}
    </DesignerContext.Provider>
  );
};

export const PdfmeProvider = ({
  template,
  plugins,
  options = {},
  children,
}: PdfmeProviderProps) => {
  const registry = useMemo(() => pluginRegistry(plugins), [plugins]);

  return (
    <AppContextProvider
      lang={options.lang || 'en'}
      font={options.font || getDefaultFont()}
      plugins={registry}
      options={options}
    >
      <DesignerStateManager template={template}>
        {children}
      </DesignerStateManager>
    </AppContextProvider>
  );
};
