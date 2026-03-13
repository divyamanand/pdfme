/**
 * Barrel export for the entire rules module.
 */

// Expression evaluator
export * from './expression';

// Rule types
export type { Rule, RulePayload, RuleInput, RuleUpdate } from './types/rule.types';

export type {
  EvalContext,
  RuleOutput,
  StylePatch,
  DeltaInstruction,
  ComputedValue,
  ValidationResult as RuleValidationResult,
  RenderFlag,
  VisibilityFlag,
  LockFlag,
  EvaluationResult,
  ResolvedCell,
  RuleEvaluationStats,
} from './types/evaluation.types';

// Rule Registry
export { RuleRegistry, ruleRegistry } from './rule-registry';
export type { IRuleRegistry, MatchContext } from '../interfaces/rules';

// Rule Engine
export { RuleEngine } from './rule-engine';
export type { IRuleEngine } from '../interfaces/rules';

// Rule Matcher
export { matchesCell } from './rule-matcher';

// Scope vocabulary (for canvas UI)
export { SCOPE_VOCABULARY } from './expression/scope-vocabulary';
export type { RuleScope } from './expression/scope-vocabulary';
