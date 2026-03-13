/**
 * Compiler — converts expression strings to AST and validates them.
 * Wraps lexer, parser, and validation logic.
 *
 * Pipeline: string → Lexer → tokens → Parser → AST → validator → (AST or error)
 */

import { Lexer, type Token } from './lexer';
import { Parser, ParseError } from './parser';
import type { ExprNode } from './ast.types';

export interface CompileError {
  message: string;
  position?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: CompileError[];
}

/**
 * Compiler — translates expression strings to AST.
 */
export class Compiler {
  /**
   * Compile an expression string to AST.
   * @param expr - expression string (e.g., "cell.value > 100")
   * @returns AST node
   * @throws CompileError if syntax is invalid
   */
  public static compile(expr: string): ExprNode {
    if (!expr || typeof expr !== 'string') {
      throw new Error('Expression must be a non-empty string');
    }

    try {
      // Tokenize
      const lexer = new Lexer(expr);
      const tokens = lexer.tokenize();

      // Parse
      const parser = new Parser(tokens);
      const ast = parser.parse();

      return ast;
    } catch (err) {
      if (err instanceof ParseError) {
        throw err;
      }
      throw new Error(`Compilation error: ${(err as Error).message}`);
    }
  }

  /**
   * Validate an expression string without evaluating it.
   * Checks syntax only; does not verify Var/FnCall names exist.
   *
   * @param expr - expression string
   * @returns validation result
   */
  public static validate(expr: string): ValidationResult {
    const errors: CompileError[] = [];

    try {
      this.compile(expr);
    } catch (err) {
      if (err instanceof ParseError) {
        errors.push({
          message: err.message,
          position: err.position,
        });
      } else {
        errors.push({
          message: (err as Error).message,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Quick syntax check without throwing.
   * @param expr - expression string
   * @returns true if syntax is valid
   */
  public static isSyntaxValid(expr: string): boolean {
    return this.validate(expr).valid;
  }

  /**
   * Parse multiple expressions at once (batch validation).
   * Useful for validating a whole rule set.
   */
  public static compileMultiple(expressions: string[]): { asts: ExprNode[]; errors: Record<number, CompileError[]> } {
    const asts: ExprNode[] = [];
    const errors: Record<number, CompileError[]> = {};

    for (let i = 0; i < expressions.length; i++) {
      try {
        asts.push(this.compile(expressions[i]));
      } catch (err) {
        if (err instanceof ParseError) {
          errors[i] = [{ message: err.message, position: err.position }];
        } else {
          errors[i] = [{ message: (err as Error).message }];
        }
      }
    }

    return { asts, errors };
  }
}

/**
 * Convenience function — compile and return AST, or null on error.
 * Useful for lenient parsing.
 */
export function tryCompile(expr: string): ExprNode | null {
  try {
    return Compiler.compile(expr);
  } catch {
    return null;
  }
}
