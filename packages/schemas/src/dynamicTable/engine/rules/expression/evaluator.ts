/**
 * Evaluator — walks an AST and evaluates it to a typed value.
 * Handles the engine-specific parts:
 *   - Var resolution (cell.value, table.rowCount)
 *   - FnCall dispatch (SUM, AVG, TEXT_HEIGHT, etc.)
 *   - RangeRef resolution (col:0, row:self, body, etc.)
 *
 * Everything else (literals, operators, object literals) is standard expression evaluation.
 */

import type { ExprNode } from './ast.types';
import type { EvalContext } from '../types/evaluation.types';
import { resolveVar } from './var-catalog';
import { functionRegistry } from './functions/registry';
import { resolveRangeRef } from './range-resolver';

export class EvaluationError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Evaluator — evaluates an ExprNode AST.
 */
export class Evaluator {
  /**
   * Evaluate an AST node against the given context.
   * @param node - AST node to evaluate
   * @param ctx - evaluation context (cell, table, stores, etc.)
   * @returns the evaluated result
   */
  public static evaluate(node: ExprNode, ctx: EvalContext): any {
    if (!node) throw new EvaluationError('Node is null or undefined');

    switch (node.type) {
      case 'Literal':
        return node.value;

      case 'Var':
        return this.evaluateVar(node.path, ctx);

      case 'BinaryOp':
        return this.evaluateBinaryOp(node, ctx);

      case 'UnaryOp':
        return this.evaluateUnaryOp(node, ctx);

      case 'FnCall':
        return this.evaluateFnCall(node, ctx);

      case 'RangeRef':
        return this.evaluateRangeRef(node, ctx);

      case 'ObjectLiteral':
        return this.evaluateObjectLiteral(node, ctx);

      case 'ArrayLiteral':
        return this.evaluateArrayLiteral(node, ctx);

      default:
        throw new EvaluationError(`Unknown node type: ${(node as any).type}`);
    }
  }

  private static evaluateVar(path: string, ctx: EvalContext): any {
    const value = resolveVar(path, ctx);
    if (value === null) {
      throw new EvaluationError(`Unknown variable: ${path}`);
    }
    return value;
  }

  private static evaluateBinaryOp(node: any, ctx: EvalContext): any {
    const left = this.evaluate(node.left, ctx);
    const right = this.evaluate(node.right, ctx);

    switch (node.op) {
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '==':
        return left == right; // intentional loose equality
      case '!=':
        return left != right;
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        if (right === 0) throw new EvaluationError('Division by zero');
        return left / right;
      case '%':
        if (right === 0) throw new EvaluationError('Modulo by zero');
        return left % right;
      case 'AND':
        return this.toBoolean(left) && this.toBoolean(right);
      case 'OR':
        return this.toBoolean(left) || this.toBoolean(right);
      default:
        throw new EvaluationError(`Unknown operator: ${node.op}`);
    }
  }

  private static evaluateUnaryOp(node: any, ctx: EvalContext): any {
    const operand = this.evaluate(node.operand, ctx);

    switch (node.op) {
      case 'NOT':
        return !this.toBoolean(operand);
      case '-':
        return -Number(operand);
      default:
        throw new EvaluationError(`Unknown unary operator: ${node.op}`);
    }
  }

  private static evaluateFnCall(node: any, ctx: EvalContext): any {
    const fnName = node.name;

    // Evaluate arguments first
    const args = node.args.map((arg: ExprNode) => this.evaluate(arg, ctx));

    // Dispatch to function registry
    try {
      return functionRegistry.call(fnName, args, ctx);
    } catch (err) {
      throw new EvaluationError(`Error calling ${fnName}: ${(err as Error).message}`);
    }
  }

  private static evaluateRangeRef(node: any, ctx: EvalContext): any {
    // Resolve range notation to ICell[]
    try {
      return resolveRangeRef(node.notation, ctx);
    } catch (err) {
      throw new EvaluationError(`Error resolving range ${node.notation}: ${(err as Error).message}`);
    }
  }

  private static evaluateObjectLiteral(node: any, ctx: EvalContext): any {
    const obj: Record<string, any> = {};
    for (const [key, valueNode] of node.properties) {
      obj[key] = this.evaluate(valueNode, ctx);
    }
    return obj;
  }

  private static evaluateArrayLiteral(node: any, ctx: EvalContext): any {
    return node.elements.map((elem: ExprNode) => this.evaluate(elem, ctx));
  }

  /** Convert value to boolean (for AND, OR, NOT) */
  private static toBoolean(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value !== '';
    return true;
  }
}
