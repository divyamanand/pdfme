/**
 * RuleEngine — evaluates rules against cells and stores results.
 *
 * For each cell: find matching rules via RuleRegistry → evaluate condition AST →
 * if true, evaluate result AST → classify output into EvaluationResult.
 */

import type { IRuleEngine } from '../interfaces/rules/rule-engine.interface';
import type { IRuleRegistry } from '../interfaces/rules/rule-registry.interface';
import type { ICellRegistry } from '../interfaces/stores/cell-registry.interface';
import type { IStructureStore } from '../interfaces/stores/structure-store.interface';
import type { ITable } from '../interfaces/table/table.inteface';
import type { ICell } from '../interfaces/core';
import type { MatchContext } from './rule-matcher';
import type { Rule, RulePayload } from './types/rule.types';
import { resolveStyle } from '../styles/resolve';
import type {
  EvalContext,
  EvaluationResult,
  ResolvedCell,
  StylePatch,
  DeltaInstruction,
  RenderFlag,
} from './types/evaluation.types';
import { Evaluator } from './expression/evaluator';
import { Region } from '../types';

export class RuleEngine implements IRuleEngine {
  private results = new Map<string, EvaluationResult>();

  constructor(
    private ruleRegistry: IRuleRegistry,
    private cellRegistry: ICellRegistry,
    private structureStore: IStructureStore,
    private table: ITable,
  ) {}

  evaluateCell(cell: ICell): EvaluationResult {
    const matchCtx = this.buildMatchContext();
    const result = this.evaluateCellWithContext(cell, matchCtx);
    this.results.set(cell.cellID, result);
    return result;
  }

  evaluateAll(): void {
    this.results.clear();
    const matchCtx = this.buildMatchContext();

    // Walk all header trees
    for (const region of ['theader', 'lheader', 'rheader', 'footer'] as Region[]) {
      const roots = this.structureStore.getRoots(region);
      if (roots) {
        for (const rootId of roots) {
          this.walkTree(rootId, matchCtx);
        }
      }
    }

    // Walk body cells
    for (const row of this.structureStore.getBody()) {
      for (const cellId of row) {
        const cell = this.cellRegistry.getCellById(cellId);
        if (cell) {
          const result = this.evaluateCellWithContext(cell, matchCtx);
          this.results.set(cellId, result);
        }
      }
    }
  }

  getResult(cellId: string): EvaluationResult | undefined {
    return this.results.get(cellId);
  }

  getAllResults(): ReadonlyMap<string, EvaluationResult> {
    return this.results;
  }

  resolveCell(cell: ICell): ResolvedCell {
    let evalResult = this.results.get(cell.cellID);
    if (!evalResult) {
      evalResult = this.evaluateCell(cell);
    }

    // Resolve style through cascade: default → region → cell → rule patches
    const regionStyle = this.table.getRegionStyle(cell.inRegion);
    const rulePatches = evalResult.stylePatches.map(p => p.style);
    const mergedStyle = resolveStyle(regionStyle, cell.styleOverrides, ...rulePatches);

    // Merge render flags
    const renderFlags: ResolvedCell['renderFlags'] = {};
    for (const flag of evalResult.renderFlags) {
      if (flag.clip !== undefined) renderFlags.clip = flag.clip;
      if (flag.wrap !== undefined) renderFlags.wrap = flag.wrap;
    }

    const layout = cell.layout;

    return {
      cellId: cell.cellID,
      displayValue: evalResult.computedValue ?? cell.rawValue,
      layout: layout
        ? { row: layout.row, col: layout.col, rowSpan: layout.rowSpan, colSpan: layout.colSpan, x: layout.x, y: layout.y, width: layout.width, height: layout.height }
        : { row: 0, col: 0, rowSpan: 1, colSpan: 1, x: 0, y: 0, width: 0, height: 0 },
      resolvedStyle: mergedStyle,
      renderFlags,
      hidden: evalResult.hidden,
      locked: evalResult.locked,
      validation: evalResult.validationResult
        ? { valid: evalResult.validationResult.valid, message: evalResult.validationResult.message, severity: evalResult.validationResult.severity }
        : undefined,
    };
  }

