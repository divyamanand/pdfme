/**
 * RuleRegistry — stores rules and answers "which rules apply to this cell?"
 *
 * Manages CRUD, AST compilation, valueDeps extraction, and the depIndex
 * for reactive re-evaluation.
 */

import type { IRuleRegistry } from '../interfaces/rules';
import type { ICell } from '../interfaces/core';
import type { Rule, RuleInput, RulePayload, RuleUpdate } from './types/rule.types';
import type { RuleScope } from '../types/rule-target.types';
import { Compiler } from './expression/compiler';
import { extractVarPaths } from './expression/extract-deps';
import { matchesCell, type MatchContext } from './rule-matcher';

export class RuleRegistry implements IRuleRegistry {
  private rules = new Map<string, Rule>();
  private depIndex = new Map<string, Set<string>>();

  addRule(input: RuleInput): string {
    const ruleId = crypto.randomUUID();
    const rule = this.buildRule(ruleId, input);
    this.rules.set(ruleId, rule);
    this.addToDep(ruleId, rule.valueDeps);
    return ruleId;
  }

  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    this.removeFromDep(ruleId, rule.valueDeps);
    this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, update: RuleUpdate): boolean {
    const existing = this.rules.get(ruleId);
    if (!existing) return false;

    const needsRecompile = update.condition !== undefined || update.result !== undefined;
    const condition = update.condition ?? existing.condition;
    const result = update.result ?? existing.result;

    let conditionAst = existing._conditionAst;
    let resultAst = existing._resultAst;
    let valueDeps = existing.valueDeps;

    if (needsRecompile) {
      conditionAst = Compiler.compile(condition);
      resultAst = Compiler.compile(result);
      const newDeps = dedup([...extractVarPaths(conditionAst), ...extractVarPaths(resultAst)]);
      this.removeFromDep(ruleId, existing.valueDeps);
      this.addToDep(ruleId, newDeps);
      valueDeps = newDeps;
    }

    const updated: Rule = {
      ...existing,
      ...update,
      ruleId,
      condition,
      result,
      _conditionAst: conditionAst,
      _resultAst: resultAst,
      valueDeps,
    };

    this.rules.set(ruleId, updated);
    return true;
  }

  getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  getAll(): Rule[] {
    return [...this.rules.values()];
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = true;
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = false;
  }

  getRulesForCell(cell: ICell, ctx: MatchContext): Rule[] {
    const matched: Rule[] = [];
    for (const rule of this.rules.values()) {
      if (rule.enabled && matchesCell(rule, cell, ctx)) {
        matched.push(rule);
      }
    }
    matched.sort((a, b) => a.priority - b.priority);
    return matched;
  }

  getRulesByScope(scope: RuleScope): Rule[] {
    return [...this.rules.values()].filter(r => r.target.scope === scope);
  }

  searchByLabel(query: string): Rule[] {
    const lower = query.toLowerCase();
    return [...this.rules.values()].filter(r => r.label?.toLowerCase().includes(lower));
  }

  getRulesByValueDep(depKey: string): Rule[] {
    const ids = this.depIndex.get(depKey);
    if (!ids) return [];
    const result: Rule[] = [];
    for (const id of ids) {
      const rule = this.rules.get(id);
      if (rule) result.push(rule);
    }
    return result;
  }

  export(): RulePayload[] {
    return [...this.rules.values()].map(({ _conditionAst, _resultAst, ...payload }) => payload);
  }

  import(payloads: RulePayload[]): void {
    this.rules.clear();
    this.depIndex.clear();
    for (const payload of payloads) {
      const rule = this.buildRule(payload.ruleId, payload);
      this.rules.set(payload.ruleId, rule);
      this.addToDep(payload.ruleId, rule.valueDeps);
    }
  }

  // --- internal helpers ---

  private buildRule(ruleId: string, input: Pick<Rule, 'target' | 'condition' | 'result' | 'priority' | 'enabled' | 'label'>): Rule {
    const conditionAst = Compiler.compile(input.condition);
    const resultAst = Compiler.compile(input.result);
    const valueDeps = dedup([...extractVarPaths(conditionAst), ...extractVarPaths(resultAst)]);

    return {
      ruleId,
      target: input.target,
      condition: input.condition,
      result: input.result,
      _conditionAst: conditionAst,
      _resultAst: resultAst,
      priority: input.priority,
      enabled: input.enabled,
      label: input.label,
      valueDeps,
    };
  }

  private addToDep(ruleId: string, deps: string[]): void {
    for (const dep of deps) {
      let set = this.depIndex.get(dep);
      if (!set) {
        set = new Set();
        this.depIndex.set(dep, set);
      }
      set.add(ruleId);
    }
  }

  private removeFromDep(ruleId: string, deps: string[]): void {
    for (const dep of deps) {
      const set = this.depIndex.get(dep);
      if (set) {
        set.delete(ruleId);
        if (set.size === 0) this.depIndex.delete(dep);
      }
    }
  }
}

function dedup(arr: string[]): string[] {
  return [...new Set(arr)];
}

export const ruleRegistry = new RuleRegistry();
