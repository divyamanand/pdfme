/**
 * Types for rule evaluation — context, outputs, and resolved results.
 */

import type { ICell } from '../../interfaces/core/cell.interface';
import type { IStructureStore } from '../../interfaces/stores/structure-store.interface';
import type { ICellRegistry } from '../../interfaces/stores/cell-registry.interface';
import type { CellStyle } from '../../types';
import { ITable } from '../../interfaces';

/**
 * EvalContext — the runtime environment for expression evaluation.
 * Passed to the evaluator so expressions can resolve Vars, FnCalls, and RangeRefs.
 */
export interface EvalContext {
  /** The cell currently being evaluated (if applicable) */
  cell?: ICell;

  /** The table instance (for accessing stores, counts, etc.) */
  table: ITable;

  /** Direct access to cell store for lookups */
  cellRegistry: ICellRegistry;

  /** Direct access to structure store for topology queries */
  structureStore: IStructureStore;

  /** Current row index (for relative "self" resolution in row-scoped rules) */
  rowIndex?: number;

  /** Current column index (for relative "self" resolution in column-scoped rules) */
  colIndex?: number;

  /** Current selection rect (for "self" resolution in selection-scoped rules) */
  selectionRect?: {
    rowStart: number;
    colStart: number;
    rowEnd: number;
    colEnd: number;
  };
}

/**
 * RuleOutput — what a rule's result expression evaluates to.
 * Union of all possible side-effects a rule can produce.
 */
export type RuleOutput =
  | StylePatch
  | DeltaInstruction
  | ComputedValue
  | ValidationResult
  | RenderFlag
  | VisibilityFlag
  | LockFlag;

/**
 * StylePatch — partial style override (never stored on cell, merged at display time).
 * Uses Partial<CellStyle> for pdfme compatibility.
 */
export interface StylePatch {
  type: 'style';
  style: Partial<CellStyle>;
}

/**
 * DeltaInstruction — request to LayoutEngine to adjust geometry.
 * Only ever increases dimensions; never decreases without explicit user action.
 */
export type DeltaInstruction =
  | {
      type: 'row-height-min';
      rowIndex: number;
      minHeight: number; // mm
    }
  | {
      type: 'col-width-min';
      colIndex: number;
      minWidth: number; // mm
    };

/**
 * ComputedValue — rule computes a new value for the cell.
 * Replaces cell.computedValue in the EvaluationResult.
 */
export interface ComputedValue {
  type: 'computedValue';
  value: string | number;
}

/**
 * ValidationResult — rule performs validation and produces error/warning.
 * Stored in EvaluationResult for renderer to display.
 */
export interface ValidationResult {
  type: 'validation';
  valid: boolean;
  message?: string;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * RenderFlag — flags for renderer (e.g., clip overflowing text).
 * Stored in EvaluationResult for renderer to interpret.
 */
export interface RenderFlag {
  type: 'renderFlag';
  clip?: boolean; // if true, renderer clips overflowing content
  wrap?: boolean; // if true, renderer wraps text to cell width
}

/**
 * VisibilityFlag — hide or show the cell.
 */
export interface VisibilityFlag {
  type: 'visibility';
  hidden: boolean;
}

/**
 * LockFlag — lock/unlock the cell for editing.
 */
export interface LockFlag {
  type: 'lock';
  locked: boolean;
}

/**
 * EvaluationResult — the complete result of evaluating all rules for one cell.
 * Collected per cell after all matching rules have fired.
 */
export interface EvaluationResult {
  /** Cell ID being evaluated */
  cellId: string;

  /** Merged style patches from all rules (lower priority rules applied first) */
  stylePatches: StylePatch[];

  /** Geometry delta instructions from overflow/layout rules */
  deltaInstructions: DeltaInstruction[];

  /** Computed value (if any rule produced one) */
  computedValue?: string | number;

  /** Validation result (if any rule validated) */
  validationResult?: ValidationResult;

  /** Render flags (clip, wrap, etc.) */
  renderFlags: RenderFlag[];

  /** Visibility state */
  hidden?: boolean;

  /** Lock state */
  locked?: boolean;

  /** List of rule IDs that evaluated for this cell (for debugging) */
  firedRuleIds: string[];
}

/**
 * ResolvedCell — the final renderer-agnostic snapshot of a cell.
 * Output of the entire evaluation pipeline; both canvas and PDF renderers consume this.
 * No rule logic in renderers — they just draw what's in ResolvedCell.
 */
export interface ResolvedCell {
  /** Cell ID */
  cellId: string;

  /** Display value (rawValue or computedValue from rules) */
  displayValue: string | number;

  /** Layout geometry */
  layout: {
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
    x: number; // mm from table left
    y: number; // mm from table top
    width: number; // mm
    height: number; // mm
  };

  /** Resolved style (base cell style + merged patches from rules) */
  resolvedStyle: CellStyle;

  /** Overflow handling mode */
  overflowMode?: 'clip' | 'wrap' | 'increase-height' | 'increase-width';

  /** Render flags */
  renderFlags: {
    clip?: boolean;
    wrap?: boolean;
  };

  /** Visibility */
  hidden?: boolean;

  /** Edit lock */
  locked?: boolean;

  /** Validation state */
  validation?: {
    valid: boolean;
    message?: string;
    severity?: 'error' | 'warning' | 'info';
  };
}

/**
 * RuleEvaluationStats — for debugging and performance monitoring.
 * Tracks which rules fired and how long evaluation took.
 */
export interface RuleEvaluationStats {
  cellId: string;
  firedRuleIds: string[];
  evaluationTimeMs: number;
  evaluationErrors: Array<{
    ruleId: string;
    error: Error;
  }>;
}
