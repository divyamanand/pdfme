/**
 * Rule — the unified shape for all rules (prebuilt and user-created).
 * Canvas stores condition and result as strings; engine compiles them to AST on first use.
 */

import type { RuleTarget } from '../../types/rule-target.types';
import type { ExprNode } from '../expression/ast.types';

/**
 * A single rule that applies conditions to cells and produces results.
 *
 * Rules are stored with expression strings (so canvas can edit them).
 * The engine compiles strings to AST once and caches the AST.
 * AST cache fields are never serialized to storage.
 */
export interface Rule {
  /** Unique identifier for this rule (assigned by RuleRegistry) */
  ruleId: string;

  /** Which cells this rule applies to (scope + selector) */
  target: RuleTarget;

  /** Condition expression as string (e.g., "cell.value > 100", "always")
   *  Canvas stores and edits this directly.
   *  Evaluates to boolean at runtime.
   */
  condition: string;

  /** Result expression as string (e.g., "{ style: { backgroundColor: 'red' } }")
   *  Canvas stores and edits this directly.
   *  Evaluates to RuleOutput shape at runtime.
   */
  result: string;

  /**
   * Compiled AST cache for condition expression.
   * NOT serialized to storage — regenerated on first evaluation.
   * @internal
   */
  _conditionAst?: ExprNode;

  /**
   * Compiled AST cache for result expression.
   * NOT serialized to storage — regenerated on first evaluation.
   * @internal
   */
  _resultAst?: ExprNode;

  /** Priority determines evaluation order when multiple rules target the same cell.
   *  Lower number = higher priority (evaluates first).
   *  Default: 0 (lowest priority, can be overridden).
   *  Prebuilt rules typically use 0; user rules can use higher values.
   */
  priority: number;

  /** Whether this rule is active. Disabled rules are indexed but not evaluated. */
  enabled: boolean;

  /** Optional human-readable label for canvas UI */
  label?: string;

  /**
   * Dependency keys auto-extracted from result AST.
   * Used by value-dependency-index for reactive re-firing.
   *
   * Examples:
   *   - "cell.value"    → this rule reads cell.value
   *   - "col:2"         → this rule reads column 2 (any cell in it)
   *   - "row:3"         → this rule reads row 3 (any cell in it)
   *   - "table.rowCount"→ this rule reads table.rowCount
   *
   * When any of these keys' values change, this rule is re-evaluated.
   */
  valueDeps: string[];
}

/**
 * Serializable rule payload (for storage/API).
 * Excludes AST cache fields (_conditionAst, _resultAst).
 */
export type RulePayload = Omit<Rule, '_conditionAst' | '_resultAst'>;

/**
 * Rule creation input (canvas or programmatic).
 * ruleId and valueDeps are assigned by the registry.
 */
export type RuleInput = Omit<Rule, 'ruleId' | 'valueDeps' | '_conditionAst' | '_resultAst'>;

/**
 * Partial rule update (e.g., enable/disable, change priority, edit condition).
 */
export type RuleUpdate = Partial<RuleInput>;
