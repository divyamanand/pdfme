/**
 * Conditional formatting system for all plugins.
 *
 * For tables/nestedTables: per-cell conditional rules that replace entire cell values.
 * For other plugins: a single rule that replaces the entire schema value.
 * Stores rules separately from content, enabling visual rule editor + code editor modes.
 */

export type ConditionOperator =
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | 'contains' | 'startsWith' | 'endsWith'
  | 'isEmpty' | 'isNotEmpty';

/** Value type for CF branch inputs */
export type CFValueType = 'variable' | 'text' | 'number' | 'dateTime' | 'field';

/** Infer CFValueType from legacy isVariable flag + value content */
export function resolveValueType(value: string, isVariable?: boolean, explicitType?: CFValueType): CFValueType {
  if (explicitType) return explicitType;
  if (isVariable) return 'variable';
  const num = Number(value);
  if (value !== '' && !isNaN(num) && isFinite(num)) return 'number';
  return 'text';
}

/** Emit a value as JS source based on its type */
export function emitValue(value: string, type: CFValueType): string {
  switch (type) {
    case 'variable': return value;
    case 'field':    return value;
    case 'number':   return value || '0';
    case 'text':     return JSON.stringify(value);
    case 'dateTime': return `Date.parse(${JSON.stringify(value)})`;
    default:         return JSON.stringify(value);
  }
}

// ============================================================================
// STYLE OVERRIDES FOR CONDITIONAL FORMATTING
// ============================================================================

/**
 * Style overrides applicable per CF branch. All optional — unset = use normal style.
 * Common subset usable by both table cells and text schemas.
 */
export interface CFStyleOverrides {
  fontName?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment?: 'top' | 'middle' | 'bottom';
  fontSize?: number;
  lineHeight?: number;
  characterSpacing?: number;
  fontColor?: string;
  backgroundColor?: string;
  borderColor?: string;        // tables only
  strikethrough?: boolean;     // text only
  underline?: boolean;         // text only
}

/** Result of evaluating a single CF rule (non-table). */
export interface CFEvaluationResult {
  value: string;
  styles?: CFStyleOverrides;
}

/** Result of evaluating table CF. cellStyles keys are "row:col". */
export interface TableCFEvaluationResult {
  value: string;
  cellStyles?: Record<string, CFStyleOverrides>;
}

/**
 * A single condition clause within a branch (field op value).
 * Multiple clauses can be joined with AND (&&) or OR (||) per-clause.
 */
export interface ConditionClause {
  field: string;
  operator: ConditionOperator;
  /** Right-hand operand (unused for isEmpty/isNotEmpty) */
  value: string;
  /** If true, value is a variable reference (emitted unquoted) */
  valueIsVariable?: boolean;
  /** Explicit value type (overrides valueIsVariable heuristic) */
  valueType?: CFValueType;
  /**
   * Logical operator connecting THIS clause to the PREVIOUS clause.
   * Undefined (or absent) for the first clause. 'AND' = &&, 'OR' = ||.
   * Falls back to branch.conditionLogic for backward compat.
   */
  logic?: 'AND' | 'OR';
}

/**
 * One IF branch: one or more conditions → result.
 * Evaluated left-to-right; first match wins.
 */
export interface VisualConditionBranch {
  /**
   * Multiple conditions for this branch (AND/OR combined).
   * When present and non-empty, supersedes the legacy single-condition fields below.
   */
  conditions?: ConditionClause[];
  /** How to combine multiple conditions: 'AND' (default) or 'OR' */
  conditionLogic?: 'AND' | 'OR';

  // Legacy single-condition fields — kept for backward compatibility.
  // When `conditions` is absent, these define the single condition.
  /** @deprecated Use conditions array instead */
  field?: string;
  /** @deprecated Use conditions array instead */
  operator?: ConditionOperator;
  /** @deprecated Use conditions array instead */
  value?: string;
  /** @deprecated Use conditions array instead */
  valueIsVariable?: boolean;
  /** @deprecated Use conditions array instead */
  valueType?: CFValueType;

