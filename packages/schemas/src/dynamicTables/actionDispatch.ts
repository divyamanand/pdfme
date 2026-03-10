/**
 * Centralized mutation dispatch for the dynamic table plugin.
 *
 * Every UI action flows through here:
 *   dispatch.someAction(...) → instanceManager.update() → onChange({ key: 'content', value })
 *
 * This keeps UI components focused on DOM concerns — they never touch
 * the instanceManager or onChange callback directly.
 */

import type { Table, Region, Rect, TableStyle, RegionStyle, BodyRegionStyle, TableSettings } from './engine/index.js';
import { instanceManager } from './instanceManager.js';

type OnChangeFn = (arg: { key: string; value: unknown } | { key: string; value: unknown }[]) => void;

export interface ActionDispatch {
  updateCell: (cellId: string, rawValue: string | number) => void;
  insertBodyRow: (rowIndex?: number) => void;
  removeBodyRow: (rowIndex: number) => void;
  addColumn: () => void;
  removeBodyCol: (colIndex: number) => void;
  insertBodyCol: (colIndex: number) => void;
  setColumnWidth: (colIndex: number, width: number) => void;
  setRowHeight: (rowIndex: number, height: number) => void;
  mergeCells: (rect: Rect) => void;
  unmergeCells: (cellId: string) => void;
  updateSettings: (patch: Partial<TableSettings>) => void;
  setTableStyle: (patch: Partial<TableStyle>) => void;
  setRegionStyle: (region: Region, style: RegionStyle | BodyRegionStyle) => void;
}

export function createActionDispatch(schemaName: string, onChange: OnChangeFn): ActionDispatch {
  function dispatch(mutator: (table: Table) => void): void {
    const newValue = instanceManager.update(schemaName, mutator);
    onChange({ key: 'content', value: newValue });
  }

  return {
    updateCell: (cellId, rawValue) =>
      dispatch((t) => t.updateCell(cellId, { rawValue })),

    insertBodyRow: (rowIndex?) =>
      dispatch((t) => t.insertBodyRow(rowIndex ?? t.getRowHeights().length)),

    removeBodyRow: (rowIndex) =>
      dispatch((t) => t.removeBodyRow(rowIndex)),

    addColumn: () =>
      dispatch((t) => t.addHeaderCell('theader')),

    removeBodyCol: (colIndex) =>
      dispatch((t) => t.removeBodyCol(colIndex)),

    insertBodyCol: (colIndex) =>
      dispatch((t) => t.insertBodyCol(colIndex)),

    setColumnWidth: (colIndex, width) =>
      dispatch((t) => t.setColumnWidth(colIndex, width)),

    setRowHeight: (rowIndex, height) =>
      dispatch((t) => t.setRowHeight(rowIndex, height)),

    mergeCells: (rect) =>
      dispatch((t) => t.mergeCells(rect)),

    unmergeCells: (cellId) =>
      dispatch((t) => t.unmergeCells(cellId)),

    updateSettings: (patch) =>
      dispatch((t) => t.updateSettings(patch)),

    setTableStyle: (patch) =>
      dispatch((t) => t.setTableStyle(patch)),

    setRegionStyle: (region, style) =>
      dispatch((t) => t.setRegionStyle(region, style)),
  };
}
