/**
 * AST (Abstract Syntax Tree) node types for rule expressions.
 * Discriminated union of all expression node types.
 */

/**
 * Literal value — number, string, or boolean.
 * Evaluates to its value directly.
 */
export interface LiteralNode {
  type: 'Literal';
  value: string | number | boolean | null;
}

/**
 * Variable reference — dot-path like "cell.value", "table.rowCount".
 * Engine resolves path against EvalContext at evaluation time.
 *
 * Examples:
 *   - "cell.value"       → string display value
 *   - "cell.numericValue"→ numeric value
 *   - "cell.rowIndex"    → row index
 *   - "cell.overflows"   → boolean
 *   - "table.rowCount"   → total rows
 */
export interface VarNode {
  type: 'Var';
  path: string; // dot-separated path (e.g., "cell.value", "table.rowCount")
}

/**
 * Binary operation — left operator right.
 * Examples: >100, cell.value == "red", SUM(col:0) > AVG(col:1)
 *
 * Operators:
 *   - Comparison: >, <, >=, <=, ==, !=
 *   - Arithmetic: +, -, *, /, %
 *   - Logical: AND, OR
 */
export interface BinaryOpNode {
  type: 'BinaryOp';
  op: '>' | '<' | '>=' | '<=' | '==' | '!=' | '+' | '-' | '*' | '/' | '%' | 'AND' | 'OR';
  left: ExprNode;
  right: ExprNode;
}

/**
 * Unary operation — operator operand.
 * Examples: NOT true, -5
 *
 * Operators: NOT (logical negation), - (numeric negation)
 */
export interface UnaryOpNode {
  type: 'UnaryOp';
  op: 'NOT' | '-';
  operand: ExprNode;
}

/**
 * Function call — name with arguments.
 * Examples: SUM(col:0), TEXT_HEIGHT(cell.value, 12), CELL(0, 1)
 *
 * Arguments are evaluated recursively; functions receive resolved values.
 */
export interface FnCallNode {
  type: 'FnCall';
  name: string; // e.g., "SUM", "AVG", "COUNT", "MAX", "MIN", "TEXT_HEIGHT", "TEXT_WIDTH", "COLUMN", "CELL"
  args: ExprNode[]; // arguments (can be Literal, Var, RangeRef, FnCall, etc.)
}

/**
 * Range reference — notation like "col:0", "row:3", "col:self", "body", "self", etc.
 * Evaluates to ICell[] (array of cells matching the range).
 *
 * Notation examples:
 *   - "col:0"  → all cells in column 0
 *   - "col:self" → all cells in the rule's target column (resolved at eval time)
 *   - "row:3"  → all cells in row 3
 *   - "row:self" → all cells in the rule's target row (resolved at eval time)
 *   - "r0c0:r2c3" → rectangular selection (rows 0-2, cols 0-3)
 *   - "body"   → all body cells
 *   - "self"   → for selection-scoped rules, the selection rect
 */
export interface RangeRefNode {
  type: 'RangeRef';
  notation: string; // e.g., "col:0", "col:self", "row:3", "r0c0:r2c3", "body", "self"
}

/**
 * Object literal — key-value pairs.
 * Used in result expressions to build structured outputs.
 *
 * Examples:
 *   - { style: { backgroundColor: 'red' } }
 *   - { rowHeightMin: 50, colWidthMin: 100 }
 */
export interface ObjectLiteralNode {
  type: 'ObjectLiteral';
  properties: Map<string, ExprNode>; // key -> value expression
}

/**
 * Array literal — list of values.
 * Used in complex expressions (though less common in rule conditions).
 */
export interface ArrayLiteralNode {
  type: 'ArrayLiteral';
  elements: ExprNode[];
}

/**
 * ExprNode — discriminated union of all expression node types.
 * Represents the complete syntax tree of a rule expression.
 */
export type ExprNode =
  | LiteralNode
  | VarNode
  | BinaryOpNode
  | UnaryOpNode
  | FnCallNode
  | RangeRefNode
  | ObjectLiteralNode
  | ArrayLiteralNode;

/**
 * Helper type guard functions (optional, for convenience).
 */
export const isLiteral = (node: ExprNode): node is LiteralNode => node.type === 'Literal';
export const isVar = (node: ExprNode): node is VarNode => node.type === 'Var';
export const isBinaryOp = (node: ExprNode): node is BinaryOpNode => node.type === 'BinaryOp';
export const isUnaryOp = (node: ExprNode): node is UnaryOpNode => node.type === 'UnaryOp';
export const isFnCall = (node: ExprNode): node is FnCallNode => node.type === 'FnCall';
export const isRangeRef = (node: ExprNode): node is RangeRefNode => node.type === 'RangeRef';
export const isObjectLiteral = (node: ExprNode): node is ObjectLiteralNode => node.type === 'ObjectLiteral';
export const isArrayLiteral = (node: ExprNode): node is ArrayLiteralNode => node.type === 'ArrayLiteral';
