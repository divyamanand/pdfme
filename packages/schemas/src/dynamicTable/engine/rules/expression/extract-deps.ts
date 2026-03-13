/**
 * extractVarPaths — walks an AST and collects all variable dependency keys.
 *
 * Used by RuleRegistry to auto-populate Rule.valueDeps on addRule/updateRule.
 * Collects Var node paths (e.g. "cell.value") and RangeRef notations (e.g. "col:0").
 */

import type { ExprNode } from './ast.types';

export function extractVarPaths(ast: ExprNode): string[] {
  const collector: string[] = [];
  walk(ast, collector);
  return [...new Set(collector)];
}

function walk(node: ExprNode, collector: string[]): void {
  switch (node.type) {
    case 'Literal':
      break;
    case 'Var':
      collector.push(node.path);
      break;
    case 'RangeRef':
      collector.push(node.notation);
      break;
    case 'BinaryOp':
      walk(node.left, collector);
      walk(node.right, collector);
      break;
    case 'UnaryOp':
      walk(node.operand, collector);
      break;
    case 'FnCall':
      for (const arg of node.args) walk(arg, collector);
      break;
    case 'ObjectLiteral':
      for (const value of node.properties.values()) walk(value, collector);
      break;
    case 'ArrayLiteral':
      for (const el of node.elements) walk(el, collector);
      break;
  }
}