  /** String value to emit when this branch condition is true */
  result: string;
  /** If true, result is a variable reference (emitted unquoted) */
  resultIsVariable?: boolean;
  /** Optional style overrides when this branch matches */
  styles?: CFStyleOverrides;
  /** Text to prepend before the result value */
  prefix?: string;
  /** Text to append after the result value */
  suffix?: string;
  /** Type of the result value */
  resultType?: CFValueType;
}

/**
 * A complete visual rule: ordered branches + default ELSE result
 */
export interface VisualRule {
  branches: VisualConditionBranch[];
  defaultResult: string;
  /** If true, defaultResult is a variable reference (emitted unquoted) */
  defaultResultIsVariable?: boolean;
  /** Style overrides for the default (ELSE) branch */
  defaultStyles?: CFStyleOverrides;
  /** Prefix for the default result */
  defaultPrefix?: string;
  /** Suffix for the default result */
  defaultSuffix?: string;
  /** Type of the default result */
  defaultResultType?: CFValueType;
}

/**
 * A single conditional rule for a cell or schema.
 * When present, replaces the entire value (no per-token logic).
 * Stores both visual rule (for UI authoring) and compiled expression (for runtime evaluation).
 */
export interface ConditionalRule {
  /** Which editor mode the rule was created in */
  mode: 'visual' | 'code';
  /** Source of truth when mode='visual'; undefined when mode='code' */
  visualRule?: VisualRule;
  /** The JS expression evaluated at runtime. The result IS the entire value. */
  compiledExpression: string;
  /** For wildcard rules: the row the rule was authored on (used to shift cell refs at eval time) */
  sourceRow?: number;
  /** For wildcard rules: the col the rule was authored on (used to shift cell refs at eval time) */
  sourceCol?: number;
  /** Style overrides for code mode (applied when expression evaluates to non-null) */
  codeStyles?: CFStyleOverrides;
}

/** @deprecated Use ConditionalRule instead */
export type CellTokenRule = ConditionalRule;

/**
 * Storage key format:
 * - "rowIndex:colIndex" — cell-specific rule (both 0-based body indices)
 * - "*:colIndex" — column-wide rule (applies to ALL rows in that column, including future dynamic rows)
 * - "rowIndex:*" — row-wide rule (applies to ALL columns in that row)
 *
 * Cell-specific keys take precedence over wildcards at evaluation time.
 */
export type CellKey = string;

/**
 * All conditional formatting rules for a table/nestedTable.
 * Maps cell address (or wildcard pattern) to a single rule per cell.
 * Sparse: only cells/columns/rows with rules have entries.
 */
export type TableConditionalFormatting = Record<CellKey, ConditionalRule>;

// ============================================================================
// COLUMN ADDRESS UTILITIES
// ============================================================================

/**
 * Convert 0-based column index to Excel-style letter(s).
 * 0 → 'A', 25 → 'Z', 26 → 'AA', 27 → 'AB', 51 → 'AZ', 52 → 'BA'
 */
export function colIndexToLetter(index: number): string {
  if (index < 0) return '';
  let result = '';
  let idx = index;
  while (idx >= 0) {
    result = String.fromCharCode(65 + (idx % 26)) + result;
    idx = Math.floor(idx / 26) - 1;
  }
  return result;
}

/**
 * Inverse of colIndexToLetter. Convert 'A', 'Z', 'AA', etc. to 0-based index.
 */
export function colLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    const code = letter.charCodeAt(i);
    if (code < 65 || code > 90) return -1; // Invalid
    result = result * 26 + (code - 65 + 1);
  }
  return result - 1;
}

/**
 * Parse a cell reference like "B3", "AA1", etc.
 * Returns { colIndex, rowIndex } or null if invalid.
 * Rows are 1-based in the reference, converted to 0-based in result.
 */
