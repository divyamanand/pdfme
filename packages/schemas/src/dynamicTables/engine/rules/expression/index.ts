/**
 * Barrel export for the expression evaluator module.
 */

// AST Types
export type {
  ExprNode,
  LiteralNode,
  VarNode,
  BinaryOpNode,
  UnaryOpNode,
  FnCallNode,
  RangeRefNode,
  ObjectLiteralNode,
  ArrayLiteralNode,
} from './ast.types';

export {
  isLiteral,
  isVar,
  isBinaryOp,
  isUnaryOp,
  isFnCall,
  isRangeRef,
  isObjectLiteral,
  isArrayLiteral,
} from './ast.types';

// Lexer
export type { Token, TokenType } from './lexer';
export { Lexer } from './lexer';

// Parser
export { Parser, ParseError } from './parser';

// Evaluator
export { Evaluator, EvaluationError } from './evaluator';

// Compiler
export { Compiler, tryCompile } from './compiler';
export type { CompileError, ValidationResult } from './compiler';

// Variable Catalog
export { VAR_CATALOG, resolveVar, getAvailableVars } from './var-catalog';
export type { VarDef } from './var-catalog';

// Function Registry
export { functionRegistry, FunctionRegistry } from './functions/registry';
export type { FnDef } from './functions/registry';

// Text Measurer
export { TextMeasurer } from './text-measurer';

// Range Resolver
export { resolveRangeRef } from './range-resolver';

// Dependency Extraction
export { extractVarPaths } from './extract-deps';

// Scope Vocabulary (for canvas UI)
export { SCOPE_VOCABULARY } from './scope-vocabulary';
export type { PaletteItem, RuleScope } from './scope-vocabulary';
