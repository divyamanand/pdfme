import type { Schema, TableConditionalFormatting } from '@pdfme/common';
import type { CellStyle } from '../tables/types.js';

export interface NestedHeaderNode {
  id: string;
  label: string;
  children: NestedHeaderNode[];
  width?: number;
}

export interface NestedTableSchema extends Schema {
  headerTree: NestedHeaderNode[];
  showHead: boolean;
  repeatHead?: boolean;
  tableStyles: { borderColor: string; borderWidth: number };
  headStyles: CellStyle;
  bodyStyles: CellStyle & { alternateBackgroundColor: string };
  columnStyles: { alignment?: { [leafColIndex: number]: 'left' | 'center' | 'right' } };
  conditionalFormatting?: TableConditionalFormatting;
}

export interface HeaderCell {
  node: NestedHeaderNode;
  label: string;
  colspan: number;
  rowspan: number;
  row: number;
  colStart: number;
}
