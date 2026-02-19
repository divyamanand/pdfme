import {
  colIndexToLetter,
  colLetterToIndex,
  parseCellRef,
  parseTokens,
  replaceTokenAtIndex,
  buildCellAddressMap,
  compileVisualRulesToExpression,
  tryParseExpressionToVisualRule,
  shiftCFRows,
  shiftCFCols,
} from '../src/conditionalFormatting.js';
import type {
  VisualRule,
  TableConditionalFormatting,
  CellKey,
} from '../src/conditionalFormatting.js';

// ─── colIndexToLetter ──────────────────────────────────────────────

describe('colIndexToLetter', () => {
  it('should convert single-letter columns', () => {
    expect(colIndexToLetter(0)).toBe('A');
    expect(colIndexToLetter(1)).toBe('B');
    expect(colIndexToLetter(25)).toBe('Z');
  });

  it('should convert multi-letter columns', () => {
    expect(colIndexToLetter(26)).toBe('AA');
    expect(colIndexToLetter(27)).toBe('AB');
    expect(colIndexToLetter(51)).toBe('AZ');
    expect(colIndexToLetter(52)).toBe('BA');
  });
});

// ─── colLetterToIndex ──────────────────────────────────────────────

describe('colLetterToIndex', () => {
  it('should convert single letters', () => {
    expect(colLetterToIndex('A')).toBe(0);
    expect(colLetterToIndex('B')).toBe(1);
    expect(colLetterToIndex('Z')).toBe(25);
  });

  it('should convert multi-letter columns', () => {
    expect(colLetterToIndex('AA')).toBe(26);
    expect(colLetterToIndex('AB')).toBe(27);
    expect(colLetterToIndex('AZ')).toBe(51);
    expect(colLetterToIndex('BA')).toBe(52);
  });

  it('should round-trip with colIndexToLetter', () => {
    for (let i = 0; i < 100; i++) {
      expect(colLetterToIndex(colIndexToLetter(i))).toBe(i);
    }
  });
});

// ─── parseCellRef ──────────────────────────────────────────────────

describe('parseCellRef', () => {
  it('should parse simple cell references', () => {
    expect(parseCellRef('A1')).toEqual({ colIndex: 0, rowIndex: 0 });
    expect(parseCellRef('B3')).toEqual({ colIndex: 1, rowIndex: 2 });
    expect(parseCellRef('Z10')).toEqual({ colIndex: 25, rowIndex: 9 });
  });

  it('should parse multi-letter column refs', () => {
    expect(parseCellRef('AA1')).toEqual({ colIndex: 26, rowIndex: 0 });
    expect(parseCellRef('AB5')).toEqual({ colIndex: 27, rowIndex: 4 });
  });

  it('should return null for invalid refs', () => {
    expect(parseCellRef('')).toBeNull();
    expect(parseCellRef('123')).toBeNull();
    expect(parseCellRef('A')).toBeNull();
    expect(parseCellRef('hello')).toBeNull();
  });
});

// ─── parseTokens ───────────────────────────────────────────────────

describe('parseTokens', () => {
  it('should return empty array for no tokens', () => {
    expect(parseTokens('Hello world')).toEqual([]);
  });

  it('should parse single token', () => {
    expect(parseTokens('Price is {{amount}}')).toEqual(['amount']);
  });

  it('should parse multiple tokens', () => {
    expect(parseTokens('{{name}} owes {{amount}}')).toEqual(['name', 'amount']);
  });

  it('should handle tokens with expressions', () => {
    expect(parseTokens('Total: {{price * qty}}')).toEqual(['price * qty']);
  });

  it('should handle tokens with nested braces in expressions', () => {
    expect(parseTokens('{{a > b ? "yes" : "no"}}')).toEqual(['a > b ? "yes" : "no"']);
  });
});

// ─── replaceTokenAtIndex ───────────────────────────────────────────

describe('replaceTokenAtIndex', () => {
  it('should replace the correct token by index', () => {
    const text = '{{name}} owes {{amount}}';
    expect(replaceTokenAtIndex(text, 0, 'Alice')).toBe('Alice owes {{amount}}');
    expect(replaceTokenAtIndex(text, 1, '$100')).toBe('{{name}} owes $100');
  });

  it('should return original text for out-of-range index', () => {
    expect(replaceTokenAtIndex('{{a}}', 5, 'x')).toBe('{{a}}');
  });

  it('should handle replacement in text with no other tokens', () => {
    expect(replaceTokenAtIndex('Value: {{x}}', 0, '42')).toBe('Value: 42');
  });
});

// ─── buildCellAddressMap ───────────────────────────────────────────

