/**
 * Conditional formatting system for table/nestedTable plugins.
 *
 * Allows per-cell, per-token conditional rules that evaluate to values.
 * Stores rules separately from cell content, enabling visual rule editor + code editor modes.
 */

export type ConditionOperator =
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | 'contains' | 'startsWith' | 'endsWith'
  | 'isEmpty' | 'isNotEmpty';

/**
 * One IF branch: field operator value → result
 * Evaluated left-to-right; first match wins.
 */
export interface VisualConditionBranch {
  /** Left-hand operand: field name, cell ref (A1), or special (currentDate, currentPage, etc.) */
  field: string;
  operator: ConditionOperator;
  /** Right-hand literal (unused for isEmpty/isNotEmpty) */
  value: string;
  /** String value to emit when this branch condition is true */
  result: string;
}

/**
 * A complete visual rule: ordered branches + default ELSE result
 */
export interface VisualRule {
  branches: VisualConditionBranch[];
  defaultResult: string;
}

/**
 * Rule for one {{...}} token in one cell.
 * Stores both visual rule (for UI authoring) and compiled expression (for runtime evaluation).
 */
export interface CellTokenRule {
  /** 0-based index of the {{...}} token in the cell text, left-to-right order */
  tokenIndex: number;
  /** Which editor mode the rule was created in */
  mode: 'visual' | 'code';
  /** Source of truth when mode='visual'; undefined when mode='code' */
  visualRule?: VisualRule;
  /** The JS expression evaluated at runtime. Derived from visualRule (if visual) or typed directly (if code). */
  compiledExpression: string;
}

/**
 * Storage key format: "rowIndex:colIndex" (both 0-based body indices).
 * Example: "2:3" means row index 2, column index 3.
 */
export type CellKey = `${number}:${number}`;

/**
 * All conditional formatting rules for a table/nestedTable.
 * Maps cell address to array of token rules.
 * Sparse: only cells with rules have entries.
 */
export type TableConditionalFormatting = Record<CellKey, CellTokenRule[]>;

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
  let result = JSON.stringify(rule.defaultResult);

  for (let i = rule.branches.length - 1; i >= 0; i--) {
    const branch = rule.branches[i];
    const condition = compileCondition(branch);
    const consequent = JSON.stringify(branch.result);
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
 * Helper: compile a single VisualConditionBranch's condition to JS.
 */
function compileCondition(branch: VisualConditionBranch): string {
  const field = branch.field;

  // For comparison operators, emit raw value if numeric, quoted otherwise
  const compileValue = (val: string): string => {
    const num = Number(val);
    if (val !== '' && !isNaN(num) && isFinite(num)) {
      return val; // emit raw number
    }
    return JSON.stringify(val); // emit quoted string
  };

  switch (branch.operator) {
    case '==':
      return `${field} == ${compileValue(branch.value)}`;
    case '!=':
      return `${field} != ${compileValue(branch.value)}`;
    case '<':
      return `${field} < ${compileValue(branch.value)}`;
    case '<=':
      return `${field} <= ${compileValue(branch.value)}`;
    case '>':
      return `${field} > ${compileValue(branch.value)}`;
    case '>=':
      return `${field} >= ${compileValue(branch.value)}`;
    case 'contains':
      return `String(${field}).includes(${JSON.stringify(branch.value)})`;
    case 'startsWith':
      return `String(${field}).startsWith(${JSON.stringify(branch.value)})`;
    case 'endsWith':
      return `String(${field}).endsWith(${JSON.stringify(branch.value)})`;
    case 'isEmpty':
      return `!${field}`;
    case 'isNotEmpty':
      return `!!${field}`;
    default:
      return ''; // Should never happen
  }
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

    // Check if consequent and alternate are string literals
    if (
      !isStringLiteral(consequentStr) ||
      !isStringLiteral(alternateStr)
    ) {
      return null;
    }

    // Try to parse the test condition into a simple comparison
    const branch = parseSimpleCondition(testStr);
    if (!branch) {
      return null;
    }

    // Set the result from the consequent string
    branch.result = parseStringLiteral(consequentStr);

    return {
      branches: [branch],
      defaultResult: parseStringLiteral(alternateStr),
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

/** Parse a simple condition like "amount > 1000" into a VisualConditionBranch */
function parseSimpleCondition(testStr: string): VisualConditionBranch | null {
  // Handle simple operators: ==, !=, >=, <=, >, <
  const patterns = [
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

      // Parse the value if it's a string literal
      if (isStringLiteral(value)) {
        value = parseStringLiteral(value);
      }

      return {
        field,
        operator: op as ConditionOperator,
        value,
        result: '', // Placeholder, will be set by caller
      };
    }
  }

  // Handle isEmpty / isNotEmpty
  if (testStr === `!${testStr.substring(1)}` || testStr.match(/^![A-Za-z0-9_$\.]+$/)) {
    const field = testStr.substring(1).trim();
    return {
      field,
      operator: 'isEmpty',
      value: '',
      result: '',
    };
  }

  if (testStr.match(/^!![A-Za-z0-9_$\.]+$/)) {
    const field = testStr.substring(2).trim();
    return {
      field,
      operator: 'isNotEmpty',
      value: '',
      result: '',
    };
  }

  return null;
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
    const rowIndex = parseInt(rowStr, 10);
    const colIndex = parseInt(colStr, 10);

    if (delta === -1 && rowIndex === afterRow) {
      // Row is being deleted — discard its rules
      continue;
    }

    if (delta === -1 && rowIndex > afterRow) {
      // Shift rows after the deleted row down by 1
      const newKey = `${rowIndex - 1}:${colIndex}` as CellKey;
      updated[newKey as any] = rules;
    } else if (delta === 1 && rowIndex >= afterRow) {
      // Shift rows at/after the insertion point up by 1
      const newKey = `${rowIndex + 1}:${colIndex}` as CellKey;
      updated[newKey as any] = rules;
    } else {
      // Row index is before the shift point, keep as-is
      updated[key as any] = rules;
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
    const rowIndex = parseInt(rowStr, 10);
    const colIndex = parseInt(colStr, 10);

    if (delta === -1 && colIndex === afterCol) {
      // Column is being deleted — discard its rules
      continue;
    }

    if (delta === -1 && colIndex > afterCol) {
      // Shift columns after the deleted column left by 1
      const newKey = `${rowIndex}:${colIndex - 1}` as CellKey;
      updated[newKey as any] = rules;
    } else if (delta === 1 && colIndex >= afterCol) {
      // Shift columns at/after the insertion point right by 1
      const newKey = `${rowIndex}:${colIndex + 1}` as CellKey;
      updated[newKey as any] = rules;
    } else {
      // Column index is before the shift point, keep as-is
      updated[key as any] = rules;
    }
  }

  return updated;
}