export function parseCellRef(ref: string): { colIndex: number; rowIndex: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const colIndex = colLetterToIndex(match[1]);
  const rowIndex = parseInt(match[2], 10) - 1;

  if (colIndex < 0 || rowIndex < 0) return null;
  return { colIndex, rowIndex };
}

// ============================================================================
// TOKEN PARSING & REPLACEMENT
// ============================================================================

/**
 * Extract all {{...}} token inner expressions from a cell text string.
 * Returns them in left-to-right parse order.
 *
 * Example: "Invoice {{amount}} due on {{dueDate}}"
 * → ["amount", "dueDate"]
 *
 * Handles nested braces by tracking depth.
 */
export function parseTokens(cellText: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < cellText.length) {
    if (i < cellText.length - 1 && cellText[i] === '{' && cellText[i + 1] === '{') {
      // Found opening {{
      i += 2;
      let depth = 1;
      let start = i;
      while (i < cellText.length) {
        if (i < cellText.length - 1 && cellText[i] === '{' && cellText[i + 1] === '{') {
          depth++;
          i += 2;
        } else if (i < cellText.length - 1 && cellText[i] === '}' && cellText[i + 1] === '}') {
          depth--;
          if (depth === 0) {
            tokens.push(cellText.substring(start, i).trim());
            i += 2;
            break;
          }
          i += 2;
        } else {
          i++;
        }
      }
    } else {
      i++;
    }
  }
  return tokens;
}

/**
 * Replace the {{...}} token at tokenIndex with a plain value string.
 * Used when applying conditional formatting at render time.
 *
 * Example: replaceTokenAtIndex("Amount: {{amount}}", 0, "500")
 * → "Amount: 500"
 */
