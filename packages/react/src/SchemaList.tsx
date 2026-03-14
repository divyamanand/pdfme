import React, { useContext } from 'react';
import { DesignerContext } from './PdfmeProvider.js';
import LeftSidebar from '../../ui/src/components/Designer/LeftSidebar.js';
import { RULER_HEIGHT } from '../../ui/src/constants.js';

export interface SchemaListProps {
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Standalone SchemaList (plugin icon bar) for drag-and-drop schema creation.
 * Use this when you set `hideLeftSidebar` on Canvas and want to place the list elsewhere.
 */
export const SchemaList = ({ style, className }: SchemaListProps) => {
  const ctx = useContext(DesignerContext);
  if (!ctx) {
    throw new Error('SchemaList must be used within a <PdfmeProvider>');
  }

  const { size, scale, currentBasePdf } = ctx;
  const height = size.height - RULER_HEIGHT;

  return (
    <div style={{ position: 'relative', ...style }} className={className}>
      <LeftSidebar height={height} scale={scale} basePdf={currentBasePdf} />
    </div>
  );
};
