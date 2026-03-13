/**
 * PropPanel for the Dynamic Table pdfme plugin.
 *
 * Uses function-based schema to dynamically show/hide sections based on
 * current table state. Custom widgets handle style/settings editing by
 * reading from and writing to the serialized table content.
 */

import type { PropPanel } from '@pdfme/common';
import {
  Table,
  StructureStore,
  CellRegistry,
  MergeRegistry,
  LayoutEngine,
  RuleEngine,
  RuleRegistry,
} from './engine/index.js';
import type { DynamicTableSchema } from './types.js';
import { SCHEMA_TYPE } from './types.js';
import {
  headerVisibilityWidget,
  constraintsWidget,
  overflowWidget,
  tableStyleWidget,
  regionStyleSelectWidget,
  structureWidget,
} from './helpers/propPanelWidgets.js';

/**
 * Create a default TableExportData JSON string for a minimal 3-column, 3-row table.
 * Used as the initial value when a new dynamic table schema is added.
 */
export function createDefaultTableValue(): string {
  const structureStore = new StructureStore();
  const cellRegistry = new CellRegistry();
  const mergeRegistry = new MergeRegistry(structureStore);
  const layoutEngine = new LayoutEngine(mergeRegistry, structureStore, cellRegistry);
  const ruleRegistry = new RuleRegistry();

  // Create temp table for rule engine init
  const tempTable = new Table(
    structureStore, cellRegistry, layoutEngine, mergeRegistry, {} as any,
  );
  const ruleEngine = new RuleEngine(ruleRegistry, cellRegistry, structureStore, tempTable);

  // Create final table with rule engine
  const table = new Table(
    structureStore, cellRegistry, layoutEngine, mergeRegistry, ruleEngine,
  );

  // Add 3 header columns
  const h1 = table.addHeaderCell('theader');
  const h2 = table.addHeaderCell('theader');
  const h3 = table.addHeaderCell('theader');

  table.updateCell(h1, { rawValue: 'Column 1' });
  table.updateCell(h2, { rawValue: 'Column 2' });
  table.updateCell(h3, { rawValue: 'Column 3' });

  // Add 3 body rows
  table.buildBody([
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ]);

  // Set column widths and row heights to match the defaultSchema dimensions (150 × 80mm)
  // 3 cols × 50mm = 150mm width; 4 rows × 20mm = 80mm height
  table.setColumnWidth(0, 50);
  table.setColumnWidth(1, 50);
  table.setColumnWidth(2, 50);
  table.setRowHeight(0, 20);
  table.setRowHeight(1, 20);
  table.setRowHeight(2, 20);
  table.setRowHeight(3, 20);

  return JSON.stringify(table.exportState());
}

export const propPanel: PropPanel<DynamicTableSchema> = {
  schema: () => {
    return {
      // Table Structure — tree view with all region/row/col/merge controls
      structureSection: {
        title: 'Table Structure',
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: {
          structure: { widget: 'structureWidget', span: 24 },
        },
      },
      '---0': { type: 'void', widget: 'Divider' },

      // Table Settings
      settingsSection: {
        title: 'Table Settings',
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: {
          constraints: { widget: 'constraintsWidget', span: 24 },
          overflow: { widget: 'overflowWidget', span: 24 },
        },
      },
      '---1': { type: 'void', widget: 'Divider' },

      // Table Style
      tableStyleSection: {
        title: 'Table Style',
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: {
          tableStyle: { widget: 'tableStyleWidget', span: 24 },
        },
      },
      '---2': { type: 'void', widget: 'Divider' },

      // Region Styles — unified section with region selector
      regionStyles: {
        title: 'Region Styles',
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: {
          regionStyle: { widget: 'regionStyleSelectWidget', span: 24 },
        },
      },
      '---3': { type: 'void', widget: 'Divider' },
    };
  },

  widgets: {
    structureWidget,
    headerVisibilityWidget,
    constraintsWidget,
    overflowWidget,
    tableStyleWidget,
    regionStyleSelectWidget,
  },

  defaultSchema: {
    name: '',
    type: SCHEMA_TYPE,
    content: createDefaultTableValue(),
    position: { x: 0, y: 0 },
    width: 150,
    height: 80,
    readOnly: false,
  },
};