export function replaceTokenAtIndex(
  cellText: string,
  tokenIndex: number,
  replacement: string
): string {
  const tokens = parseTokens(cellText);
  if (tokenIndex >= tokens.length || tokenIndex < 0) return cellText;

  // Find and replace the token at this index
  let matchCount = 0;
  let i = 0;
  while (i < cellText.length) {
    if (i < cellText.length - 1 && cellText[i] === '{' && cellText[i + 1] === '{') {
      if (matchCount === tokenIndex) {
        // Found it; find the closing }}
        i += 2;
        let depth = 1;
        let tokenStart = i;
        while (i < cellText.length) {
          if (i < cellText.length - 1 && cellText[i] === '{' && cellText[i + 1] === '{') {
            depth++;
            i += 2;
          } else if (i < cellText.length - 1 && cellText[i] === '}' && cellText[i + 1] === '}') {
            depth--;
            if (depth === 0) {
              // Replace from {{ to }}
              const before = cellText.substring(0, tokenStart - 2);
              const after = cellText.substring(i + 2);
              return before + replacement + after;
            }
            i += 2;
          } else {
            i++;
          }
        }
        return cellText; // Malformed, return unchanged
      }
      matchCount++;
      // Skip to end of this token
      i += 2;
      let depth = 1;
      while (i < cellText.length && depth > 0) {
        if (i < cellText.length - 1 && cellText[i] === '{' && cellText[i + 1] === '{') {
          depth++;
          i += 2;
        } else if (i < cellText.length - 1 && cellText[i] === '}' && cellText[i + 1] === '}') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
    } else {
      i++;
    }
  }

  return cellText;
}

// ============================================================================
// VISUAL RULE COMPILATION
// ============================================================================

/**
 * Compile a VisualRule into a JavaScript ternary expression string.
 *
 * Single branch: "amount > 1000 ? 'High' : 'Low'"
 * Multi-branch: "amount > 1000 ? 'High' : (amount > 500 ? 'Medium' : 'Low')"
 */
export function compileVisualRulesToExpression(rule: VisualRule): string {
  if (rule.branches.length === 0) {
    return JSON.stringify(rule.defaultResult);
  }

  // Build nested ternary chain from last branch inward:
  // cond1 ? val1 : (cond2 ? val2 : (… : defaultVal))
  const defaultType = resolveValueType(rule.defaultResult, rule.defaultResultIsVariable, rule.defaultResultType);
  let result = emitValue(rule.defaultResult, defaultType);

  for (let i = rule.branches.length - 1; i >= 0; i--) {
    const branch = rule.branches[i];
    const condition = compileCondition(branch);
    const resultType = resolveValueType(branch.result, branch.resultIsVariable, branch.resultType);
    const consequent = emitValue(branch.result, resultType);
    // Wrap the alternate in parens if it contains a ternary (i.e. not the innermost level)
    const needsParens = i < rule.branches.length - 1;
    if (needsParens) {
      result = `${condition} ? ${consequent} : (${result})`;
    } else {
      result = `${condition} ? ${consequent} : ${result}`;
    }
  }

  return result;
}

/**
 * Normalise a VisualConditionBranch into a ConditionClause array.
 * Supports both the new `conditions` array format and the legacy single-condition fields.
 */
export function getBranchClauses(branch: VisualConditionBranch): ConditionClause[] {
  if (branch.conditions && branch.conditions.length > 0) return branch.conditions;
  // Legacy fallback
  return [{
    field: branch.field ?? '',
    operator: branch.operator ?? '==',
    value: branch.value ?? '',
    valueIsVariable: branch.valueIsVariable,
    valueType: branch.valueType,
  }];
}

/**
 * Compile a single ConditionClause to a JS boolean expression string.
 */
export function compileClause(clause: ConditionClause): string {
  const { field, operator, value, valueIsVariable, valueType } = clause;
  const vType = resolveValueType(value, valueIsVariable, valueType);
  const ev = (val: string) => emitValue(val, vType);
  const fieldExpr = vType === 'dateTime' ? `Date.parse(${field})` : field;
  const stringMethodValue = (val: string) =>
    (vType === 'variable' || vType === 'field') ? val : JSON.stringify(val);

  switch (operator) {
    case '==':        return `${fieldExpr} == ${ev(value)}`;
    case '!=':        return `${fieldExpr} != ${ev(value)}`;
    case '<':         return `${fieldExpr} < ${ev(value)}`;
    case '<=':        return `${fieldExpr} <= ${ev(value)}`;
    case '>':         return `${fieldExpr} > ${ev(value)}`;
    case '>=':        return `${fieldExpr} >= ${ev(value)}`;
    case 'contains':  return `String(${field}).includes(${stringMethodValue(value)})`;
    case 'startsWith':return `String(${field}).startsWith(${stringMethodValue(value)})`;
    case 'endsWith':  return `String(${field}).endsWith(${stringMethodValue(value)})`;
    case 'isEmpty':   return `!${field}`;
    case 'isNotEmpty':return `!!${field}`;
    default:          return '';
  }
}

/**
 * Compile all conditions of a branch into a single JS boolean expression.
 * Each clause (from index 1 onward) carries its own `logic` connector ('AND'/'OR').
 * Falls back to branch.conditionLogic for backward compat with clauses that have no `logic`.
 */
export function compileCondition(branch: VisualConditionBranch): string {
  const clauses = getBranchClauses(branch);
  const compiled = clauses.map(compileClause);
  const parts = compiled.filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  // Build expression respecting per-clause logic operators
  let result = compiled[0];
  for (let i = 1; i < clauses.length; i++) {
    const clausePart = compiled[i];
    if (!clausePart) continue;
    const op = clauses[i].logic ?? branch.conditionLogic ?? 'AND';
    result += op === 'OR' ? ' || ' : ' && ';
    result += clausePart;
  }
  return `(${result})`;
}

// ============================================================================
// EXPRESSION PARSING (TERNARY DETECTION)
// ============================================================================

/**
 * Attempt to parse a simple ternary expression back into a VisualRule.
 * Returns null if the expression is too complex or doesn't match the pattern.
 *
 * Handles only: expr ? "val1" : "val2" (single-level ternary with string literals)
 * Does NOT handle nested ternaries or complex left-hand conditions.
 *
 * This is best-effort; for complex expressions, the user edits in Code mode.
 */
export function tryParseExpressionToVisualRule(expression: string): VisualRule | null {
  try {
    // Minimal parsing: look for pattern "X ? "Y" : "Z"
    // This is a best-effort regex-based check, not a full AST parse.
    // For a production system, you'd use acorn. For now, we use a heuristic.

    expression = expression.trim();

    // Check for nested ternary (double `?`) — too complex
    if ((expression.match(/\?/g) || []).length > 1) {
      return null;
    }

    // Try to find the ternary operator positions
    let questionIndex = -1;
    let colonIndex = -1;
    let depth = 0;

    for (let i = 0; i < expression.length; i++) {
      if (expression[i] === '(') depth++;
      if (expression[i] === ')') depth--;
      if (depth === 0) {
        if (expression[i] === '?' && questionIndex === -1) {
          questionIndex = i;
        } else if (expression[i] === ':' && questionIndex !== -1 && colonIndex === -1) {
          colonIndex = i;
        }
      }
    }

    if (questionIndex === -1 || colonIndex === -1 || colonIndex <= questionIndex) {
      return null;
    }

    const testStr = expression.substring(0, questionIndex).trim();
    const consequentStr = expression.substring(questionIndex + 1, colonIndex).trim();
    const alternateStr = expression.substring(colonIndex + 1).trim();

    // Check if consequent and alternate are string literals or bare identifiers
    const consequentIsLiteral = isStringLiteral(consequentStr);
    const alternateIsLiteral = isStringLiteral(alternateStr);
    const consequentIsIdent = !consequentIsLiteral && isIdentifier(consequentStr);
    const alternateIsIdent = !alternateIsLiteral && isIdentifier(alternateStr);

    if (!consequentIsLiteral && !consequentIsIdent) return null;
    if (!alternateIsLiteral && !alternateIsIdent) return null;

    // Strip outer parens from the test expression (multi-clause conditions are wrapped)
    let condStr = testStr;
    if (condStr.startsWith('(') && condStr.endsWith(')')) {
      condStr = condStr.slice(1, -1).trim();
    }

    // Try to split on && or || for multi-clause conditions (supports mixed AND/OR)
    const split = splitOnMixedLogicOps(condStr);
    let branch: VisualConditionBranch | null;

    if (split && split.parts.length > 1) {
      const clauses: ConditionClause[] = [];
      for (let i = 0; i < split.parts.length; i++) {
        const clause = parseConditionClause(split.parts[i]);
        if (!clause) return null;
        // Attach the connector logic to each clause (first clause has no connector)
        if (i > 0) clause.logic = split.logics[i - 1];
        clauses.push(clause);
      }
      branch = {
        conditions: clauses,
        result: '',
      };
    } else {
      branch = parseSimpleCondition(condStr);
      if (!branch) return null;
    }

    // Set the result from the consequent
    branch.result = consequentIsLiteral ? parseStringLiteral(consequentStr) : consequentStr;
    branch.resultIsVariable = consequentIsIdent || undefined;

    return {
      branches: [branch],
      defaultResult: alternateIsLiteral ? parseStringLiteral(alternateStr) : alternateStr,
      defaultResultIsVariable: alternateIsIdent || undefined,
    };
  } catch {
    return null;
  }
}

/** Check if a string is a JSON string literal */
function isStringLiteral(str: string): boolean {
  return (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  );
}

/** Check if a string is a valid JS identifier or cell reference (bare variable) */
function isIdentifier(str: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(str);
}

/** Parse a JSON string literal and return the string value */
function parseStringLiteral(str: string): string {
  try {
    if (str.startsWith('"') && str.endsWith('"')) {
      return JSON.parse(str);
    }
    if (str.startsWith("'") && str.endsWith("'")) {
      return str.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    return str;
  } catch {
    return str;
  }
}

/** Parse a single condition string (e.g. "amount > 1000") into a ConditionClause */
function parseConditionClause(testStr: string): ConditionClause | null {
  testStr = testStr.trim();

  const patterns: { op: ConditionOperator; regex: RegExp }[] = [
    { op: '==', regex: /^(.+?)\s*==\s*(.+)$/ },
    { op: '!=', regex: /^(.+?)\s*!=\s*(.+)$/ },
    { op: '>=', regex: /^(.+?)\s*>=\s*(.+)$/ },
    { op: '<=', regex: /^(.+?)\s*<=\s*(.+)$/ },
    { op: '>', regex: /^(.+?)\s*>\s*(.+)$/ },
    { op: '<', regex: /^(.+?)\s*<\s*(.+)$/ },
  ];

  for (const { op, regex } of patterns) {
    const match = testStr.match(regex);
    if (match) {
      const field = match[1].trim();
      let value = match[2].trim();
      let valueIsVariable: boolean | undefined;
      if (isStringLiteral(value)) {
        value = parseStringLiteral(value);
      } else if (isIdentifier(value)) {
        valueIsVariable = true;
      }
      return { field, operator: op, value, valueIsVariable };
    }
  }

  if (testStr.match(/^!![A-Za-z0-9_$\.]+$/)) {
    return { field: testStr.substring(2).trim(), operator: 'isNotEmpty', value: '' };
  }
  if (testStr.match(/^![A-Za-z0-9_$\.]+$/)) {
    return { field: testStr.substring(1).trim(), operator: 'isEmpty', value: '' };
  }

  return null;
}

/**
 * Split an expression on top-level `&&` or `||` tokens.
 * Returns the parts and per-connector logic operators (length = parts.length - 1).
 * Supports mixed AND/OR (e.g. "A && B || C && D").
 * Returns null if no logic operators were found.
 */
function splitOnMixedLogicOps(expr: string): { parts: string[]; logics: ('AND' | 'OR')[] } | null {
  const parts: string[] = [];
  const logics: ('AND' | 'OR')[] = [];
  let depth = 0;
  let start = 0;
  let foundAny = false;

  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') { depth++; continue; }
    if (expr[i] === ')') { depth--; continue; }
    if (depth !== 0) continue;
    if (expr[i] === '&' && expr[i + 1] === '&') {
      foundAny = true;
      parts.push(expr.slice(start, i).trim());
      logics.push('AND');
      i++; start = i + 1;
    } else if (expr[i] === '|' && expr[i + 1] === '|') {
      foundAny = true;
      parts.push(expr.slice(start, i).trim());
      logics.push('OR');
      i++; start = i + 1;
    }
  }

  if (!foundAny) return null;
  parts.push(expr.slice(start).trim());
  return { parts, logics };
}

/** Parse a simple condition like "amount > 1000" into a VisualConditionBranch */
function parseSimpleCondition(testStr: string): VisualConditionBranch | null {
  const clause = parseConditionClause(testStr);
  if (!clause) return null;
  return {
    conditions: [clause],
    result: '',
  };
}

// ============================================================================
// CELL REFERENCE SHIFTING (for wildcard rules & copy operations)
// ============================================================================

/**
 * Clone a ConditionalRule and shift all cell references in compiledExpression + visual branches.
 * Used when copying a rule to a different row/column, or when applying wildcard rules.
 *
 * Example: shiftRule(rule, 2, 0) → new rule with all cell refs shifted down 2 rows
 */
export function shiftRule(
  rule: ConditionalRule,
  rowDelta: number,
  colDelta: number,
): ConditionalRule {
  const shifted: ConditionalRule = {
    ...rule,
    compiledExpression: shiftCellRefsInExpression(rule.compiledExpression, rowDelta, colDelta),
  };
  if (rule.visualRule) {
    shifted.visualRule = {
      branches: rule.visualRule.branches.map((b) => ({
        ...b,
        // Shift new-format conditions array
        conditions: getBranchClauses(b).map((c) => ({
          ...c,
          field: shiftCellRefsInExpression(c.field, rowDelta, colDelta),
          value: (c.valueIsVariable || c.valueType === 'variable' || c.valueType === 'field')
            ? shiftCellRefsInExpression(c.value, rowDelta, colDelta)
            : c.value,
        })),
      })),
      defaultResult: rule.visualRule.defaultResult,
      defaultResultIsVariable: rule.visualRule.defaultResultIsVariable,
    };
  }
  return shifted;
}

/**
 * Shift Excel-style cell references (A1, B2, AA3, etc.) in an expression string.
 * Used when applying a wildcard column/row rule to a specific cell, or when copying rules.
 *
 * Example: shiftCellRefsInExpression("B1 > A1", 2, 0) → "B3 > A3"
 */
export function shiftCellRefsInExpression(
  expr: string,
  rowDelta: number,
  colDelta: number,
): string {
  return expr.replace(
    /\b([A-Z]+)(\d+)\b/g,
    (_match: string, colLetters: string, rowStr: string) => {
      const newRow = parseInt(rowStr, 10) + rowDelta;
      const colIdx = colLetterToIndex(colLetters);
      const newCol = colIdx + colDelta;
      if (newRow < 1 || newCol < 0) return _match;
      return `${colIndexToLetter(newCol)}${newRow}`;
    },
  );
}

/**
 * Resolve the conditional rule for a specific cell.
 * Checks cell-specific, column-wildcard, and row-wildcard keys (in priority order).
 * Wildcard rules have their cell refs shifted based on sourceRow/sourceCol.
 * Returns undefined if no rule applies.
 */
export function resolveRulesForCell(
  cf: TableConditionalFormatting,
  rowIndex: number,
  colIndex: number,
): ConditionalRule | undefined {
  // 1. Cell-specific rule (highest priority)
  const cellKey = `${rowIndex}:${colIndex}`;
  const cellRule = cf[cellKey];
  if (cellRule) {
    return cellRule;
  }

  // 2. Column-wide wildcard
  const colWildcard = `*:${colIndex}`;
  const colRule = cf[colWildcard];
  if (colRule) {
    const rowDelta = rowIndex - (colRule.sourceRow ?? 0);
    if (rowDelta === 0) return colRule;
    return shiftRule(colRule, rowDelta, 0);
  }

  // 3. Row-wide wildcard
  const rowWildcard = `${rowIndex}:*`;
  const rowRule = cf[rowWildcard];
  if (rowRule) {
    const colDelta = colIndex - (rowRule.sourceCol ?? 0);
    if (colDelta === 0) return rowRule;
    return shiftRule(rowRule, 0, colDelta);
  }

  return undefined;
}

// ============================================================================
// CELL ADDRESS MAP (for cross-cell references in expressions)
// ============================================================================

/**
 * Build a map of cell addresses to raw (pre-evaluation) cell values.
 * Used to enable expressions like {{A1 > B2 ? "yes" : "no"}}
 *
 * Cell addresses are: "A1", "B1", "A2", etc. (1-based rows, Excel style)
 * Values are the raw cell strings before any expression evaluation.
 */
export function buildCellAddressMap(rows: string[][]): Record<string, string> {
  const map: Record<string, string> = {};

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const colLetter = colIndexToLetter(colIndex);
      const rowLabel = rowIndex + 1; // 1-based
      const cellKey = `${colLetter}${rowLabel}`;
      map[cellKey] = cell;
    });
  });

  return map;
}

