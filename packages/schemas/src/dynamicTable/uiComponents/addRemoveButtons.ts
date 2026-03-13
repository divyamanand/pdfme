/**
 * Add/remove row buttons for the dynamic table UI (form mode).
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
