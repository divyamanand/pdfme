/**
 * Add/remove row and column buttons for the dynamic table UI.
 * Follows the same positioning pattern as tables/uiRender.ts.
 */

import type { RenderableTableInstance } from '../engine/index.js';
import type { ActionDispatch } from '../actionDispatch.js';
import { createButton } from './createButton.js';
import { px2mm } from '@pdfme/common';

const BUTTON_SIZE = 30;

/**
 * Append a "+" button below the table to add a new body row.
 */
export function appendAddRowButton(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
): void {
  const button = createButton({
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    top: `${renderable.getHeight()}mm`,
    left: `calc(50% - ${BUTTON_SIZE / 2}px)`,
    text: '+',
    onClick: () => dispatch.insertBodyRow(),
  });
  root.appendChild(button);
}

/**
 * Append a "-" button to the right of each body row.
 */
export function appendRemoveRowButtons(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
): void {
  const bodyRows = renderable.getRowsInRegion('body');
  let offsetY = renderable.getHeadHeight();

  for (const row of bodyRows) {
    offsetY += row.height;
    const rowIndex = row.rowIndex;
    const button = createButton({
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      top: `${offsetY - px2mm(BUTTON_SIZE)}mm`,
      right: `-${BUTTON_SIZE}px`,
      text: '-',
      onClick: () => dispatch.removeBodyRow(rowIndex),
    });
    root.appendChild(button);
  }
}

/**
 * Append a "+" button at top-right to add a new column (designer mode).
 */
export function appendAddColumnButton(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
): void {
  const headHeight = renderable.getHeadHeight();
  const button = createButton({
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    top: `${headHeight - px2mm(BUTTON_SIZE)}mm`,
    right: `-${BUTTON_SIZE}px`,
    text: '+',
    onClick: (e) => {
      e.preventDefault();
      dispatch.addColumn();
    },
  });
  root.appendChild(button);
}

/**
 * Append a "-" button above each column to remove it (designer mode).
 */
export function appendRemoveColumnButtons(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
): void {
  const { columns } = renderable;
  if (columns.length <= 1) return;

  let offsetX = 0;
  for (const column of columns) {
    const colIndex = column.colIndex;
    const button = createButton({
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      top: `-${BUTTON_SIZE}px`,
      left: `${offsetX + column.width / 2 - px2mm(BUTTON_SIZE / 2)}mm`,
      text: '-',
      onClick: () => dispatch.removeBodyCol(colIndex),
    });
    root.appendChild(button);
    offsetX += column.width;
  }
}
