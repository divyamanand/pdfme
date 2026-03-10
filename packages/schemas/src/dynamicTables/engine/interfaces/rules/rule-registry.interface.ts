import type { ICell } from '../core';
import type { Rule, RuleInput, RulePayload, RuleUpdate } from '../../rules/types/rule.types';
import type { RuleScope } from '../../types/rule-target.types';

export type { MatchContext } from '../../rules/rule-matcher';

export interface IRuleRegistry {
  // CRUD
  addRule(input: RuleInput): string;
  removeRule(ruleId: string): void;
  updateRule(ruleId: string, update: RuleUpdate): boolean;
  getRule(ruleId: string): Rule | undefined;
  getAll(): Rule[];

  // Enable / disable
  enableRule(ruleId: string): void;
  disableRule(ruleId: string): void;

  // Core query: enabled rules matching this cell, sorted by priority ascending
  getRulesForCell(cell: ICell, ctx: import('../../rules/rule-matcher').MatchContext): Rule[];

  // Query helpers
  getRulesByScope(scope: RuleScope): Rule[];
  searchByLabel(query: string): Rule[];
  getRulesByValueDep(depKey: string): Rule[];

  // Serialization
  export(): RulePayload[];
  import(payloads: RulePayload[]): void;
}