// ============================================================================
// ROW/COLUMN SHIFT UTILITIES (when rows/cols are added/removed)
// ============================================================================

/**
 * Renumber conditional formatting keys when rows are added or removed.
 *
 * @param cf - existing conditional formatting map
 * @param afterRow - shift rows at index >= afterRow
 * @param delta - +1 for row insertion, -1 for row deletion
 */
export function shiftCFRows(
  cf: TableConditionalFormatting,
  afterRow: number,
  delta: 1 | -1
): TableConditionalFormatting {
  const updated: TableConditionalFormatting = {};

  for (const [key, rules] of Object.entries(cf)) {
    const [rowStr, colStr] = key.split(':');

    // Wildcard keys: *:col is unaffected by row shifts, row:* needs shifting
    if (rowStr === '*') {
      updated[key] = rules; // column-wide wildcard, row-independent
      continue;
    }

    const rowIndex = parseInt(rowStr, 10);

    if (colStr === '*') {
      // Row-wide wildcard — shift the row part
      if (delta === -1 && rowIndex === afterRow) continue;
      if (delta === -1 && rowIndex > afterRow) {
        updated[`${rowIndex - 1}:*`] = rules;
      } else if (delta === 1 && rowIndex >= afterRow) {
        updated[`${rowIndex + 1}:*`] = rules;
      } else {
        updated[key] = rules;
      }
      continue;
    }

    const colIndex = parseInt(colStr, 10);

    if (delta === -1 && rowIndex === afterRow) {
      continue; // Row is being deleted
    }

    if (delta === -1 && rowIndex > afterRow) {
      updated[`${rowIndex - 1}:${colIndex}`] = rules;
    } else if (delta === 1 && rowIndex >= afterRow) {
      updated[`${rowIndex + 1}:${colIndex}`] = rules;
    } else {
      updated[key] = rules;
    }
  }

  return updated;
}

