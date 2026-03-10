/**
 * PropPanel for the Dynamic Table pdfme plugin.
 *
 * Defines the property editor sidebar when the user selects a dynamic table
 * schema in the pdfme Designer. Intentionally minimal — table structure
 * editing happens through the interactive UI, not the sidebar.
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

  return JSON.stringify(table.exportState());
}

export const propPanel: PropPanel<DynamicTableSchema> = {
  schema: {
    showGridLines: {
      type: 'boolean',
      widget: 'switch',
      props: { label: 'Show Grid Lines' },
    },
  },

  defaultSchema: {
    name: '',
    type: SCHEMA_TYPE,
    content: createDefaultTableValue(),
    position: { x: 0, y: 0 },
    width: 150,
    height: 80,
    showGridLines: true,
    readOnly: false,
  },
};
