/**
 * Barrel export for the campx dynamic table engine.
 * Exposes the public API needed by the pdfme plugin layer.
 */

// Core
export { Table } from './core/table';
export { Cell } from './core/cell';

// Stores
export { StructureStore } from './stores/structure.store';
export { CellRegistry } from './stores/cell-registry.store';
export { MergeRegistry } from './stores/merge-registry.stores';

// Engines
export { LayoutEngine } from './engines/layout.engine';

// Rules
export { RuleEngine } from './rules/rule-engine';
export { RuleRegistry } from './rules/rule-registry';

// Renderers
export { RenderableTable } from './renderers/renderable-table';

// Types — renderable
export type {
  RenderableTableInstance,
  RenderableCell,
  RenderableRow,
  RenderableColumn,
  RenderableMerge,
} from './renderers/types/renderable-types';

// Types — serialization
export type {
  TableExportData,
  SerializedHeaderNode,
  SerializedBodyCell,
} from './renderers/types/serialization.types';

// Types — common
export type {
  Region,
  CellStyle,
  CellLayout,
  TableStyle,
  RegionStyleMap,
  TableSettings,
  Spacing,
} from './types/common';
