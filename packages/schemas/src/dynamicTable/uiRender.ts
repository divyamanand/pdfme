/**
 * UI Renderer for the Dynamic Table pdfme plugin.
 *
 * Architecture:
 * - Plugin uses `uninterruptedEditMode: true` so React (Renderer.tsx) only
 *   calls this function on mode transitions (viewer <-> designer), NOT on
 *   every schema/value change. This prevents the flash caused by synchronous
 *   innerHTML clearing followed by async re-rendering.
 *
 * - Internal re-renders (cell clicks, propPanel triggers, structural mutations)
 *   go through the inner `render()` function which:
 *   1. Builds all cell DOM into a DocumentFragment (parallel cell rendering)
 *   2. Swaps atomically via `rootElement.replaceChildren(fragment)` — no empty frame
 *
 * - The `requestRender` callback lets propPanel widgets trigger canvas updates
 *   without going through React's change cycle.
 */

import type { UIRenderProps, Mode } from '@pdfme/common';
import cell from '../tables/cell.js';
import type { Region } from './engine/index.js';
import type { DynamicTableSchema } from './types.js';
import { getTable, commitTable } from './instanceManager.js';
import { toPdfmeCellSchema, getCellDisplayValue } from './helpers/cellSchemaMapper.js';
import { showToast } from './helpers/toast.js';
import {
  appendAddRowButton,
  appendRemoveRowButtons,
  attachCellResizeInteractions,
  handleCellClick,
} from './uiComponents/index.js';

const cellUiRender = cell.ui;

const REGION_ORDER: Region[] = ['theader', 'lheader', 'rheader', 'body', 'footer'];

/**
 * pdfme ui() entry point.
 *
 * Called by React's Renderer on mode transitions. Sets up the table instance,
 * commit helpers, and the inner render loop.
 */
