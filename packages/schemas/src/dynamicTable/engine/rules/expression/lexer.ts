/**
 * Lexer — tokenizes expression strings into a token stream.
 * Input: "cell.value > 100 AND SUM(col:0) == 0"
 * Output: Token[] with type, value, and position info
 */

export type TokenType =
  | 'Number'
  | 'String'
  | 'Identifier'
  | 'Keyword'
  | 'Dot'
  | 'LParen'
  | 'RParen'
  | 'LBrace'
  | 'RBrace'
  | 'LBracket'
  | 'RBracket'
  | 'Colon'
  | 'Comma'
  | 'Operator'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string | number | boolean;
  position: number; // character offset in input
}

/**
 * Lexer class — tokenizes expression strings.
 */
export class Lexer {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input.trim();
  }

  /**
   * Tokenize the input string into a Token array.
   * Throws ParseError if invalid token encountered.
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      // Skip whitespace
      if (this.isWhitespace(this.current())) {
        this.advance();
        continue;
      }

      const startPos = this.pos;

      // Numbers
      if (this.isDigit(this.current())) {
        tokens.push({
          type: 'Number',
          value: this.scanNumber(),
          position: startPos,
        });
        continue;
      }

      // Strings (single or double quoted)
      if (this.current() === '"' || this.current() === "'") {
        tokens.push({
          type: 'String',
          value: this.scanString(),
          position: startPos,
        });
        continue;
      }

      // Identifiers and keywords
      if (this.isIdentifierStart(this.current())) {
        const ident = this.scanIdentifier();
        tokens.push({
          type: this.isKeyword(ident) ? 'Keyword' : 'Identifier',
          value: ident,
          position: startPos,
        });
        continue;
      }

      // Operators and punctuation
      if (this.tryOperator(tokens, startPos)) {
        continue;
      }

      // Single-char punctuation
      const ch = this.current();
      if (ch === '.') {
        this.advance();
        tokens.push({ type: 'Dot', value: '.', position: startPos });
        continue;
      }
      if (ch === '(') {
        this.advance();
        tokens.push({ type: 'LParen', value: '(', position: startPos });
        continue;
      }
      if (ch === ')') {
        this.advance();
        tokens.push({ type: 'RParen', value: ')', position: startPos });
        continue;
      }
      if (ch === '{') {
        this.advance();
        tokens.push({ type: 'LBrace', value: '{', position: startPos });
        continue;
      }
      if (ch === '}') {
        this.advance();
        tokens.push({ type: 'RBrace', value: '}', position: startPos });
        continue;
      }
      if (ch === '[') {
        this.advance();
        tokens.push({ type: 'LBracket', value: '[', position: startPos });
        continue;
      }
      if (ch === ']') {
        this.advance();
        tokens.push({ type: 'RBracket', value: ']', position: startPos });
        continue;
      }
      if (ch === ':') {
        this.advance();
        tokens.push({ type: 'Colon', value: ':', position: startPos });
        continue;
      }
      if (ch === ',') {
        this.advance();
        tokens.push({ type: 'Comma', value: ',', position: startPos });
        continue;
      }

      // Unknown character
      throw new Error(`Unexpected character '${ch}' at position ${this.pos}`);
    }

    tokens.push({ type: 'EOF', value: '', position: this.pos });
    return tokens;
  }

  /** Try to scan a multi-character operator */
  private tryOperator(tokens: Token[], startPos: number): boolean {
    const twoChar = this.input.substring(this.pos, this.pos + 2);
    const threeChar = this.input.substring(this.pos, this.pos + 3);

    // Three-char operators: ===, !==, >=, <=
    if (threeChar === '===') {
      this.pos += 3;
      tokens.push({ type: 'Operator', value: '===', position: startPos });
      return true;
    }
    if (threeChar === '!==') {
      this.pos += 3;
      tokens.push({ type: 'Operator', value: '!==', position: startPos });
      return true;
    }

    // Two-char operators: ==, !=, >=, <=, **, &&, ||
    if (twoChar === '==' || twoChar === '!=' || twoChar === '>=' || twoChar === '<=') {
      this.pos += 2;
      tokens.push({ type: 'Operator', value: twoChar, position: startPos });
      return true;
    }
    if (twoChar === '**') {
      this.pos += 2;
      tokens.push({ type: 'Operator', value: '**', position: startPos });
      return true;
    }
    if (twoChar === '&&') {
      this.pos += 2;
      tokens.push({ type: 'Operator', value: '&&', position: startPos });
      return true;
    }
    if (twoChar === '||') {
      this.pos += 2;
      tokens.push({ type: 'Operator', value: '||', position: startPos });
      return true;
    }

    // Single-char operators: >, <, +, -, *, /, %, =
    const ch = this.current();
    if ('><+-*/%=!'.includes(ch)) {
      this.advance();
      tokens.push({ type: 'Operator', value: ch, position: startPos });
      return true;
    }

    return false;
  }

  private scanNumber(): number {
    let num = '';
    while (this.pos < this.input.length && (this.isDigit(this.current()) || this.current() === '.')) {
      num += this.current();
      this.advance();
    }
    const parsed = parseFloat(num);
    if (isNaN(parsed)) throw new Error(`Invalid number: ${num}`);
    return parsed;
  }

  private scanString(): string {
    const quote = this.current();
    this.advance(); // skip opening quote
    let str = '';
    while (this.pos < this.input.length && this.current() !== quote) {
      if (this.current() === '\\') {
        this.advance();
        // Handle escape sequences
        if (this.current() === 'n') str += '\n';
        else if (this.current() === 't') str += '\t';
        else if (this.current() === 'r') str += '\r';
        else if (this.current() === '\\') str += '\\';
        else if (this.current() === quote) str += quote;
        else str += this.current();
        this.advance();
      } else {
        str += this.current();
        this.advance();
      }
    }
    if (this.current() !== quote) throw new Error('Unterminated string');
    this.advance(); // skip closing quote
    return str;
  }

  private scanIdentifier(): string {
    let ident = '';
    while (this.pos < this.input.length && this.isIdentifierPart(this.current())) {
      ident += this.current();
      this.advance();
    }
    return ident;
  }

  private isKeyword(word: string): boolean {
    const keywords = ['true', 'false', 'null', 'AND', 'OR', 'NOT', 'always'];
    return keywords.includes(word);
  }

  private isWhitespace(ch: string): boolean {
    return /\s/.test(ch);
  }

  private isDigit(ch: string): boolean {
    return /\d/.test(ch);
  }

  private isIdentifierStart(ch: string): boolean {
    return /[a-zA-Z_$]/.test(ch);
  }

  private isIdentifierPart(ch: string): boolean {
    return /[a-zA-Z0-9_$]/.test(ch);
  }

  private current(): string {
    return this.pos < this.input.length ? this.input[this.pos] : '';
  }

  private advance(): void {
    this.pos++;
  }
}
