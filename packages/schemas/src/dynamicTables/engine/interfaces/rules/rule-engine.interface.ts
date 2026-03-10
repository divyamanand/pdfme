import type { ICell } from '../core';
import type { EvaluationResult, ResolvedCell } from '../../rules/types/evaluation.types';
import type { RulePayload } from '../../rules/types/rule.types';

export interface IRuleEngine {
  /** Evaluate all matching rules for one cell. Stores result internally. */
  evaluateCell(cell: ICell): EvaluationResult;

  /** Evaluate all cells in the table. Stores results internally. */
  evaluateAll(): void;

  /** Get the cached evaluation result for a cell. */
  getResult(cellId: string): EvaluationResult | undefined;

  /** Get all cached results. */
  getAllResults(): ReadonlyMap<string, EvaluationResult>;

  /** Build a ResolvedCell (final renderer snapshot) by merging base style + rule patches. */
  resolveCell(cell: ICell): ResolvedCell;

  /** Clear all cached results. */
  clearResults(): void;

  /** Export all rules as serializable payloads. */
  exportRules(): RulePayload[];

  /** Import rules from serializable payloads, replacing all existing rules. */
  importRules(payloads: RulePayload[]): void;
}