  clearResults(): void {
    this.results.clear();
  }

  exportRules(): RulePayload[] {
    return this.ruleRegistry.export();
  }

  importRules(payloads: RulePayload[]): void {
    this.ruleRegistry.import(payloads);
  }

  // --- internal ---

  private buildMatchContext(): MatchContext {
    const thRoots = this.structureStore.getRoots('theader') ?? [];
    const lhRoots = this.structureStore.getRoots('lheader') ?? [];
    return {
      theaderDepth: thRoots.reduce((m, r) => Math.max(m, this.structureStore.getHeightOfCell(r)), 0),
      lheaderDepth: lhRoots.reduce((m, r) => Math.max(m, this.structureStore.getHeightOfCell(r)), 0),
      structureStore: this.structureStore,
      cellRegistry: this.cellRegistry,
    };
  }

  private buildEvalContext(cell: ICell, matchCtx: MatchContext): EvalContext {
    const ctx: EvalContext = {
      cell,
      table: this.table,
      cellRegistry: this.cellRegistry,
      structureStore: this.structureStore,
    };

    if (cell.layout) {
      if (cell.inRegion === 'body') {
        ctx.rowIndex = cell.layout.row - matchCtx.theaderDepth;
        ctx.colIndex = cell.layout.col - matchCtx.lheaderDepth;
      } else {
        ctx.rowIndex = cell.layout.row;
        ctx.colIndex = cell.layout.col;
      }
    }

    return ctx;
  }

  private evaluateCellWithContext(cell: ICell, matchCtx: MatchContext): EvaluationResult {
    const rules = this.ruleRegistry.getRulesForCell(cell, matchCtx);
    const evalCtx = this.buildEvalContext(cell, matchCtx);

    const result: EvaluationResult = {
      cellId: cell.cellID,
      stylePatches: [],
      deltaInstructions: [],
      renderFlags: [],
      firedRuleIds: [],
    };

    for (const rule of rules) {
      try {
        this.evaluateRule(rule, evalCtx, result);
      } catch {
        // Don't let one rule break all evaluation
      }
    }

    return result;
  }

  private evaluateRule(rule: Rule, evalCtx: EvalContext, result: EvaluationResult): void {
    if (!rule._conditionAst || !rule._resultAst) return;

    const conditionValue = Evaluator.evaluate(rule._conditionAst, evalCtx);
    if (!toBool(conditionValue)) return;

    const output = Evaluator.evaluate(rule._resultAst, evalCtx);
    result.firedRuleIds.push(rule.ruleId);
    this.classifyOutput(output, result);
  }

  private classifyOutput(output: any, result: EvaluationResult): void {
    if (output == null || typeof output !== 'object') return;

    // Discriminated by type field
    if ('type' in output) {
      switch (output.type) {
        case 'style':
          result.stylePatches.push(output as StylePatch);
          break;
        case 'row-height-min':
        case 'col-width-min':
          result.deltaInstructions.push(output as DeltaInstruction);
          break;
        case 'computedValue':
          result.computedValue = output.value;
          break;
        case 'validation':
          result.validationResult = output;
          break;
        case 'renderFlag':
          result.renderFlags.push(output as RenderFlag);
          break;
        case 'visibility':
          result.hidden = output.hidden;
          break;
        case 'lock':
          result.locked = output.locked;
          break;
      }
      return;
    }

    // Object without type but has style key → treat as StylePatch
    if ('style' in output && typeof output.style === 'object') {
      result.stylePatches.push({ type: 'style', style: output.style });
    }
  }

  private walkTree(cellId: string, matchCtx: MatchContext): void {
    const cell = this.cellRegistry.getCellById(cellId);
    if (cell) {
      const result = this.evaluateCellWithContext(cell, matchCtx);
      this.results.set(cellId, result);
    }

    const children = this.structureStore.getChildren(cellId);
    if (children) {
      for (const childId of children) {
        this.walkTree(childId, matchCtx);
      }
    }
  }
}

function toBool(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '';
  return true;
}