export async function uiRender(arg: UIRenderProps<DynamicTableSchema>): Promise<void> {
  const { schema, value, rootElement, mode, onChange, basePdf } = arg;
  const table = getTable(schema.name, value);

  // Compute available space from page boundaries
  if (typeof basePdf === 'object' && basePdf !== null && 'width' in basePdf) {
    const p = basePdf as { width: number; height: number; padding: [number, number, number, number] };
    const [, pRight, pBottom] = p.padding;
    table.setAvailableSpace(
      p.width - pRight - schema.position.x,
      p.height - pBottom - schema.position.y,
    );
  }

  // Track last-committed dimensions locally.
  // With uninterruptedEditMode, arg.schema is from the initial mode transition
  // and won't update on subsequent commits, so we track dims ourselves.
  const dims = { w: schema.width, h: schema.height };

  /** Serialize table state and push changes to pdfme (no canvas re-render). */
  const commit = onChange ? () => {
    const json = commitTable(schema.name, table);
    const snap = table.getRenderSnapshot();
    const changes: { key: string; value: unknown }[] = [{ key: 'content', value: json }];
    const { width: availW, height: availH } = table.getAvailableSpace();
    const newW = Math.min(snap.getWidth(), availW);
    const newH = Math.min(snap.getHeight(), availH);
    if (Math.abs(dims.w - newW) > 0.01) {
      changes.push({ key: 'width', value: newW });
      dims.w = newW;
    }
    if (Math.abs(dims.h - newH) > 0.01) {
      changes.push({ key: 'height', value: newH });
      dims.h = newH;
    }
    onChange(changes.length === 1 ? changes[0] : changes);
  } : undefined;

  /** Commit + re-render canvas. Used by structural mutations (resize, add/remove row). */
  const commitAndRender = commit ? () => { commit(); void render(); } : undefined;

  /**
   * Inner render: builds DOM from a fresh snapshot, swaps atomically.
   *
   * Safe to call multiple times — each call produces a complete new DOM tree
   * and replaces the previous one in a single `replaceChildren` call.
   */
  const render = async (): Promise<void> => {
    const snapshot = table.getRenderSnapshot();
    const { settings, tableStyle } = snapshot;

    // Root styles (applied directly, persist across swaps)
    rootElement.style.position = 'relative';
    rootElement.style.width = '100%';
    rootElement.style.height = '100%';
    rootElement.style.overflow = 'visible';
    rootElement.style.border = tableStyle.borderColor
      ? `${tableStyle.borderWidth?.top ?? 0.1}mm solid ${tableStyle.borderColor}`
      : '';

    const fragment = document.createDocumentFragment();

    // Merge/styling mode banner
    if (snapshot.mergeMode !== 'none' && mode === 'designer') {
      const banner = document.createElement('div');
      const isStyleMode = snapshot.mergeMode === 'styling';
      banner.style.cssText =
        'position:absolute;top:-7mm;left:0;right:0;height:6mm;display:flex;align-items:center;' +
        'justify-content:center;' +
        `background:${isStyleMode ? '#7c4dff' : '#ff9800'};color:#fff;font-size:3mm;` +
        'font-weight:600;border-radius:1mm;z-index:100;pointer-events:none;';
      banner.textContent = snapshot.mergeMode === 'selecting'
        ? 'Click cells to select for merge'
        : snapshot.mergeMode === 'unmerging'
          ? 'Click a merged cell to unmerge'
          : 'Click cells to select for styling';
      fragment.appendChild(banner);
    }

    // Build all cells and render in parallel
    const tasks: { div: HTMLElement; promise: void | Promise<void> }[] = [];

    for (const region of REGION_ORDER) {
      if (region === 'theader' && settings.headerVisibility?.theader === false) continue;
      if (region === 'lheader' && settings.headerVisibility?.lheader === false) continue;
      if (region === 'rheader' && settings.headerVisibility?.rheader === false) continue;
      if (region === 'footer' && !settings.footer) continue;

      const rows = snapshot.getRowsInRegion(region);
      for (const row of rows) {
        for (const [colIdx, renderableCell] of row.cells) {
          const cellDiv = document.createElement('div');
          cellDiv.style.position = 'absolute';
          cellDiv.style.left = `${renderableCell.layout.x}mm`;
          cellDiv.style.top = `${renderableCell.layout.y}mm`;
          cellDiv.style.width = `${renderableCell.layout.width}mm`;
          cellDiv.style.height = `${renderableCell.layout.height}mm`;
          cellDiv.style.boxSizing = 'border-box';
          cellDiv.dataset.cellId = renderableCell.cellID;
          cellDiv.dataset.region = region;

          const isEditing = snapshot.editingCellId === renderableCell.cellID;
          const isSelected = snapshot.selectedCellIds.has(renderableCell.cellID);
          const mergeMode = snapshot.mergeMode;

          // Determine cell interaction mode
          let cellMode: Mode = 'viewer';
          if (mergeMode !== 'none') {
            cellMode = 'viewer';
          } else if (mode === 'form') {
            cellMode = region === 'body' && isEditing && !schema.readOnly ? 'designer' : 'viewer';
          } else if (mode === 'designer') {
            cellMode = isEditing ? 'designer' : 'form';
          }

          // Selection/merge highlighting
          if (mergeMode === 'selecting' && isSelected) {
            cellDiv.style.boxShadow = 'inset 0 0 0 2px #ff9800';
            cellDiv.style.background = 'rgba(255, 152, 0, 0.12)';
          } else if (mergeMode === 'styling' && isSelected) {
            cellDiv.style.boxShadow = 'inset 0 0 0 2px #7c4dff';
            cellDiv.style.background = 'rgba(124, 77, 255, 0.12)';
          } else if (mergeMode === 'unmerging' && renderableCell.mergeRect) {
            cellDiv.style.boxShadow = 'inset 0 0 0 2px #f44336';
            cellDiv.style.cursor = 'pointer';
          } else if (isSelected && mode === 'designer') {
            cellDiv.style.boxShadow = 'inset 0 0 0 2px #2196f3';
          }

          const isEditable = mergeMode === 'none'
            && ((mode === 'form' && region === 'body' && !schema.readOnly) || mode === 'designer');
          cellDiv.style.cursor = mergeMode !== 'none' ? 'pointer' : isEditable ? 'text' : 'default';

          const cellId = renderableCell.cellID;
          const rowIdx = row.rowIndex;

          // Start cell render (runs in parallel with other cells)
          const promise = cellUiRender({
            ...arg,
            schema: toPdfmeCellSchema(renderableCell, 0, 0) as any,
            value: getCellDisplayValue(renderableCell),
            rootElement: cellDiv,
            mode: cellMode,
            stopEditing: () => {
              table.resetUIState();
              void render();
            },
            onChange: (v) => {
              if (!onChange) return;
              const newVal = (Array.isArray(v) ? v[0].value : v.value) as string;
              table.updateCell(cellId, { rawValue: newVal });
              commit?.();
            },
          });

          // Cell click handler
          cellDiv.addEventListener('click', (e) => {
            if (mode === 'viewer') return;
            if (mode === 'form' && region !== 'body') return;
            if (mode === 'form' && schema.readOnly) return;

            const currentMergeMode = table.getUIState().mergeMode;

            if (currentMergeMode === 'selecting' && mode === 'designer') {
              table.toggleMergeSelection(cellId);
              void render();
              return;
            }
            if (currentMergeMode === 'styling' && mode === 'designer') {
              table.toggleMergeSelection(cellId);
              void render();
              return;
            }
            if (currentMergeMode === 'unmerging' && mode === 'designer') {
              if (renderableCell.mergeRect) {
                table.unmergeCells(renderableCell.mergeRect.cellId);
                table.setMergeMode('none');
                commit?.();
              } else {
                showToast('Click on a cell that belongs to a merge');
              }
              void render();
              return;
            }

            if (mode === 'designer') {
              handleCellClick(table, cellId, rowIdx, colIdx, region, e.shiftKey, snapshot);
            }
            table.startEditing(cellId);
            void render();
          });

          tasks.push({ div: cellDiv, promise });
        }
      }
    }

    // Wait for all parallel cell renders to complete
    await Promise.all(tasks.map(t => t.promise));

    // Append cells to fragment
    for (const { div } of tasks) fragment.appendChild(div);

    // Atomic DOM swap — entire content replaced in one call, no empty frame
    rootElement.replaceChildren(fragment);

    // Attach interactive controls (must be after cells are in DOM)
    if (mode === 'form' && commitAndRender && !schema.readOnly) {
      appendAddRowButton(rootElement, snapshot, table, commitAndRender);
      appendRemoveRowButtons(rootElement, snapshot, table, commitAndRender);
    }
    if (mode === 'designer' && commitAndRender) {
      attachCellResizeInteractions(rootElement, snapshot, table, commitAndRender);
    }
    if (mode === 'viewer') {
      table.resetUIState();
    }
  };

  // Register render callback so propPanel widgets can trigger canvas updates
  // via table.triggerRender(). With uninterruptedEditMode, React won't re-fire
  // useEffect on schema/value changes, so this is the primary update path.
  table.requestRender(() => void render());

  // Initial render
  await render();
}
