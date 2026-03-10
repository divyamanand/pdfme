/**
 * Cell selection tracking for the dynamic table designer mode.
 * Supports single click and shift+click range selection.
 */

import type { RenderableTableInstance, Rect, Region } from '../engine/index.js';
import { state } from '../uiState.js';

/**
 * Handle a cell click for selection purposes.
 * Without shift: single selection (clears previous).
 * With shift: rectangular range from anchor to clicked cell.
 */
export function handleCellClick(
  cellId: string,
  row: number,
  col: number,
  region: string,
  shiftKey: boolean,
  renderable: RenderableTableInstance,
): void {
  if (!shiftKey) {
    state.selectedCells.clear();
    state.selectedCells.add(cellId);
    state.selectionAnchor = { row, col, region };
    return;
  }

  // Shift+click: range selection from anchor
  if (!state.selectionAnchor || state.selectionAnchor.region !== region) {
    // No anchor or different region — just single select
    state.selectedCells.clear();
    state.selectedCells.add(cellId);
    state.selectionAnchor = { row, col, region };
    return;
  }

  const anchor = state.selectionAnchor;
  const minRow = Math.min(anchor.row, row);
  const maxRow = Math.max(anchor.row, row);
  const minCol = Math.min(anchor.col, col);
  const maxCol = Math.max(anchor.col, col);

  state.selectedCells.clear();
  const rows = renderable.getRowsInRegion(region as Region);
  for (const r of rows) {
    if (r.rowIndex < minRow || r.rowIndex > maxRow) continue;
    for (const [colIdx, cell] of r.cells) {
      if (colIdx >= minCol && colIdx <= maxCol) {
        state.selectedCells.add(cell.cellID);
      }
    }
  }
}

/**
 * Build a merge Rect from the currently selected cells.
 * Returns null if selection is invalid for merge (< 2 cells, not a rectangle, or spans regions).
 */
export function buildMergeRect(
  renderable: RenderableTableInstance,
): Rect | null {
  const selected = state.selectedCells;
  if (selected.size < 2) return null;

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  let primaryRegion: Region | undefined;
  let firstCellId: string | undefined;

  for (const cellId of selected) {
    const cell = renderable.getCellByID(cellId);
    if (!cell) return null;

    if (!primaryRegion) {
      primaryRegion = cell.inRegion;
      firstCellId = cellId;
    } else if (cell.inRegion !== primaryRegion) {
      return null; // Can't merge across regions
    }

    minRow = Math.min(minRow, cell.layout.row);
    maxRow = Math.max(maxRow, cell.layout.row);
    minCol = Math.min(minCol, cell.layout.col);
    maxCol = Math.max(maxCol, cell.layout.col);
  }

  if (!firstCellId || !primaryRegion) return null;

  // Verify the selection forms a complete rectangle
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

/**
 * Clear all cell selection.
 */
export function clearSelection(): void {
  state.selectedCells.clear();
  state.selectionAnchor = null;
}
