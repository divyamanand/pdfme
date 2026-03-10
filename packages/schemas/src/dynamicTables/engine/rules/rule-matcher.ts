/**
 * RuleMatcher — pure function that checks whether a rule's target matches a given cell.
 *
 * Used by RuleRegistry.getRulesForCell() to filter applicable rules.
 */

import type { ICell } from '../interfaces/core';
import type { ICellRegistry } from '../interfaces/stores/cell-registry.interface';
import type { IStructureStore } from '../interfaces/stores/structure-store.interface';
import type { Rule } from './types/rule.types';
import type { RuleTarget, ColumnTarget } from '../types/rule-target.types';

export interface MatchContext {
  /** Number of layout grid rows occupied by theader. body rowIndex = cell.layout.row - theaderDepth */
  theaderDepth: number;
  /** Number of layout grid cols occupied by lheader. body colIndex = cell.layout.col - lheaderDepth */
  lheaderDepth: number;
  /** For column(headerName) resolution */
  structureStore: IStructureStore;
  /** For reading theader leaf cell rawValue */
  cellRegistry: ICellRegistry;
}

/**
 * Check whether a rule's target matches the given cell.
 */
export function matchesCell(rule: Rule, cell: ICell, ctx: MatchContext): boolean {
  const target = rule.target;

  switch (target.scope) {
    case 'table':
      return true;

    case 'region':
      return cell.inRegion === target.region;

    case 'column':
      return matchColumn(target, cell, ctx);

    case 'row':
      return matchRow(target, cell, ctx);

    case 'cell':
      return matchCell(target, cell);

    case 'selection':
      return matchSelection(target, cell, ctx);

    default:
      return false;
  }
}

function matchColumn(target: ColumnTarget, cell: ICell, ctx: MatchContext): boolean {
  // Resolve the target column index
  let colIndex: number | undefined;

  if ('colIndex' in target) {
    colIndex = target.colIndex;
  } else {
    colIndex = resolveHeaderNameToColIndex(target.headerName, ctx);
    if (colIndex === undefined) return false;
  }

  // Body cell match
  if (cell.inRegion === 'body') {
    if (!cell.layout) return false;
    return cell.layout.col - ctx.lheaderDepth === colIndex;
  }

  // Header cell match (only when includeHeader is true)
  if (target.includeHeader && cell.inRegion === 'theader') {
    if (!cell.layout) return false;
    return (
      cell.layout.col - ctx.lheaderDepth === colIndex &&
      ctx.structureStore.isLeafCell(cell.cellID)
    );
  }

  return false;
}

function matchRow(
  target: { scope: 'row'; rowIndex: number; region?: 'theader' | 'body' },
  cell: ICell,
  ctx: MatchContext,
): boolean {
  if (!cell.layout) return false;

  const region = target.region ?? 'body';

  if (region === 'body') {
    return cell.inRegion === 'body' && cell.layout.row - ctx.theaderDepth === target.rowIndex;
  }

  // theader: layout.row is already the depth level (theader rows start at 0)
  return cell.inRegion === 'theader' && cell.layout.row === target.rowIndex;
}

function matchCell(
  target: { scope: 'cell'; cellId?: string; address?: { rowIndex: number; colIndex: number } },
  cell: ICell,
): boolean {
  if ('cellId' in target && target.cellId !== undefined) {
    return cell.cellID === target.cellId;
  }

  if ('address' in target && target.address !== undefined) {
    if (!cell.layout) return false;
    return cell.layout.row === target.address.rowIndex && cell.layout.col === target.address.colIndex;
  }

  return false;
}

function matchSelection(
  target: { scope: 'selection'; rect: { rowStart: number; colStart: number; rowEnd: number; colEnd: number } },
  cell: ICell,
  ctx: MatchContext,
): boolean {
  if (cell.inRegion !== 'body' || !cell.layout) return false;

  const bodyRow = cell.layout.row - ctx.theaderDepth;
  const bodyCol = cell.layout.col - ctx.lheaderDepth;

  return (
    bodyRow >= target.rect.rowStart &&
    bodyRow <= target.rect.rowEnd &&
    bodyCol >= target.rect.colStart &&
    bodyCol <= target.rect.colEnd
  );
}

/**
 * Resolve a theader leaf cell's rawValue to a 0-based body column index.
 * Returns undefined if no leaf cell with that name is found.
 */
export function resolveHeaderNameToColIndex(
  headerName: string,
  ctx: MatchContext,
): number | undefined {
  const roots = ctx.structureStore.getRoots('theader');
  if (!roots) return undefined;

  for (const rootId of roots) {
    const result = findLeafByName(rootId, headerName, ctx);
    if (result !== undefined) return result;
  }

  return undefined;
}

function findLeafByName(
  cellId: string,
  headerName: string,
  ctx: MatchContext,
): number | undefined {
  if (ctx.structureStore.isLeafCell(cellId)) {
    const cell = ctx.cellRegistry.getCellById(cellId);
    if (cell && String(cell.rawValue) === headerName) {
      return ctx.structureStore.getBodyIndexForHeaderLeafCell('theader', cellId);
    }
    return undefined;
  }

  const children = ctx.structureStore.getChildren(cellId);
  if (!children) return undefined;

  for (const childId of children) {
    const result = findLeafByName(childId, headerName, ctx);
    if (result !== undefined) return result;
  }

  return undefined;
}
