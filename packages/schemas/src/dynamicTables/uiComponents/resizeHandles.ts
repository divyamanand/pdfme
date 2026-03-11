/**
 * Column and row drag resize handles for the dynamic table UI.
 */

import type { RenderableTableInstance, Table } from '../engine/index.js';
import { ZOOM } from '@pdfme/common';

const HANDLE_WIDTH = 5; // px

export function appendColumnResizeHandles(
  root: HTMLElement,
  snapshot: RenderableTableInstance,
  table: Table,
  commit: () => void,
  scale: number,
): void {
  const { columns } = snapshot;
  let offsetX = 0;

  // Main grid column handles
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    offsetX += column.width;

    if (i === columns.length - 1) continue;

    const handle = createColResizeHandle(offsetX, '0', '100%');

    const prevColumnLeft = offsetX - column.width;
    const nextColumnRight = offsetX - pxToMm(HANDLE_WIDTH) + (columns[i + 1]?.width ?? 0);
    const colIndex = i;
    const currentWidth = column.width;

    attachColResizeBehavior(handle, root, table, commit, scale, prevColumnLeft, nextColumnRight, colIndex, currentWidth, false);
    root.appendChild(handle);
  }

  // Footer column handles (independent from main grid)
  const footerColumns = snapshot.footerColumns;
  if (footerColumns.length > 1) {
    const footerY = snapshot.getHeadHeight() + snapshot.getBodyHeight();
    const footerHeight = snapshot.getFooterHeight();
    let footerOffsetX = 0;

    for (let i = 0; i < footerColumns.length; i++) {
      const column = footerColumns[i];
      footerOffsetX += column.width;

      if (i === footerColumns.length - 1) continue;

      const handle = createColResizeHandle(footerOffsetX, `${footerY}mm`, `${footerHeight}mm`);

      const prevColumnLeft = footerOffsetX - column.width;
      const nextColumnRight = footerOffsetX - pxToMm(HANDLE_WIDTH) + (footerColumns[i + 1]?.width ?? 0);
      const colIndex = i;
      const currentWidth = column.width;

      attachColResizeBehavior(handle, root, table, commit, scale, prevColumnLeft, nextColumnRight, colIndex, currentWidth, true);
      root.appendChild(handle);
    }
  }
}

export function appendRowResizeHandles(
  root: HTMLElement,
  snapshot: RenderableTableInstance,
  table: Table,
  commit: () => void,
  scale: number,
): void {
  // Header row handles (theader rows are at the top of the global grid)
  const headerRows = snapshot.getRowsInRegion('theader');
  if (headerRows.length > 1) {
    let offsetY = 0;

    for (let i = 0; i < headerRows.length; i++) {
      const row = headerRows[i];
      offsetY += row.height;

      if (i === headerRows.length - 1) continue;

      const handle = createRowResizeHandle(offsetY);

      const prevRowTop = offsetY - row.height;
      const nextRowBottom = offsetY - pxToMm(HANDLE_WIDTH) + (headerRows[i + 1]?.height ?? 0);
      const globalIdx = row.globalRowIndex;
      const currentHeight = row.height;

      attachRowResizeBehavior(handle, root, table, commit, scale, prevRowTop, nextRowBottom, globalIdx, currentHeight, false);
      root.appendChild(handle);
    }
  }

  // Body row handles
  const bodyRows = snapshot.getRowsInRegion('body');
  let offsetY = snapshot.getHeadHeight();

  for (let i = 0; i < bodyRows.length; i++) {
    const row = bodyRows[i];
    offsetY += row.height;

    if (i === bodyRows.length - 1) continue;

    const handle = createRowResizeHandle(offsetY);

    const prevRowTop = offsetY - row.height;
    const nextRowBottom = offsetY - pxToMm(HANDLE_WIDTH) + (bodyRows[i + 1]?.height ?? 0);
    const globalIdx = row.globalRowIndex;
    const currentHeight = row.height;

    attachRowResizeBehavior(handle, root, table, commit, scale, prevRowTop, nextRowBottom, globalIdx, currentHeight, false);
    root.appendChild(handle);
  }

  // Footer row handles (independent)
  const footerRows = snapshot.getRowsInRegion('footer');
  if (footerRows.length > 1) {
    let footerOffsetY = snapshot.getHeadHeight() + snapshot.getBodyHeight();

    for (let i = 0; i < footerRows.length; i++) {
      const row = footerRows[i];
      footerOffsetY += row.height;

      if (i === footerRows.length - 1) continue;

      const handle = createRowResizeHandle(footerOffsetY);

      const prevRowTop = footerOffsetY - row.height;
      const nextRowBottom = footerOffsetY - pxToMm(HANDLE_WIDTH) + (footerRows[i + 1]?.height ?? 0);
      const globalIdx = row.globalRowIndex;
      const currentHeight = row.height;

      attachRowResizeBehavior(handle, root, table, commit, scale, prevRowTop, nextRowBottom, globalIdx, currentHeight, true);
      root.appendChild(handle);
    }
  }
}

