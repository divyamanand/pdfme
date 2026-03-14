import React, { useContext } from 'react';
import { DesignerContext } from './PdfmeProvider.js';
import RightSidebar from '../../ui/src/components/Designer/RightSidebar/index.js';

export interface PropPanelProps {
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Standalone PropPanel that renders the property editor for the currently selected schema.
 * Use this when you set `hideRightSidebar` on Canvas and want to place the panel elsewhere.
 */
export const PropPanel = ({ style, className }: PropPanelProps) => {
  const ctx = useContext(DesignerContext);
  if (!ctx) {
    throw new Error('PropPanel must be used within a <PdfmeProvider>');
  }

  const {
    size,
    hoveringSchemaId,
    onChangeHoveringSchemaId,
    pageSizes,
    pageCursor,
    currentBasePdf,
    activeElements,
    schemasList,
    onSortEnd,
    onEdit,
    onEditEnd,
    changeSchemas,
    sidebarOpen,
    setSidebarOpen,
  } = ctx;

  const height = size.height;

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <RightSidebar
        height={height}
        hoveringSchemaId={hoveringSchemaId}
        onChangeHoveringSchemaId={onChangeHoveringSchemaId}
        size={size}
        pageSize={pageSizes[pageCursor]}
        basePdf={currentBasePdf}
        activeElements={activeElements}
        schemas={schemasList[pageCursor] || []}
        schemasList={schemasList}
        onSortEnd={onSortEnd}
        onEdit={(id: string) => {
          const el = document.getElementById(id);
          if (el) onEdit([el]);
        }}
        onEditEnd={onEditEnd}
        changeSchemas={changeSchemas}
        deselectSchema={onEditEnd}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    </div>
  );
};
