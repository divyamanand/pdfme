/**
 * Add/remove row and column buttons for the dynamic table UI.
 */

import type { RenderableTableInstance, Table } from '../engine/index.js';
import { createButton } from './createButton.js';
import { px2mm } from '@pdfme/common';
import { showToast } from '../helpers/toast.js';

const BUTTON_SIZE = 30;

export function appendAddRowButton(
  root: HTMLElement,
  snapshot: RenderableTableInstance,
  table: Table,
  commit: () => void,
): void {
  const button = createButton({
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    top: `${snapshot.getHeight()}mm`,
    left: `calc(50% - ${BUTTON_SIZE / 2}px)`,
    text: '+',
    onClick: () => {
      const status = table.insertBodyRow(table.getRowHeights().length);
      if (status === 'max-reached') showToast('Maximum number of rows reached');
      commit();
    },
  });
  root.appendChild(button);
}

export function appendRemoveRowButtons(
  root: HTMLElement,
  snapshot: RenderableTableInstance,
  table: Table,
  commit: () => void,
): void {
  const bodyRows = snapshot.getRowsInRegion('body');
  let offsetY = snapshot.getHeadHeight();

  for (const row of bodyRows) {
    offsetY += row.height;
    const rowIndex = row.rowIndex;
    const button = createButton({
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      top: `${offsetY - px2mm(BUTTON_SIZE)}mm`,
      right: `-${BUTTON_SIZE}px`,
      text: '-',
      onClick: () => {
        const status = table.removeBodyRow(rowIndex);
        if (status === 'cleared') showToast('Minimum rows reached — row cleared instead of removed');
        commit();
      },
    });
    root.appendChild(button);
  }
}

export function appendAddColumnButton(
  root: HTMLElement,
  snapshot: RenderableTableInstance,
  table: Table,
  commit: () => void,
): void {
  const headHeight = snapshot.getHeadHeight();
  const button = createButton({
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    top: `${headHeight - px2mm(BUTTON_SIZE)}mm`,
    right: `-${BUTTON_SIZE}px`,
    text: '+',
    onClick: (e) => {
      e.preventDefault();
      table.addHeaderCell('theader');
      commit();
    },
  });
  root.appendChild(button);
}

export function appendRemoveColumnButtons(
  root: HTMLElement,
  snapshot: RenderableTableInstance,
  table: Table,
  commit: () => void,
): void {
  const { columns } = snapshot;
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
      onClick: () => {
        const status = table.removeBodyCol(colIndex);
        if (status === 'cleared') showToast('Minimum columns reached — column cleared instead of removed');
        commit();
      },
    });
    root.appendChild(button);
    offsetX += column.width;
  }
}
