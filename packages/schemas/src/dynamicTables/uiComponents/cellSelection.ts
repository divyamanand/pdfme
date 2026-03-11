/**
 * Cell selection tracking for the dynamic table designer mode.
 * Uses Table's UI state instead of module-level singletons.
 */

import type { RenderableTableInstance, Table, Rect, Region } from '../engine/index.js';

/**
 * Handle a cell click for selection purposes.
 * Without shift: single selection (clears previous).
 * With shift: rectangular range from anchor to clicked cell.
 */
export function handleCellClick(
  table: Table,
  cellId: string,
  row: number,
  col: number,
  region: string,
  shiftKey: boolean,
  snapshot: RenderableTableInstance,
): void {
  const uiState = table.getUIState();

  if (!shiftKey) {
    table.selectCell(cellId);
    table.setSelectionAnchor({ row, col, region });
    return;
  }

  // Shift+click: range selection from anchor
  const anchor = uiState.selectionAnchor;
  if (!anchor || anchor.region !== region) {
    table.selectCell(cellId);
    table.setSelectionAnchor({ row, col, region });
    return;
  }

  const minRow = Math.min(anchor.row, row);
  const maxRow = Math.max(anchor.row, row);
  const minCol = Math.min(anchor.col, col);
  const maxCol = Math.max(anchor.col, col);

  const cellIds: string[] = [];
  const rows = snapshot.getRowsInRegion(region as Region);
  for (const r of rows) {
    if (r.rowIndex < minRow || r.rowIndex > maxRow) continue;
    for (const [colIdx, c] of r.cells) {
      if (colIdx >= minCol && colIdx <= maxCol) {
        cellIds.push(c.cellID);
      }
    }
  }
  table.selectCells(cellIds);
}

/**
 * Build a merge Rect from the currently selected cells.
 * Returns null if selection is invalid for merge.
 */
export function buildMergeRect(
  table: Table,
  snapshot: RenderableTableInstance,
): Rect | null {
  const uiState = table.getUIState();
  const selected = uiState.selectedCells;
  if (selected.size < 2) return null;

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  let primaryRegion: Region | undefined;
  let firstCellId: string | undefined;

  for (const cellId of selected) {
    const cell = snapshot.getCellByID(cellId);
    if (!cell) return null;

    if (!primaryRegion) {
      primaryRegion = cell.inRegion;
      firstCellId = cellId;
    } else if (cell.inRegion !== primaryRegion) {
      return null;
    }

    minRow = Math.min(minRow, cell.layout.row);
    maxRow = Math.max(maxRow, cell.layout.row);
    minCol = Math.min(minCol, cell.layout.col);
    maxCol = Math.max(maxCol, cell.layout.col);
  }

  if (!firstCellId || !primaryRegion) return null;

  const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  if (selected.size !== expectedCount) return null;

  return {
    cellId: firstCellId,
    startRow: minRow,
    startCol: minCol,
    endRow: maxRow,
    endCol: maxCol,
    primaryRegion,
  };
}
