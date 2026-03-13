/**
 * RangeResolver — resolves range notation strings to ICell[] arrays.
 *
 * Notations:
 *   - "col:0"     → all cells in column 0
 *   - "col:self"  → all cells in the target column (rule scope)
 *   - "row:3"     → all cells in row 3
 *   - "row:self"  → all cells in the target row (rule scope)
 *   - "r0c0:r2c3" → rectangular selection (rows 0-2, cols 0-3)
 *   - "body"      → all body cells
 *   - "self"      → selection rect (for selection-scoped rules)
 */

import type { ICell } from '../../interfaces/core/cell.interface';
import type { EvalContext } from '../types/evaluation.types';

export class RangeResolverError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'RangeResolverError';
  }
}

/**
 * Resolve a range notation string to an array of cells.
 * @param notation - range notation (e.g., "col:0", "row:self", "r0c0:r2c3", "body")
 * @param ctx - evaluation context with cellRegistry, structureStore
 * @returns array of ICell objects
 */
export function resolveRangeRef(notation: string, ctx: EvalContext): ICell[] {
  notation = notation.trim();

  // "body" — all body cells
  if (notation === 'body') {
    return resolveBodies(ctx);
  }

  // "self" — selection rect (for selection-scoped rules)
  if (notation === 'self') {
    if (!ctx.selectionRect) {
      throw new RangeResolverError('Notation "self" requires selectionRect in context');
    }
    return resolveRect(ctx.selectionRect, ctx);
  }

  // "col:N" or "col:self" — all cells in a column
  if (notation.startsWith('col:')) {
    const colPart = notation.substring(4);
    let colIndex: number;

    if (colPart === 'self') {
      if (ctx.colIndex === undefined) {
        throw new RangeResolverError('Notation "col:self" requires colIndex in context');
      }
      colIndex = ctx.colIndex;
    } else {
      colIndex = parseInt(colPart, 10);
      if (isNaN(colIndex)) {
        throw new RangeResolverError(`Invalid column index: ${colPart}`);
      }
    }

    return resolveColumn(colIndex, ctx);
  }

  // "row:N" or "row:self" — all cells in a row
  if (notation.startsWith('row:')) {
    const rowPart = notation.substring(4);
    let rowIndex: number;

    if (rowPart === 'self') {
      if (ctx.rowIndex === undefined) {
        throw new RangeResolverError('Notation "row:self" requires rowIndex in context');
      }
      rowIndex = ctx.rowIndex;
    } else {
      rowIndex = parseInt(rowPart, 10);
      if (isNaN(rowIndex)) {
        throw new RangeResolverError(`Invalid row index: ${rowPart}`);
      }
    }

    return resolveRow(rowIndex, ctx);
  }

  // "r0c0:r2c3" — rectangular selection
  const rectMatch = notation.match(/^r(\d+)c(\d+):r(\d+)c(\d+)$/);
  if (rectMatch) {
    const rect = {
      rowStart: parseInt(rectMatch[1], 10),
      colStart: parseInt(rectMatch[2], 10),
      rowEnd: parseInt(rectMatch[3], 10),
      colEnd: parseInt(rectMatch[4], 10),
    };
    return resolveRect(rect, ctx);
  }

  throw new RangeResolverError(`Unknown range notation: ${notation}`);
}

/** Resolve all body cells */
function resolveBodies(ctx: EvalContext): ICell[] {
  const cells: ICell[] = [];
  const body = ctx.structureStore.getBody();

  for (let r = 0; r < body.length; r++) {
    for (let c = 0; c < body[r].length; c++) {
      const cellId = body[r][c];
      const cell = ctx.cellRegistry.getCellById(cellId);
      if (cell) cells.push(cell);
    }
  }

  return cells;
}

/** Resolve all cells in a column */
function resolveColumn(colIndex: number, ctx: EvalContext): ICell[] {
  const cells: ICell[] = [];
  const body = ctx.structureStore.getBody();

  for (let r = 0; r < body.length; r++) {
    if (colIndex < body[r].length) {
      const cellId = body[r][colIndex];
      const cell = ctx.cellRegistry.getCellById(cellId);
      if (cell) cells.push(cell);
    }
  }

  return cells;
}

/** Resolve all cells in a row */
function resolveRow(rowIndex: number, ctx: EvalContext): ICell[] {
  const cells: ICell[] = [];
  const body = ctx.structureStore.getBody();

  if (rowIndex >= 0 && rowIndex < body.length) {
    for (let c = 0; c < body[rowIndex].length; c++) {
      const cellId = body[rowIndex][c];
      const cell = ctx.cellRegistry.getCellById(cellId);
      if (cell) cells.push(cell);
    }
  }

  return cells;
}

/** Resolve a rectangular selection */
function resolveRect(
  rect: {
    rowStart: number;
    colStart: number;
    rowEnd: number;
    colEnd: number;
  },
  ctx: EvalContext,
): ICell[] {
  const cells: ICell[] = [];
  const body = ctx.structureStore.getBody();

  for (let r = rect.rowStart; r <= rect.rowEnd && r < body.length; r++) {
    for (let c = rect.colStart; c <= rect.colEnd && c < body[r].length; c++) {
      const cellId = body[r][c];
      const cell = ctx.cellRegistry.getCellById(cellId);
      if (cell) cells.push(cell);
    }
  }

  return cells;
}