/**
 * Renumber conditional formatting keys when columns are added or removed.
 *
 * @param cf - existing conditional formatting map
 * @param afterCol - shift columns at index >= afterCol
 * @param delta - +1 for column insertion, -1 for column deletion
 */
export function shiftCFCols(
  cf: TableConditionalFormatting,
  afterCol: number,
  delta: 1 | -1
): TableConditionalFormatting {
  const updated: TableConditionalFormatting = {};

  for (const [key, rules] of Object.entries(cf)) {
    const [rowStr, colStr] = key.split(':');

    // Wildcard keys: row:* is unaffected by col shifts, *:col needs shifting
    if (colStr === '*') {
      updated[key] = rules; // row-wide wildcard, col-independent
      continue;
    }

    const colIndex = parseInt(colStr, 10);

    if (rowStr === '*') {
      // Column-wide wildcard — shift the col part
      if (delta === -1 && colIndex === afterCol) continue;
      if (delta === -1 && colIndex > afterCol) {
        updated[`*:${colIndex - 1}`] = rules;
      } else if (delta === 1 && colIndex >= afterCol) {
        updated[`*:${colIndex + 1}`] = rules;
      } else {
        updated[key] = rules;
      }
      continue;
    }

    const rowIndex = parseInt(rowStr, 10);

    if (delta === -1 && colIndex === afterCol) {
      continue; // Column is being deleted
    }

    if (delta === -1 && colIndex > afterCol) {
      updated[`${rowIndex}:${colIndex - 1}`] = rules;
    } else if (delta === 1 && colIndex >= afterCol) {
      updated[`${rowIndex}:${colIndex + 1}`] = rules;
    } else {
      updated[key] = rules;
    }
  }

  return updated;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migrate legacy token-based CF format (CellTokenRule[]) to new single-rule format (ConditionalRule).
 * For cells with multiple token rules, takes the first rule (tokenIndex 0) as the cell rule.
 * Safe to call on already-migrated data (passes through unchanged).
 */
export function migrateLegacyCF(
  legacy: Record<string, any>
): TableConditionalFormatting {
  const result: TableConditionalFormatting = {};
  for (const [key, val] of Object.entries(legacy)) {
    if (Array.isArray(val) && val.length > 0) {
      // Old format: CellTokenRule[] → pick the primary rule and strip tokenIndex
      const primary = val.find((r: any) => r.tokenIndex === 0) || val[0];
      const { tokenIndex: _, ...rule } = primary;
      result[key] = rule as ConditionalRule;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      // Already new format
      result[key] = val as ConditionalRule;
    }
  }
  return result;
}
