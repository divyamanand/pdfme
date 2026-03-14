import React, { useContext, useCallback } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { Schema, px2mm, ZOOM } from '@pdfme/common';
import { DesignerContext } from './PdfmeProvider.js';
import InternalCanvas from '../../ui/src/components/Designer/Canvas/index.js';
import LeftSidebar from '../../ui/src/components/Designer/LeftSidebar.js';
import RightSidebar from '../../ui/src/components/Designer/RightSidebar/index.js';
import CtlBar from '../../ui/src/components/CtlBar.js';
import Root from '../../ui/src/components/Root.js';
import { RULER_HEIGHT, LEFT_SIDEBAR_WIDTH, RIGHT_SIDEBAR_WIDTH } from '../../ui/src/constants.js';
import { round } from '../../ui/src/helper.js';

export interface CanvasProps {
  style?: React.CSSProperties;
  className?: string;
  /** Hide the built-in left sidebar (plugin icons). Default: false */
  hideLeftSidebar?: boolean;
  /** Hide the built-in right sidebar (prop panel). Default: false */
  hideRightSidebar?: boolean;
  /** Hide the built-in control bar (zoom/pager). Default: false */
  hideCtlBar?: boolean;
}

const scaleDragPosAdjustment = (adjustment: number, s: number): number => {
  if (s > 1) return adjustment * (s - 1);
  if (s < 1) return adjustment * -(1 - s);
  return 0;
};

export const Canvas = ({
  style,
  className,
  hideLeftSidebar = false,
  hideRightSidebar = false,
  hideCtlBar = false,
}: CanvasProps) => {
  const ctx = useContext(DesignerContext);
  if (!ctx) {
    throw new Error('Canvas must be used within a <PdfmeProvider>');
  }

  const {
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
    containerRef,
    canvasRef,
    paperRefs,
    changeSchemas,
    removeSchemas,
    addSchema,
    onEdit,
    onEditEnd,
    onChangeHoveringSchemaId,
    onSortEnd,
    setPageCursor,
    addPageAfter,
    removePage,
    clonePageAfter,
    handleChangePageSize,
    handleChangePadding,
    setZoomLevel,
    setSidebarOpen,
  } = ctx;

  // Always reserve space for the right sidebar so the canvas never shifts
  const leftSidebarWidth = hideLeftSidebar ? 0 : LEFT_SIDEBAR_WIDTH;
  const canvasWidth = size.width - leftSidebarWidth;
  const sizeExcSidebars = {
    width: !hideRightSidebar ? canvasWidth - RIGHT_SIDEBAR_WIDTH : canvasWidth,
    height: size.height,
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!event.active) return;
      const active = event.active;
      const defaultSchema = active.data.current as Schema | undefined;
      if (!defaultSchema) return;

      const paper = paperRefs.current[pageCursor];
      if (!paper) {
        addSchema(defaultSchema);
        return;
      }

      const pageRect = paper.getBoundingClientRect();
      const dragStartLeft = active.rect.current.initial?.left || 0;
      const dragStartTop = active.rect.current.initial?.top || 0;

      const canvasLeftOffsetFromPageCorner =
        pageRect.left - dragStartLeft + scaleDragPosAdjustment(20, scale);
      const canvasTopOffsetFromPageCorner = pageRect.top - dragStartTop;

      const moveY = (event.delta.y - canvasTopOffsetFromPageCorner) / scale;
      const moveX = (event.delta.x - canvasLeftOffsetFromPageCorner) / scale;

      const position = {
        x: round(px2mm(Math.max(0, moveX)), 2),
        y: round(px2mm(Math.max(0, moveY)), 2),
      };

      addSchema({ ...defaultSchema, position });
    },
    [addSchema, pageCursor, paperRefs, scale],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
      className={className}
    >
      <Root size={size} scale={scale}>
        <DndContext onDragEnd={handleDragEnd} onDragStart={onEditEnd}>
          {!hideLeftSidebar && (
            <LeftSidebar
              height={canvasRef.current ? canvasRef.current.clientHeight : 0}
              scale={scale}
              basePdf={currentBasePdf}
            />
          )}

          <div style={{ position: 'absolute', top: 0, width: canvasWidth, height: '100%', marginLeft: leftSidebarWidth }}>
            {!hideCtlBar && (
              <CtlBar
                size={sizeExcSidebars}
                pageCursor={pageCursor}
                pageNum={schemasList.length}
                setPageCursor={setPageCursor}
                zoomLevel={zoomLevel}
                setZoomLevel={setZoomLevel}
                addPageAfter={addPageAfter}
                removePage={removePage}
                clonePageAfter={clonePageAfter}
                basePdf={currentBasePdf}
                onChangePageSize={handleChangePageSize}
                onChangePadding={handleChangePadding}
              />
            )}

            {!hideRightSidebar && (
              <RightSidebar
                hoveringSchemaId={hoveringSchemaId}
                onChangeHoveringSchemaId={onChangeHoveringSchemaId}
                height={canvasRef.current ? canvasRef.current.clientHeight : 0}
                size={size}
                pageSize={pageSizes[pageCursor] ?? { width: 0, height: 0 }}
                basePdf={currentBasePdf}
                activeElements={activeElements}
                schemasList={schemasList}
                schemas={schemasList[pageCursor] ?? []}
                changeSchemas={changeSchemas}
                onSortEnd={onSortEnd}
                onEdit={(id: string) => {
                  const el = document.getElementById(id);
                  if (el) onEdit([el]);
                }}
                onEditEnd={onEditEnd}
                deselectSchema={onEditEnd}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            )}

            <InternalCanvas
              ref={canvasRef}
              paperRefs={paperRefs}
              basePdf={currentBasePdf}
              hoveringSchemaId={hoveringSchemaId}
              onChangeHoveringSchemaId={onChangeHoveringSchemaId}
              height={size.height - RULER_HEIGHT * ZOOM}
              pageCursor={pageCursor}
              scale={scale}
              size={sizeExcSidebars}
              pageSizes={pageSizes}
              backgrounds={backgrounds}
              activeElements={activeElements}
              schemasList={schemasList}
              changeSchemas={changeSchemas}
              removeSchemas={removeSchemas}
              sidebarOpen={!hideRightSidebar}
              onEdit={onEdit}
            />
          </div>
        </DndContext>
      </Root>
    </div>
  );
};
