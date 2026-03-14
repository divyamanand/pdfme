import { useContext, useCallback, useEffect } from 'react';
import type { Template, SchemaForUI } from '@pdfme/common';
import { DesignerContext } from './PdfmeProvider.js';

export const useDesigner = () => {
  const ctx = useContext(DesignerContext);
  if (!ctx) {
    throw new Error('useDesigner must be used within a <PdfmeProvider>');
  }

  return {
    // ---- Template CRUD ----
    getTemplate: ctx.getTemplate,
    updateTemplate: ctx.updateTemplate,

    // ---- Schema CRUD ----
    addSchema: ctx.addSchema,
    removeSchemas: ctx.removeSchemas,
    changeSchemas: ctx.changeSchemas,
    getActiveSchemas: (): SchemaForUI[] => {
      const ids = ctx.activeElements.map((el) => el.id);
      return ctx.schemasList[ctx.pageCursor]?.filter((s) => ids.includes(s.id)) ?? [];
    },
    deselectAll: ctx.onEditEnd,

    // ---- Page CRUD ----
    pageCursor: ctx.pageCursor,
    setPageCursor: ctx.setPageCursor,
    getTotalPages: () => ctx.schemasList.length,
    addPage: ctx.addPageAfter,
    removePage: ctx.removePage,
    clonePage: ctx.clonePageAfter,
    changePageSize: ctx.handleChangePageSize,
    changePadding: ctx.handleChangePadding,

    // ---- History ----
    undo: ctx.undo,
    redo: ctx.redo,
    canUndo: ctx.canUndo,
    canRedo: ctx.canRedo,

    // ---- Zoom ----
    zoomLevel: ctx.zoomLevel,
    setZoomLevel: ctx.setZoomLevel,

    // ---- Sidebar ----
    sidebarOpen: ctx.sidebarOpen,
    setSidebarOpen: ctx.setSidebarOpen,

    // ---- State (read-only) ----
    schemasList: ctx.schemasList,
    pageSizes: ctx.pageSizes,
    currentBasePdf: ctx.currentBasePdf,
    error: ctx.error,

    // ---- Callback registration ----
    onChangeTemplate: (cb: (t: Template) => void) => {
      ctx.onChangeTemplateCallback.current = cb;
    },
    onSaveTemplate: (cb: (t: Template) => void) => {
      ctx.onSaveTemplateCallback.current = cb;
    },
    onPageChange: (cb: (info: { pageCursor: number; totalPages: number }) => void) => {
      ctx.onPageChangeCallback.current = cb;
    },
  };
};
