/**
 * UI Renderer for the Dynamic Table pdfme plugin.
 *
 * Pure rendering from Table.getRenderSnapshot().
 * All mutations go through the Table facade directly.
 *
 * Modes:
 * - viewer: Read-only display
 * - designer: Cell editing, selection, resize handles (structure controls in propPanel)
 * - form: Body cells are editable; add/remove row buttons
 */

import type { UIRenderProps, Mode } from '@pdfme/common';
import cell from '../tables/cell.js';
import type { Table, Region } from './engine/index.js';
import type { DynamicTableSchema } from './types.js';
import { getTable, commitTable } from './instanceManager.js';
import { toPdfmeCellSchema, getCellDisplayValue } from './helpers/cellSchemaMapper.js';
import {
  appendAddRowButton,
  appendRemoveRowButtons,
  appendColumnResizeHandles,
  appendRowResizeHandles,
  handleCellClick,
} from './uiComponents/index.js';

const cellUiRender = cell.ui;

/** Region iteration order */
const REGION_ORDER: Region[] = ['theader', 'lheader', 'rheader', 'body', 'footer'];

/** Commit a table mutation and notify pdfme */
function commit(table: Table, schemaName: string, onChange: (arg: { key: string; value: unknown } | { key: string; value: unknown }[]) => void): void {
  const json = commitTable(schemaName, table);
  onChange({ key: 'content', value: json });
}

/**
 * pdfme ui() function for the dynamic table plugin.
 *
 * Flow:
 * 1. Get cached Table → getRenderSnapshot()
 * 2. Render cells from snapshot
 * 3. Attach interactive controls that call Table directly
 */
export async function uiRender(arg: UIRenderProps<DynamicTableSchema>): Promise<void> {
  const { schema, value, rootElement, mode, onChange, scale } = arg;
  const table = getTable(schema.name, value);
  const snapshot = table.getRenderSnapshot();

  // Clear previous render
  rootElement.innerHTML = '';

  // Container setup
  rootElement.style.position = 'relative';
  rootElement.style.width = '100%';
  rootElement.style.height = '100%';
  rootElement.style.overflow = 'visible';

  const { settings, tableStyle } = snapshot;

  // Table outer border
  if (tableStyle.borderColor) {
    const bw = tableStyle.borderWidth?.top ?? 0.1;
    rootElement.style.border = `${bw}mm solid ${tableStyle.borderColor}`;
  }

  // Render cells region by region
  for (const region of REGION_ORDER) {
    if (region === 'theader' && settings.headerVisibility?.theader === false) continue;
    if (region === 'lheader' && settings.headerVisibility?.lheader === false) continue;
    if (region === 'rheader' && settings.headerVisibility?.rheader === false) continue;

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

        // Read UI state from snapshot
        const isEditing = snapshot.editingCellId === renderableCell.cellID;
        const isSelected = snapshot.selectedCellIds.has(renderableCell.cellID);

        let cellMode: Mode = 'viewer';
        if (mode === 'form') {
          cellMode = region === 'body' && isEditing && !schema.readOnly ? 'designer' : 'viewer';
        } else if (mode === 'designer') {
          cellMode = isEditing ? 'designer' : 'form';
        }

        if (isSelected && mode === 'designer') {
          cellDiv.style.boxShadow = 'inset 0 0 0 2px #2196f3';
        }

        const isEditable = (mode === 'form' && region === 'body' && !schema.readOnly) || mode === 'designer';
        cellDiv.style.cursor = isEditable ? 'text' : 'default';

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
            table.resetUIState();
            void uiRender(arg);
          },
          onChange: (v) => {
            if (!onChange) return;
            const newVal = (Array.isArray(v) ? v[0].value : v.value) as string;
            table.updateCell(cellId, { rawValue: newVal });
            commit(table, schema.name, onChange);
          },
        });

        cellDiv.addEventListener('click', (e) => {
          if (mode === 'viewer') return;
          if (mode === 'form' && region !== 'body') return;
          if (mode === 'form' && schema.readOnly) return;

          if (mode === 'designer') {
            handleCellClick(table, cellId, rowIdx, colIdx, region, e.shiftKey, snapshot);
          }

          table.startEditing(cellId);
          void uiRender(arg);
        });

        rootElement.appendChild(cellDiv);
      }
    }
  }

  // Commit helper for uiComponents
  const doCommit = onChange ? () => commit(table, schema.name, onChange) : undefined;

  // Form mode controls
  if (mode === 'form' && doCommit && !schema.readOnly) {
    appendAddRowButton(rootElement, snapshot, table, doCommit);
    appendRemoveRowButtons(rootElement, snapshot, table, doCommit);
  }

  // Designer mode controls — only resize handles (structure controls are in propPanel)
  if (mode === 'designer' && doCommit) {
    appendColumnResizeHandles(rootElement, snapshot, table, doCommit, scale);
    appendRowResizeHandles(rootElement, snapshot, table, doCommit, scale);
  }

  // Viewer mode: reset editing state
  if (mode === 'viewer') {
    table.resetUIState();
  }

  // Auto-fit bounding box to match table dimensions
  if (onChange) {
    const tableWidth = snapshot.getWidth();
    const tableHeight = snapshot.getHeight();
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