describe('buildCellAddressMap', () => {
  it('should build address map from rows (1-based row addresses)', () => {
    const rows = [
      ['Alice', 'NYC'],
      ['Bob', 'Paris'],
    ];
    const map = buildCellAddressMap(rows);
    expect(map['A1']).toBe('Alice');
    expect(map['B1']).toBe('NYC');
    expect(map['A2']).toBe('Bob');
    expect(map['B2']).toBe('Paris');
  });

  it('should handle single cell', () => {
    const map = buildCellAddressMap([['only']]);
    expect(map['A1']).toBe('only');
    expect(Object.keys(map)).toHaveLength(1);
  });

  it('should handle many columns (AA, AB...)', () => {
    const row = Array.from({ length: 28 }, (_, i) => `val${i}`);
    const map = buildCellAddressMap([row]);
    expect(map['A1']).toBe('val0');
    expect(map['Z1']).toBe('val25');
    expect(map['AA1']).toBe('val26');
    expect(map['AB1']).toBe('val27');
  });
});

// ─── compileVisualRulesToExpression ────────────────────────────────

describe('compileVisualRulesToExpression', () => {
  it('should compile single branch', () => {
    const rule: VisualRule = {
      branches: [{ field: 'amount', operator: '>', value: '1000', result: 'High' }],
      defaultResult: 'Low',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('amount > 1000 ? "High" : "Low"');
  });

  it('should compile multi-branch (nested ternary)', () => {
    const rule: VisualRule = {
      branches: [
        { field: 'amount', operator: '>', value: '1000', result: 'High' },
        { field: 'amount', operator: '>', value: '500', result: 'Medium' },
      ],
      defaultResult: 'Low',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('amount > 1000 ? "High" : (amount > 500 ? "Medium" : "Low")');
  });

  it('should handle contains operator', () => {
    const rule: VisualRule = {
      branches: [{ field: 'name', operator: 'contains', value: 'test', result: 'Yes' }],
      defaultResult: 'No',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('String(name).includes("test") ? "Yes" : "No"');
  });

  it('should handle isEmpty operator', () => {
    const rule: VisualRule = {
      branches: [{ field: 'notes', operator: 'isEmpty', value: '', result: 'N/A' }],
      defaultResult: 'Has notes',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('!notes ? "N/A" : "Has notes"');
  });

  it('should handle isNotEmpty operator', () => {
    const rule: VisualRule = {
      branches: [{ field: 'notes', operator: 'isNotEmpty', value: '', result: 'Has notes' }],
      defaultResult: 'Empty',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('!!notes ? "Has notes" : "Empty"');
  });

  it('should handle startsWith operator', () => {
    const rule: VisualRule = {
      branches: [{ field: 'code', operator: 'startsWith', value: 'PRE', result: 'Prefixed' }],
      defaultResult: 'Normal',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('String(code).startsWith("PRE") ? "Prefixed" : "Normal"');
  });

  it('should handle endsWith operator', () => {
    const rule: VisualRule = {
      branches: [{ field: 'file', operator: 'endsWith', value: '.pdf', result: 'PDF' }],
      defaultResult: 'Other',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('String(file).endsWith(".pdf") ? "PDF" : "Other"');
  });

  it('should handle == and != operators', () => {
    const rule: VisualRule = {
      branches: [{ field: 'status', operator: '==', value: 'active', result: 'Active' }],
      defaultResult: 'Inactive',
    };
    const expr = compileVisualRulesToExpression(rule);
    expect(expr).toBe('status == "active" ? "Active" : "Inactive"');
  });
});

// ─── tryParseExpressionToVisualRule ────────────────────────────────

describe('tryParseExpressionToVisualRule', () => {
  it('should parse simple ternary with > operator', () => {
    const rule = tryParseExpressionToVisualRule('amount > 1000 ? "High" : "Low"');
    expect(rule).not.toBeNull();
    expect(rule!.branches).toHaveLength(1);
    expect(rule!.branches[0].field).toBe('amount');
    expect(rule!.branches[0].operator).toBe('>');
    expect(rule!.branches[0].value).toBe('1000');
    expect(rule!.branches[0].result).toBe('High');
    expect(rule!.defaultResult).toBe('Low');
  });

  it('should parse ternary with == operator (string comparison)', () => {
    const rule = tryParseExpressionToVisualRule('status == "active" ? "Yes" : "No"');
    expect(rule).not.toBeNull();
    expect(rule!.branches[0].operator).toBe('==');
    expect(rule!.branches[0].value).toBe('active');
  });

  it('should return null for non-ternary expressions', () => {
    expect(tryParseExpressionToVisualRule('amount + 100')).toBeNull();
  });

  it('should return null for complex nested ternaries', () => {
    // Nested ternary in the alternate → too complex for visual mode
    expect(
      tryParseExpressionToVisualRule('a > 1 ? "x" : (b > 2 ? "y" : "z")')
    ).toBeNull();
  });

  it('should return null for expressions with function calls in test', () => {
    expect(tryParseExpressionToVisualRule('foo() ? "a" : "b"')).toBeNull();
  });
});

// ─── shiftCFRows ───────────────────────────────────────────────────

describe('shiftCFRows', () => {
  const makeCF = (entries: Record<string, any>): TableConditionalFormatting =>
    entries as TableConditionalFormatting;

  it('should shift rows down when deleting (delta=-1)', () => {
    const cf = makeCF({
      '0:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'a' }],
      '1:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'b' }],
      '2:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'c' }],
    });
    const result = shiftCFRows(cf, 1, -1);
    // Row 0 unchanged, row 1 deleted, row 2 → row 1
    expect(result['0:0' as CellKey]).toBeDefined();
    expect(result['1:0' as CellKey]).toBeDefined();
    expect((result['1:0' as CellKey] as any)[0].compiledExpression).toBe('c');
    expect(result['2:0' as CellKey]).toBeUndefined();
  });

  it('should shift rows up when inserting (delta=1)', () => {
    const cf = makeCF({
      '0:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'a' }],
      '1:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'b' }],
    });
    const result = shiftCFRows(cf, 1, 1);
    // Row 0 unchanged, row 1 → row 2
    expect(result['0:0' as CellKey]).toBeDefined();
    expect(result['2:0' as CellKey]).toBeDefined();
    expect((result['2:0' as CellKey] as any)[0].compiledExpression).toBe('b');
    expect(result['1:0' as CellKey]).toBeUndefined();
  });

  it('should handle deleting first row', () => {
    const cf = makeCF({
      '0:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'a' }],
      '1:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'b' }],
    });
    const result = shiftCFRows(cf, 0, -1);
    // Row 0 deleted, row 1 → row 0
    expect(result['0:0' as CellKey]).toBeDefined();
    expect((result['0:0' as CellKey] as any)[0].compiledExpression).toBe('b');
    expect(result['1:0' as CellKey]).toBeUndefined();
  });

  it('should preserve column indices', () => {
    const cf = makeCF({
      '1:2': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'x' }],
      '2:3': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'y' }],
    });
    const result = shiftCFRows(cf, 1, -1);
    expect(result['1:3' as CellKey]).toBeDefined();
    expect((result['1:3' as CellKey] as any)[0].compiledExpression).toBe('y');
  });

  it('should return empty object for empty CF', () => {
    expect(shiftCFRows({} as TableConditionalFormatting, 0, -1)).toEqual({});
  });
});

// ─── shiftCFCols ───────────────────────────────────────────────────

describe('shiftCFCols', () => {
  const makeCF = (entries: Record<string, any>): TableConditionalFormatting =>
    entries as TableConditionalFormatting;

  it('should shift cols left when deleting (delta=-1)', () => {
    const cf = makeCF({
      '0:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'a' }],
      '0:1': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'b' }],
      '0:2': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'c' }],
    });
    const result = shiftCFCols(cf, 1, -1);
    // Col 0 unchanged, col 1 deleted, col 2 → col 1
    expect(result['0:0' as CellKey]).toBeDefined();
    expect(result['0:1' as CellKey]).toBeDefined();
    expect((result['0:1' as CellKey] as any)[0].compiledExpression).toBe('c');
    expect(result['0:2' as CellKey]).toBeUndefined();
  });

  it('should shift cols right when inserting (delta=1)', () => {
    const cf = makeCF({
      '0:0': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'a' }],
      '0:1': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'b' }],
    });
    const result = shiftCFCols(cf, 1, 1);
    expect(result['0:0' as CellKey]).toBeDefined();
    expect(result['0:2' as CellKey]).toBeDefined();
    expect((result['0:2' as CellKey] as any)[0].compiledExpression).toBe('b');
  });

  it('should preserve row indices', () => {
    const cf = makeCF({
      '2:1': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'x' }],
      '3:2': [{ tokenIndex: 0, mode: 'code', compiledExpression: 'y' }],
    });
    const result = shiftCFCols(cf, 1, -1);
    expect(result['2:0' as CellKey]).toBeUndefined(); // col 0 is before, not shifted
    expect(result['3:1' as CellKey]).toBeDefined();
    expect((result['3:1' as CellKey] as any)[0].compiledExpression).toBe('y');
  });
});
