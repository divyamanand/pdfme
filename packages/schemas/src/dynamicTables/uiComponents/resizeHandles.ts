/**
 * Column and row drag resize handles for the dynamic table UI.
 * Follows the exact pattern from tables/uiRender.ts:355-425.
 */

import type { RenderableTableInstance } from '../engine/index.js';
import type { ActionDispatch } from '../actionDispatch.js';
import { ZOOM } from '@pdfme/common';
import { resetState } from '../uiState.js';

const HANDLE_WIDTH = 5; // px

/**
 * Append draggable column resize handles between columns (designer mode).
 */
export function appendColumnResizeHandles(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
  scale: number,
): void {
  const { columns } = renderable;
  let offsetX = 0;

  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    offsetX += column.width;

    if (i === columns.length - 1) continue;

    const handle = document.createElement('div');
    Object.assign(handle.style, {
      width: `${HANDLE_WIDTH}px`,
      height: '100%',
      backgroundColor: '#eee',
      opacity: '0.5',
      cursor: 'col-resize',
      position: 'absolute',
      zIndex: '10',
      left: `${offsetX - pxToMm(HANDLE_WIDTH) / 2}mm`,
      top: '0',
    });

    const setColor = (e: MouseEvent) => {
      (e.target as HTMLDivElement).style.backgroundColor = '#2196f3';
    };
    const resetColor = (e: MouseEvent) => {
      (e.target as HTMLDivElement).style.backgroundColor = '#eee';
    };
    handle.addEventListener('mouseover', setColor);
    handle.addEventListener('mouseout', resetColor);

    const prevColumnLeft = offsetX - column.width;
    const nextColumnRight = offsetX - pxToMm(HANDLE_WIDTH) + (columns[i + 1]?.width ?? 0);
    const colIndex = i;
    const currentWidth = column.width;

    handle.addEventListener('mousedown', (e) => {
      resetState();
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
          dispatch.setColumnWidth(colIndex, currentWidth + move);
        }
        move = 0;
        handle.addEventListener('mouseover', setColor);
        handle.addEventListener('mouseout', resetColor);
        root.removeEventListener('mousemove', mouseMove);
        root.removeEventListener('mouseup', commitResize);
      };
      root.addEventListener('mouseup', commitResize);
    });

    root.appendChild(handle);
  }
}

/**
 * Append draggable row resize handles between rows (designer mode).
 */
export function appendRowResizeHandles(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
  scale: number,
): void {
  const bodyRows = renderable.getRowsInRegion('body');
  let offsetY = renderable.getHeadHeight();

  for (let i = 0; i < bodyRows.length; i++) {
    const row = bodyRows[i];
    offsetY += row.height;

    if (i === bodyRows.length - 1) continue;

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

    const setColor = (e: MouseEvent) => {
      (e.target as HTMLDivElement).style.backgroundColor = '#2196f3';
    };
    const resetColor = (e: MouseEvent) => {
      (e.target as HTMLDivElement).style.backgroundColor = '#eee';
    };
    handle.addEventListener('mouseover', setColor);
    handle.addEventListener('mouseout', resetColor);

    const prevRowTop = offsetY - row.height;
    const nextRowBottom = offsetY - pxToMm(HANDLE_WIDTH) + (bodyRows[i + 1]?.height ?? 0);
    const rowIndex = row.rowIndex;
    const currentHeight = row.height;

    handle.addEventListener('mousedown', (e) => {
      resetState();
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
          dispatch.setRowHeight(rowIndex, currentHeight + move);
        }
        move = 0;
        handle.addEventListener('mouseover', setColor);
        handle.addEventListener('mouseout', resetColor);
        root.removeEventListener('mousemove', mouseMove);
        root.removeEventListener('mouseup', commitResize);
      };
      root.addEventListener('mouseup', commitResize);
    });

    root.appendChild(handle);
  }
}

/** Convert pixels to mm (1px ≈ 0.2646mm) */
function pxToMm(px: number): number {
  return px / ZOOM;
}