// --- Helpers ---

function createColResizeHandle(offsetX: number, top: string, height: string): HTMLDivElement {
  const handle = document.createElement('div');
  Object.assign(handle.style, {
    width: `${HANDLE_WIDTH}px`,
    height,
    backgroundColor: '#eee',
    opacity: '0.5',
    cursor: 'col-resize',
    position: 'absolute',
    zIndex: '10',
    left: `${offsetX - pxToMm(HANDLE_WIDTH) / 2}mm`,
    top,
  });
  return handle;
}

function createRowResizeHandle(offsetY: number): HTMLDivElement {
  const handle = document.createElement('div');
  Object.assign(handle.style, {
    width: '100%',
    height: `${HANDLE_WIDTH}px`,
    backgroundColor: '#eee',
    opacity: '0.5',
    cursor: 'row-resize',
    position: 'absolute',
    zIndex: '10',
    top: `${offsetY - pxToMm(HANDLE_WIDTH) / 2}mm`,
    left: '0',
  });
  return handle;
}

function attachColResizeBehavior(
  handle: HTMLDivElement,
  root: HTMLElement,
  table: Table,
  commit: () => void,
  scale: number,
  prevColumnLeft: number,
  nextColumnRight: number,
  colIndex: number,
  currentWidth: number,
  isFooter: boolean,
): void {
  const setColor = (e: MouseEvent) => { (e.target as HTMLDivElement).style.backgroundColor = '#2196f3'; };
  const resetColor = (e: MouseEvent) => { (e.target as HTMLDivElement).style.backgroundColor = '#eee'; };
  handle.addEventListener('mouseover', setColor);
  handle.addEventListener('mouseout', resetColor);

  handle.addEventListener('mousedown', (e) => {
    table.clearSelection();
    handle.removeEventListener('mouseover', setColor);
    handle.removeEventListener('mouseout', resetColor);

    const startClientX = e.clientX;
    const startLeft = Number(handle.style.left.replace('mm', ''));

    let move = 0;
    const mouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startClientX;
      const moveX = deltaX / ZOOM / scale;
      let newLeft = startLeft + moveX;

      if (newLeft < prevColumnLeft) newLeft = prevColumnLeft;
      if (newLeft >= nextColumnRight) newLeft = nextColumnRight;

      handle.style.left = `${newLeft}mm`;
      move = newLeft - startLeft;
    };
    root.addEventListener('mousemove', mouseMove);

    const commitResize = () => {
      if (move !== 0) {
        if (isFooter) {
          table.setFooterColumnWidth(colIndex, currentWidth + move);
        } else {
          table.setColumnWidth(colIndex, currentWidth + move);
        }
        commit();
      }
      move = 0;
      handle.addEventListener('mouseover', setColor);
      handle.addEventListener('mouseout', resetColor);
      root.removeEventListener('mousemove', mouseMove);
      root.removeEventListener('mouseup', commitResize);
    };
    root.addEventListener('mouseup', commitResize);
  });
}

function pxToMm(px: number): number {
  return px / ZOOM;
}

function attachRowResizeBehavior(
  handle: HTMLDivElement,
  root: HTMLElement,
  table: Table,
  commit: () => void,
  scale: number,
  prevRowTop: number,
  nextRowBottom: number,
  rowIndex: number,
  currentHeight: number,
  isFooter: boolean,
): void {
  const setColor = (e: MouseEvent) => { (e.target as HTMLDivElement).style.backgroundColor = '#2196f3'; };
  const resetColor = (e: MouseEvent) => { (e.target as HTMLDivElement).style.backgroundColor = '#eee'; };
  handle.addEventListener('mouseover', setColor);
  handle.addEventListener('mouseout', resetColor);

  handle.addEventListener('mousedown', (e) => {
    table.clearSelection();
    handle.removeEventListener('mouseover', setColor);
    handle.removeEventListener('mouseout', resetColor);

    const startClientY = e.clientY;
    const startTop = Number(handle.style.top.replace('mm', ''));

    let move = 0;
    const mouseMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - startClientY;
      const moveY = deltaY / ZOOM / scale;
      let newTop = startTop + moveY;

      if (newTop < prevRowTop) newTop = prevRowTop;
      if (newTop >= nextRowBottom) newTop = nextRowBottom;

      handle.style.top = `${newTop}mm`;
      move = newTop - startTop;
    };
    root.addEventListener('mousemove', mouseMove);

    const commitResize = () => {
      if (move !== 0) {
        if (isFooter) {
          table.setFooterRowHeight(rowIndex, currentHeight + move);
        } else {
          table.setRowHeight(rowIndex, currentHeight + move);
        }
        commit();
      }
      move = 0;
      handle.addEventListener('mouseover', setColor);
      handle.addEventListener('mouseout', resetColor);
      root.removeEventListener('mousemove', mouseMove);
      root.removeEventListener('mouseup', commitResize);
    };
    root.addEventListener('mouseup', commitResize);
  });
}
