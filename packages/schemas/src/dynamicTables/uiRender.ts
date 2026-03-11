/**
 * UI Renderer for the Dynamic Table pdfme plugin.
 *
 * Renders the table into the rootElement provided by pdfme.
 * Each cell is positioned absolutely based on layout data from our engine.
 * Cell content rendering delegates to pdfme's existing cell UI renderer.
 *
 * Modes:
 * - viewer: Read-only display
 * - designer: Full structure editing (add/remove row/col, resize, merge, context menu)
 * - form: Body cells are editable; add/remove row buttons
 */

import type { UIRenderProps, Mode } from '@pdfme/common';
import cell from '../tables/cell.js';
import type { Region } from './engine/index.js';
import type { DynamicTableSchema } from './types.js';
import { instanceManager } from './instanceManager.js';
import { toPdfmeCellSchema, getCellDisplayValue } from './helpers/cellSchemaMapper.js';
import { createActionDispatch } from './actionDispatch.js';
import { state, resetState } from './uiState.js';
import {
  appendAddRowButton,
  appendRemoveRowButtons,
  appendAddColumnButton,
  appendRemoveColumnButtons,
  appendColumnResizeHandles,
  appendRowResizeHandles,
  handleCellClick,
  attachContextMenu,
} from './uiComponents/index.js';

const cellUiRender = cell.ui;

/** Region iteration order */
const REGION_ORDER: Region[] = ['theader', 'lheader', 'rheader', 'body', 'footer'];

/**
 * pdfme ui() function for the dynamic table plugin.
 *
 * Flow:
 * 1. Parse value → Table → RenderableTableInstance (via InstanceManager)
 * 2. Clear rootElement
 * 3. Create absolutely-positioned cell divs based on layout data
 * 4. Delegate each cell's rendering to cellUiRender with mode delegation
 * 5. Append interactive controls based on mode
 * 6. Auto-fit height
 */
export async function uiRender(arg: UIRenderProps<DynamicTableSchema>): Promise<void> {
  const { schema, value, rootElement, mode, onChange, scale } = arg;
  const { renderable } = instanceManager.getOrCreate(schema.name, value);
  const dispatch = onChange ? createActionDispatch(schema.name, onChange) : null;

  // Clear previous render
  rootElement.innerHTML = '';

  // Container setup
  rootElement.style.position = 'relative';
  rootElement.style.width = '100%';
  rootElement.style.height = '100%';
  rootElement.style.overflow = 'visible';

  const { settings, tableStyle } = renderable;

  // Table outer border
  if (tableStyle.borderColor) {
    const bw = tableStyle.borderWidth?.top ?? 0.1;
    rootElement.style.border = `${bw}mm solid ${tableStyle.borderColor}`;
  }

  // Render cells region by region
  for (const region of REGION_ORDER) {
    // Skip hidden headers
    if (region === 'theader' && settings.headerVisibility?.theader === false) continue;
    if (region === 'lheader' && settings.headerVisibility?.lheader === false) continue;
    if (region === 'rheader' && settings.headerVisibility?.rheader === false) continue;

    const rows = renderable.getRowsInRegion(region);
    for (const row of rows) {
      for (const [colIdx, renderableCell] of row.cells) {
        // Create cell container
        const cellDiv = document.createElement('div');
        cellDiv.style.position = 'absolute';
        cellDiv.style.left = `${renderableCell.layout.x}mm`;
        cellDiv.style.top = `${renderableCell.layout.y}mm`;
        cellDiv.style.width = `${renderableCell.layout.width}mm`;
        cellDiv.style.height = `${renderableCell.layout.height}mm`;
        cellDiv.style.boxSizing = 'border-box';
        cellDiv.dataset.cellId = renderableCell.cellID;
        cellDiv.dataset.region = region;

        // Mode-based cell rendering (tables pattern from tables/uiRender.ts:147-154)
        const isEditing = state.editingCellId === renderableCell.cellID;
        const isSelected = state.selectedCells.has(renderableCell.cellID);

        let cellMode: Mode = 'viewer';
        if (mode === 'form') {
          cellMode = region === 'body' && isEditing && !schema.readOnly ? 'designer' : 'viewer';
        } else if (mode === 'designer') {
          cellMode = isEditing ? 'designer' : 'form';
        }

        // Selection highlight
        if (isSelected && mode === 'designer') {
          cellDiv.style.boxShadow = 'inset 0 0 0 2px #2196f3';
        }

        // Cursor style
        const isEditable = (mode === 'form' && region === 'body' && !schema.readOnly) || mode === 'designer';
        cellDiv.style.cursor = isEditable ? 'text' : 'default';

        // Map to pdfme cell schema and render
        const cellSchema = toPdfmeCellSchema(renderableCell, 0, 0);
        const displayValue = getCellDisplayValue(renderableCell);

        const cellId = renderableCell.cellID;
        const rowIdx = row.rowIndex;

        await cellUiRender({
          ...arg,
          schema: cellSchema as any,
          value: displayValue,
          rootElement: cellDiv,
          mode: cellMode,
          stopEditing: () => {
            resetState();
            void uiRender(arg);
          },
          onChange: (v) => {
            if (!dispatch) return;
            const newVal = (Array.isArray(v) ? v[0].value : v.value) as string;
            dispatch.updateCell(cellId, newVal);
          },
        });

        // Click handler for cell selection and editing
        cellDiv.addEventListener('click', (e) => {
          if (mode === 'viewer') return;
          if (mode === 'form' && region !== 'body') return;
          if (mode === 'form' && schema.readOnly) return;

          if (mode === 'designer') {
            handleCellClick(cellId, rowIdx, colIdx, region, e.shiftKey, renderable);
          }

          state.editingCellId = cellId;
          void uiRender(arg);
        });

        rootElement.appendChild(cellDiv);
      }
    }
  }

  // Form mode controls
  if (mode === 'form' && dispatch && !schema.readOnly) {
    appendAddRowButton(rootElement, renderable, dispatch);
    appendRemoveRowButtons(rootElement, renderable, dispatch);
  }

  // Designer mode controls
  if (mode === 'designer' && dispatch) {
    appendAddRowButton(rootElement, renderable, dispatch);
    appendRemoveRowButtons(rootElement, renderable, dispatch);
    appendAddColumnButton(rootElement, renderable, dispatch);
    appendRemoveColumnButtons(rootElement, renderable, dispatch);
    appendColumnResizeHandles(rootElement, renderable, dispatch, scale);
    appendRowResizeHandles(rootElement, renderable, dispatch, scale);
    attachContextMenu(rootElement, renderable, dispatch, uiRender, arg);
  }

  // Viewer mode: reset editing state
  if (mode === 'viewer') {
    resetState();
  }

  // Auto-fit bounding box to match table dimensions
  if (onChange) {
    const tableWidth = renderable.getWidth();
    const tableHeight = renderable.getHeight();
    const changes: { key: string; value: unknown }[] = [];
    if (Math.abs(schema.width - tableWidth) > 0.01) {
      changes.push({ key: 'width', value: tableWidth });
    }
    if (Math.abs(schema.height - tableHeight) > 0.01) {
      changes.push({ key: 'height', value: tableHeight });
    }
    if (changes.length > 0) {
      onChange(changes.length === 1 ? changes[0] : changes);
    }
  }
}
