/**
 * Right-click context menu for the dynamic table designer mode.
 */

import type { UIRenderProps } from '@pdfme/common';
import type { RenderableTableInstance } from '../engine/index.js';
import type { DynamicTableSchema } from '../types.js';
import type { ActionDispatch } from '../actionDispatch.js';
import { state, dismissContextMenu } from '../uiState.js';
import { buildMergeRect } from './cellSelection.js';

interface MenuItemDef {
  label: string;
  enabled: boolean;
  onClick: () => void;
}

/**
 * Attach a contextmenu listener to the root element for designer mode.
 * When right-clicking a cell, shows a menu with structural operations.
 */
export function attachContextMenu(
  root: HTMLElement,
  renderable: RenderableTableInstance,
  dispatch: ActionDispatch,
  reRender: (arg: UIRenderProps<DynamicTableSchema>) => Promise<void>,
  arg: UIRenderProps<DynamicTableSchema>,
): void {
  root.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    dismissContextMenu();

    const target = (e.target as HTMLElement).closest('[data-cell-id]') as HTMLElement | null;
    if (!target) return;

    const cellId = target.dataset.cellId!;
    const cell = renderable.getCellByID(cellId);
    if (!cell) return;

    const rowIndex = cell.layout.row;
    const colIndex = cell.layout.col;

    const mergeRect = buildMergeRect(renderable);
    const hasMerge = !!cell.mergeRect;

    const items: (MenuItemDef | 'separator')[] = [
      {
        label: 'Merge Cells',
        enabled: mergeRect !== null,
        onClick: () => {
          if (mergeRect) dispatch.mergeCells(mergeRect);
        },
      },
      {
        label: 'Unmerge Cell',
        enabled: hasMerge,
        onClick: () => dispatch.unmergeCells(cellId),
      },
      'separator',
      {
        label: 'Insert Row Above',
        enabled: cell.inRegion === 'body',
        onClick: () => dispatch.insertBodyRow(rowIndex),
      },
      {
        label: 'Insert Row Below',
        enabled: cell.inRegion === 'body',
        onClick: () => dispatch.insertBodyRow(rowIndex + 1),
      },
      {
        label: 'Insert Column Left',
        enabled: true,
        onClick: () => dispatch.insertBodyCol(colIndex),
      },
      {
        label: 'Insert Column Right',
        enabled: true,
        onClick: () => dispatch.insertBodyCol(colIndex + 1),
      },
      'separator',
      {
        label: 'Delete Row',
        enabled: cell.inRegion === 'body',
        onClick: () => dispatch.removeBodyRow(rowIndex),
      },
      {
        label: 'Delete Column',
        enabled: renderable.columns.length > 1,
        onClick: () => dispatch.removeBodyCol(colIndex),
      },
    ];

    const menu = createMenuElement(items, () => {
      dismissContextMenu();
      void reRender(arg);
    });

    // Position the menu at click coordinates relative to root
    const rootRect = root.getBoundingClientRect();
    menu.style.left = `${e.clientX - rootRect.left}px`;
    menu.style.top = `${e.clientY - rootRect.top}px`;

    state.contextMenuEl = menu;
    root.appendChild(menu);

    // Dismiss on outside click or Escape
    const dismissHandler = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        dismissContextMenu();
        document.removeEventListener('mousedown', dismissHandler);
      }
    };
    const escHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        dismissContextMenu();
        document.removeEventListener('keydown', escHandler);
      }
    };
    // Defer to avoid the current contextmenu event triggering dismiss
    setTimeout(() => {
      document.addEventListener('mousedown', dismissHandler);
      document.addEventListener('keydown', escHandler);
    }, 0);
  });
}

function createMenuElement(
  items: (MenuItemDef | 'separator')[],
  afterAction: () => void,
): HTMLDivElement {
  const menu = document.createElement('div');
  Object.assign(menu.style, {
    position: 'absolute',
    zIndex: '1000',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    padding: '4px 0',
    minWidth: '160px',
    fontSize: '13px',
    fontFamily: 'sans-serif',
  });

  for (const item of items) {
    if (item === 'separator') {
      const sep = document.createElement('div');
      sep.style.borderTop = '1px solid #eee';
      sep.style.margin = '4px 0';
      menu.appendChild(sep);
      continue;
    }

    const row = document.createElement('div');
    Object.assign(row.style, {
      padding: '6px 16px',
      cursor: item.enabled ? 'pointer' : 'default',
      color: item.enabled ? '#333' : '#bbb',
    });
    row.textContent = item.label;

    if (item.enabled) {
      row.addEventListener('mouseover', () => { row.style.backgroundColor = '#f0f0f0'; });
      row.addEventListener('mouseout', () => { row.style.backgroundColor = ''; });
      row.addEventListener('click', () => {
        item.onClick();
        afterAction();
      });
    }

    menu.appendChild(row);
  }

  return menu;
}
