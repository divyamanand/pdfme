/**
 * Parser — converts tokens into an AST (Abstract Syntax Tree).
 * Uses recursive descent parsing with operator precedence.
 *
 * Input: Token[] from Lexer
 * Output: ExprNode AST
 */

import type { Token, TokenType } from './lexer';
import type {
  ExprNode,
  ObjectLiteralNode,
} from './ast.types';

export class ParseError extends Error {
  constructor(public message: string, public position: number) {
    super(`${message} at position ${position}`);
    this.name = 'ParseError';
  }
}

/**
 * Parser — builds AST from token stream.
 */
export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse tokens into an ExprNode AST.
   */
  public parse(): ExprNode {
    const expr = this.parseExpression();
    if (!this.isAtEnd()) {
      throw new ParseError('Unexpected tokens after expression', this.current().position);
    }
    return expr;
  }

  // ============ Precedence Levels (lowest to highest) ============

  /** Lowest precedence: OR */
  private parseExpression(): ExprNode {
    return this.parseOr();
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd();

    while (this.match('Keyword', 'OR') || this.match('Operator', '||')) {
      const right = this.parseAnd();
      left = { type: 'BinaryOp', op: 'OR', left, right };
    }

    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseEquality();

    while (this.match('Keyword', 'AND') || this.match('Operator', '&&')) {
      const right = this.parseEquality();
      left = { type: 'BinaryOp', op: 'AND', left, right };
    }

    return left;
  }

  private parseEquality(): ExprNode {
    let left = this.parseComparison();

    while (true) {
      if (this.match('Operator', '==') || this.match('Operator', '===')) {
        const right = this.parseComparison();
        left = { type: 'BinaryOp', op: '==', left, right };
      } else if (this.match('Operator', '!=') || this.match('Operator', '!==')) {
        const right = this.parseComparison();
        left = { type: 'BinaryOp', op: '!=', left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private parseComparison(): ExprNode {
    let left = this.parseAdditive();

    while (true) {
      if (this.match('Operator', '>')) {
        left = { type: 'BinaryOp', op: '>', left, right: this.parseAdditive() };
      } else if (this.match('Operator', '<')) {
        left = { type: 'BinaryOp', op: '<', left, right: this.parseAdditive() };
      } else if (this.match('Operator', '>=')) {
        left = { type: 'BinaryOp', op: '>=', left, right: this.parseAdditive() };
      } else if (this.match('Operator', '<=')) {
        left = { type: 'BinaryOp', op: '<=', left, right: this.parseAdditive() };
      } else {
        break;
      }
    }

    return left;
  }

  private parseAdditive(): ExprNode {
    let left = this.parseMultiplicative();

    while (true) {
      if (this.match('Operator', '+')) {
        left = { type: 'BinaryOp', op: '+', left, right: this.parseMultiplicative() };
      } else if (this.match('Operator', '-')) {
        left = { type: 'BinaryOp', op: '-', left, right: this.parseMultiplicative() };
      } else {
        break;
      }
    }

    return left;
  }

  private parseMultiplicative(): ExprNode {
    let left = this.parseUnary();

    while (true) {
      if (this.match('Operator', '*')) {
        left = { type: 'BinaryOp', op: '*', left, right: this.parseUnary() };
      } else if (this.match('Operator', '/')) {
        left = { type: 'BinaryOp', op: '/', left, right: this.parseUnary() };
      } else if (this.match('Operator', '%')) {
        left = { type: 'BinaryOp', op: '%', left, right: this.parseUnary() };
      } else {
        break;
      }
    }

    return left;
  }

  private parseUnary(): ExprNode {
    // NOT keyword
    if (this.match('Keyword', 'NOT')) {
      return { type: 'UnaryOp', op: 'NOT', operand: this.parseUnary() };
    }

    // Unary minus
    if (this.match('Operator', '-')) {
      return { type: 'UnaryOp', op: '-', operand: this.parseUnary() };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ExprNode {
    let expr = this.parsePrimary();

    // Handle dot notation (e.g., cell.value, table.rowCount)
    while (this.match('Dot')) {
      if (!this.check('Identifier')) {
        throw new ParseError('Expected identifier after dot', this.current().position);
      }
      const field = this.advance().value as string;
      if (expr.type === 'Var') {
        expr = { type: 'Var', path: `${expr.path}.${field}` };
      } else {
        throw new ParseError('Dot notation only supported on variables', this.current().position);
      }
    }

    return expr;
  }

  private parsePrimary(): ExprNode {
    // Number literal
    if (this.check('Number')) {
      return { type: 'Literal', value: this.advance().value as number };
    }

    // String literal
    if (this.check('String')) {
      return { type: 'Literal', value: this.advance().value as string };
    }

    // Keywords: true, false, null, always
    if (this.check('Keyword')) {
      const kw = this.current().value as string;
      // Only consume keywords that are literal values (not AND/OR/NOT which are operators)
      if (kw === 'true' || kw === 'false' || kw === 'null' || kw === 'always') {
        this.advance();
        if (kw === 'true' || kw === 'always') return { type: 'Literal', value: true };
        if (kw === 'false') return { type: 'Literal', value: false };
        if (kw === 'null') return { type: 'Literal', value: null };
      }
    }

    // Identifiers: variables, function calls, or range refs
    if (this.check('Identifier')) {
      const ident = this.advance().value as string;

      // Function call: ident(args)
      if (this.match('LParen')) {
        const args = this.parseArguments();
        if (!this.match('RParen')) {
          throw new ParseError('Expected ) after function arguments', this.current().position);
        }
        return { type: 'FnCall', name: ident, args };
      }

      // Range ref with colon: col:0, col:self, row:3, r0c0:r2c3
      if (this.check('Colon')) {
        this.advance(); // consume ':'
        let suffix = '';
        if (this.check('Number')) {
          suffix = String(this.advance().value);
        } else if (this.check('Identifier')) {
          suffix = this.advance().value as string;
        }
        return { type: 'RangeRef', notation: `${ident}:${suffix}` };
      }

      // Special range ref identifiers (no colon needed)
      if (ident === 'body' || ident === 'self') {
        return { type: 'RangeRef', notation: ident };
      }

      // Plain variable reference
      return { type: 'Var', path: ident };
    }

    // Parenthesized expression
    if (this.match('LParen')) {
      const expr = this.parseExpression();
      if (!this.match('RParen')) {
        throw new ParseError('Expected ) after expression', this.current().position);
      }
      return expr;
    }

    // Object literal: { key: value, ... }
    if (this.match('LBrace')) {
      return this.parseObjectLiteral();
    }

    throw new ParseError('Unexpected token', this.current().position);
  }

  private parseArguments(): ExprNode[] {
    const args: ExprNode[] = [];

    if (!this.check('RParen')) {
      args.push(this.parseExpression());
      while (this.match('Comma')) {
        args.push(this.parseExpression());
      }
    }

    return args;
  }

  private parseObjectLiteral(): ObjectLiteralNode {
    const properties = new Map<string, ExprNode>();

    if (!this.check('RBrace')) {
      // Parse first key-value pair
      if (!this.check('Identifier') && !this.check('String')) {
        throw new ParseError('Expected property name in object literal', this.current().position);
      }
      const key = this.advance().value as string;

      if (!this.match('Colon')) {
        throw new ParseError('Expected : in object literal', this.current().position);
      }

      properties.set(key, this.parseExpression());

      // Parse remaining key-value pairs
      while (this.match('Comma')) {
        if (this.check('RBrace')) break; // Trailing comma
        if (!this.check('Identifier') && !this.check('String')) {
          throw new ParseError('Expected property name in object literal', this.current().position);
        }
        const k = this.advance().value as string;

        if (!this.match('Colon')) {
          throw new ParseError('Expected : in object literal', this.current().position);
        }

        properties.set(k, this.parseExpression());
      }
    }

    if (!this.match('RBrace')) {
      throw new ParseError('Expected } in object literal', this.current().position);
    }

    return { type: 'ObjectLiteral', properties };
  }

  // ============ Helper Methods ============

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.current().type === type;
  }

  private match(type: TokenType, value?: string | number): boolean {
    if (!this.check(type)) return false;
    if (value !== undefined && this.current().value !== value) return false;
    this.advance();
    return true;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }
}
