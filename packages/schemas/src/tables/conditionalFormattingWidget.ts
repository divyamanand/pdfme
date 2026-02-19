/**
 * Conditional Formatting PropPanel widget for table / nestedTable plugins.
 *
 * Features:
 * - Auto-tracks selected cell from canvas clicks
 * - Cell grid selector (dropdown with A1, B2, etc.)
 * - Token tabs for each {{...}} in the cell (or virtual token for plain-text cells)
 * - Visual Rule Editor (IF/ELSE chain) or Code Editor toggle
 * - Variable reference toggles for value and result fields
 * - Autocomplete datalist for field, value, and result inputs
 * - Scope selector: apply to This Cell / Entire Column / Entire Row
 * - Copy to Row / Column with cell-reference shifting
 * - Auto-updates cell content with {{expression}} on save/copy
 */
import type { PropPanelWidgetProps, TableConditionalFormatting, CellTokenRule } from '@pdfme/common';
import {
  colIndexToLetter,
  colLetterToIndex,
  parseTokens,
  replaceTokenAtIndex,
  compileVisualRulesToExpression,
  tryParseExpressionToVisualRule,
  shiftCellRefsInExpression,
} from '@pdfme/common';
import type { VisualRule, ConditionOperator } from '@pdfme/common';

// ============================================================================
// STYLES
// ============================================================================

const STYLES = {
  container: 'display:flex;flex-direction:column;gap:8px;padding:4px 0;',
  label: 'font-size:11px;color:#666;font-weight:600;margin-bottom:2px;',
  select: 'width:100%;padding:4px 8px;border:1px solid #d9d9d9;border-radius:4px;font-size:12px;box-sizing:border-box;',
  tokenBar: 'display:flex;gap:4px;flex-wrap:wrap;',
  tokenTab: 'padding:3px 8px;font-size:11px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;background:#fff;font-family:monospace;',
  tokenTabActive: 'padding:3px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;cursor:pointer;background:#e6f7ff;font-family:monospace;color:#1890ff;',
  modeBar: 'display:flex;gap:4px;margin-bottom:4px;',
  modeBtn: 'flex:1;padding:4px 8px;font-size:11px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;background:#fff;text-align:center;',
  modeBtnActive: 'flex:1;padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;cursor:pointer;background:#1890ff;color:#fff;text-align:center;',
  branchRow: 'display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-wrap:wrap;',
  input: 'padding:3px 6px;border:1px solid #d9d9d9;border-radius:3px;font-size:11px;box-sizing:border-box;',
  smallBtn: 'padding:2px 6px;font-size:11px;border:1px solid #d9d9d9;border-radius:3px;cursor:pointer;background:#fff;',
  primaryBtn: 'padding:4px 10px;font-size:11px;border:1px solid #1890ff;border-radius:4px;cursor:pointer;background:#1890ff;color:#fff;',
  dangerBtn: 'padding:4px 10px;font-size:11px;border:1px solid #ff4d4f;border-radius:4px;cursor:pointer;background:#fff;color:#ff4d4f;',
  textarea: 'width:100%;padding:6px 8px;font-family:monospace;font-size:12px;border:1px solid #d9d9d9;border-radius:4px;min-height:48px;resize:vertical;box-sizing:border-box;',
  hint: 'font-size:10px;color:#999;line-height:1.3;',
  preview: 'font-size:10px;color:#666;font-family:monospace;background:#f5f5f5;padding:4px 6px;border-radius:3px;word-break:break-all;',
  copyBar: 'display:flex;gap:4px;margin-top:4px;',
  noTokens: 'font-size:11px;color:#999;font-style:italic;',
  scopeBar: 'display:flex;gap:4px;flex-wrap:wrap;',
  scopeBtn: 'padding:3px 8px;font-size:10px;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;background:#fff;',
  scopeBtnActive: 'padding:3px 8px;font-size:10px;border:1px solid #722ed1;border-radius:4px;cursor:pointer;background:#f9f0ff;color:#722ed1;',
  varToggle: 'font-size:9px;padding:1px 4px;border:1px solid #d9d9d9;border-radius:3px;cursor:pointer;background:#fff;color:#999;line-height:1;',
  varToggleActive: 'font-size:9px;padding:1px 4px;border:1px solid #722ed1;border-radius:3px;cursor:pointer;background:#f9f0ff;color:#722ed1;line-height:1;',
} as const;

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

const BUILTINS = ['currentDate', 'currentTime', 'currentPage', 'totalPages', 'date', 'dateTime'];

// ============================================================================
// HELPERS
// ============================================================================

/** Clone a CellTokenRule and shift cell references in expression + visual branches */
function shiftRule(
  rule: CellTokenRule,
  rowDelta: number,
  colDelta: number,
): CellTokenRule {
  const shifted: CellTokenRule = {
    ...rule,
    compiledExpression: shiftCellRefsInExpression(rule.compiledExpression, rowDelta, colDelta),
  };
  if (rule.visualRule) {
    shifted.visualRule = {
      branches: rule.visualRule.branches.map((b) => ({
        ...b,
        field: shiftCellRefsInExpression(b.field, rowDelta, colDelta),
        value: b.valueIsVariable
          ? shiftCellRefsInExpression(b.value, rowDelta, colDelta)
          : b.value,
      })),
      defaultResult: rule.visualRule.defaultResult,
      defaultResultIsVariable: rule.visualRule.defaultResultIsVariable,
    };
  }
  return shifted;
}

/** Build autocomplete options: field names from schemas, built-ins, cell refs */
function buildAutocompleteOptions(
  schemas: any[],
  numRows: number,
  numCols: number,
): string[] {
  const options: string[] = [];

  // Input field names from all schemas on the page
  for (const s of schemas) {
    if (s.name && !options.includes(s.name)) {
      options.push(s.name);
    }
  }

  // Built-in variables
  for (const b of BUILTINS) {
    if (!options.includes(b)) options.push(b);
  }

  // Cell references (A1, B1, ... up to table dimensions)
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const ref = colIndexToLetter(c) + (r + 1);
      if (!options.includes(ref)) options.push(ref);
    }
  }

  return options;
}

/** Create a <datalist> element with autocomplete options */
function createDatalist(id: string, options: string[]): HTMLDataListElement {
  const dl = document.createElement('datalist');
  dl.id = id;
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    dl.appendChild(o);
  }
  return dl;
}

// ============================================================================
// WIDGET FUNCTION
// ============================================================================

export function conditionalFormattingWidget(props: PropPanelWidgetProps): void {
  const { rootElement, changeSchemas, activeSchema, schemas } = props;

  const schema = activeSchema as any;
  const content: string[][] = (() => {
    try {
      return JSON.parse(schema.content || '[]');
    } catch {
      return [];
    }
  })();
  const numRows = content.length;
  const numCols = content[0]?.length ?? 0;

  const cf: TableConditionalFormatting = schema.conditionalFormatting || {};

  // Autocomplete options
  const acOptions = buildAutocompleteOptions(schemas || [], numRows, numCols);
  const datalistId = `cf-ac-${activeSchema.id}`;

  // Widget state (closure-scoped)
  let selectedRow = 0;
  let selectedCol = 0;
  let selectedTokenIndex = 0;
  let currentMode: 'visual' | 'code' = 'visual';
  let scope: 'cell' | 'column' | 'row' = 'cell';

  // ---- Listen for cell selection from canvas ----
  const onCellSelect = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.schemaId !== activeSchema.id) return;
    const r = detail.row as number;
    const c = detail.col as number;
    if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
      selectedRow = r;
      selectedCol = c;
      selectedTokenIndex = 0;
      render();
    }
  };
  document.addEventListener('pdfme-table-cell-select', onCellSelect);

  // ---- Core helpers ----

  function getCellRules(r: number = selectedRow, c: number = selectedCol): CellTokenRule[] {
    // Check cell-specific, then column-wildcard, then row-wildcard
    const cellRules = (cf as any)[`${r}:${c}`];
    if (Array.isArray(cellRules) && cellRules.length > 0) return cellRules;
    const colWildcard = (cf as any)[`*:${c}`];
    if (Array.isArray(colWildcard) && colWildcard.length > 0) return colWildcard;
    const rowWildcard = (cf as any)[`${r}:*`];
    if (Array.isArray(rowWildcard) && rowWildcard.length > 0) return rowWildcard;
    return [];
  }

  function getTokenRule(): CellTokenRule | undefined {
    return getCellRules().find((r: CellTokenRule) => r.tokenIndex === selectedTokenIndex);
  }

  function cellHasRules(row: number, col: number): boolean {
    return getCellRules(row, col).length > 0;
  }

  /** Get display tokens — shows virtual "[cell value]" if cell has no {{...}} */
  function getEffectiveTokens(): { tokens: string[]; isVirtual: boolean } {
    const cellContent = (content[selectedRow] && content[selectedRow][selectedCol]) || '';
    const tokens = parseTokens(cellContent);
    if (tokens.length === 0) {
      return { tokens: ['__cell_value__'], isVirtual: true };
    }
    return { tokens, isVirtual: false };
  }

  // ---- Save helpers ----

  /** Commit both content and CF changes to the schema */
  function commitChanges(updatedCF: TableConditionalFormatting, updatedContent: string[][]): void {
    changeSchemas([
      { key: 'content', value: JSON.stringify(updatedContent), schemaId: activeSchema.id },
      { key: 'conditionalFormatting', value: updatedCF, schemaId: activeSchema.id },
    ]);
  }

  /** Apply a rule to one cell: updates CF data AND cell content */
  function applySingleCell(
    updatedCF: any,
    updatedContent: string[][],
    row: number,
    col: number,
    rule: CellTokenRule,
  ): void {
    const key = `${row}:${col}`;

    // Upsert CF rule
    const existing: CellTokenRule[] = updatedCF[key] ? [...updatedCF[key]] : [];
    const idx = existing.findIndex((r: CellTokenRule) => r.tokenIndex === rule.tokenIndex);
    if (idx >= 0) existing[idx] = rule;
    else existing.push(rule);
    updatedCF[key] = existing;

    // Update cell content to include {{expression}}
    if (!updatedContent[row]) return;
    const cellText = updatedContent[row][col] ?? '';
    const tokens = parseTokens(cellText);

    if (tokens.length === 0) {
      // No tokens — wrap entire cell with {{expression}}
      updatedContent[row][col] = `{{${rule.compiledExpression}}}`;
    } else if (rule.tokenIndex < tokens.length) {
      // Replace specific token with {{newExpression}}
      updatedContent[row][col] = replaceTokenAtIndex(
        cellText,
        rule.tokenIndex,
        `{{${rule.compiledExpression}}}`,
      );
    }
  }

  /** Save rule according to current scope */
  function saveWithScope(newRule: CellTokenRule): void {
    const updatedCF = { ...cf } as any;
    const updatedContent = content.map((row) => [...row]);

    if (scope === 'cell') {
      applySingleCell(updatedCF, updatedContent, selectedRow, selectedCol, newRule);
    } else if (scope === 'column') {
      // Store wildcard rule for future/dynamic rows
      const wildcardRule: CellTokenRule = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
      const wcKey = `*:${selectedCol}`;
      updatedCF[wcKey] = [wildcardRule];
      // Also apply to all existing rows for immediate effect
      for (let r = 0; r < numRows; r++) {
        const rowDelta = r - selectedRow;
        const shifted = rowDelta === 0 ? newRule : shiftRule(newRule, rowDelta, 0);
        applySingleCell(updatedCF, updatedContent, r, selectedCol, shifted);
      }
    } else if (scope === 'row') {
      // Store wildcard rule for all columns
      const wildcardRule: CellTokenRule = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
      const wcKey = `${selectedRow}:*`;
      updatedCF[wcKey] = [wildcardRule];
      // Also apply to all existing columns for immediate effect
      for (let c = 0; c < numCols; c++) {
        const colDelta = c - selectedCol;
        const shifted = colDelta === 0 ? newRule : shiftRule(newRule, 0, colDelta);
        applySingleCell(updatedCF, updatedContent, selectedRow, c, shifted);
      }
    }

    commitChanges(updatedCF, updatedContent);
  }

  function clearRule(): void {
    const updated = { ...cf } as any;
    const key = `${selectedRow}:${selectedCol}`;
    const existing: CellTokenRule[] = updated[key] ? [...updated[key]] : [];
    const filtered = existing.filter((r: CellTokenRule) => r.tokenIndex !== selectedTokenIndex);
    if (filtered.length === 0) delete updated[key];
    else updated[key] = filtered;
    changeSchemas([{ key: 'conditionalFormatting', value: updated, schemaId: activeSchema.id }]);
  }

  // ---- RENDER ----
  function render(): void {
    rootElement.innerHTML = '';

    if (numRows === 0 || numCols === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = STYLES.noTokens;
      msg.textContent = 'Table has no body cells.';
      rootElement.appendChild(msg);
      return;
    }

    const container = document.createElement('div');
    container.style.cssText = STYLES.container;

    // Add datalist for autocomplete
    container.appendChild(createDatalist(datalistId, acOptions));

    // ---- Cell Selector (header shows current cell) ----
    const cellHeader = document.createElement('div');
    cellHeader.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const cellLabel = document.createElement('div');
    cellLabel.style.cssText = STYLES.label + 'margin-bottom:0;';
    cellLabel.textContent = 'Cell Conditions';
    cellHeader.appendChild(cellLabel);

    const cellAddr = document.createElement('span');
    cellAddr.style.cssText = 'font-size:12px;font-weight:700;color:#1890ff;';
    cellAddr.textContent = colIndexToLetter(selectedCol) + (selectedRow + 1);
    cellHeader.appendChild(cellAddr);

    if (cellHasRules(selectedRow, selectedCol)) {
      const dot = document.createElement('span');
      dot.style.cssText = 'font-size:10px;color:#1890ff;';
      dot.textContent = '\u25CF';
      cellHeader.appendChild(dot);
    }

    container.appendChild(cellHeader);

    // Cell selector dropdown (compact, secondary)
    const cellSelect = document.createElement('select');
    cellSelect.style.cssText = STYLES.select + 'margin-top:2px;';
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const opt = document.createElement('option');
        const addr = colIndexToLetter(c) + (r + 1);
        const hasRules = cellHasRules(r, c);
        opt.value = `${r}:${c}`;
        opt.textContent = addr + (hasRules ? ' \u25CF' : '');
        if (r === selectedRow && c === selectedCol) opt.selected = true;
        cellSelect.appendChild(opt);
      }
    }
    cellSelect.addEventListener('change', () => {
      const [r, c] = cellSelect.value.split(':').map(Number);
      selectedRow = r;
      selectedCol = c;
      selectedTokenIndex = 0;
      render();
    });
    container.appendChild(cellSelect);

    // ---- Token Tabs ----
    const { tokens: effectiveTokens, isVirtual } = getEffectiveTokens();

    const tokLabel = document.createElement('div');
    tokLabel.style.cssText = STYLES.label;
    tokLabel.textContent = 'Tokens';
    container.appendChild(tokLabel);

    const tokenBar = document.createElement('div');
    tokenBar.style.cssText = STYLES.tokenBar;
    effectiveTokens.forEach((tok, idx) => {
      const btn = document.createElement('button');
      btn.style.cssText = idx === selectedTokenIndex ? STYLES.tokenTabActive : STYLES.tokenTab;
      if (isVirtual) {
        btn.textContent = '[cell value]';
      } else {
        const display = tok.length > 18 ? tok.substring(0, 16) + '\u2026' : tok;
        btn.textContent = `{{${display}}}`;
      }
      btn.addEventListener('click', () => {
        selectedTokenIndex = idx;
        render();
      });
      tokenBar.appendChild(btn);
    });
    container.appendChild(tokenBar);

    // ---- Rule Editor ----
    const existingRule = getTokenRule();
    if (existingRule) {
      currentMode = existingRule.mode;
    }

    // Mode toggle
    const modeBar = document.createElement('div');
    modeBar.style.cssText = STYLES.modeBar;

    const visualBtn = document.createElement('button');
    visualBtn.style.cssText = currentMode === 'visual' ? STYLES.modeBtnActive : STYLES.modeBtn;
    visualBtn.textContent = 'Visual';
    visualBtn.addEventListener('click', () => {
      if (currentMode === 'code') {
        const codeArea = container.querySelector('.cf-code-area') as HTMLTextAreaElement | null;
        const code = codeArea?.value || existingRule?.compiledExpression || '';
        if (code.trim()) {
          const parsed = tryParseExpressionToVisualRule(code.trim());
          if (!parsed) {
            alert('Expression is too complex for Visual mode.');
            return;
          }
        }
      }
      currentMode = 'visual';
      render();
    });
    modeBar.appendChild(visualBtn);

    const codeBtn = document.createElement('button');
    codeBtn.style.cssText = currentMode === 'code' ? STYLES.modeBtnActive : STYLES.modeBtn;
    codeBtn.textContent = 'Code';
    codeBtn.addEventListener('click', () => {
      currentMode = 'code';
      render();
    });
    modeBar.appendChild(codeBtn);

    container.appendChild(modeBar);

    // Render editor
    const realTokens = isVirtual ? [] : effectiveTokens;
    if (currentMode === 'visual') {
      renderVisualEditor(container, existingRule, realTokens);
    } else {
      renderCodeEditor(container, existingRule, realTokens);
    }

    // ---- Scope Selector ----
    const scopeLabel = document.createElement('div');
    scopeLabel.style.cssText = STYLES.label + 'margin-top:6px;';
    scopeLabel.textContent = 'Apply to';
    container.appendChild(scopeLabel);

    const scopeBar = document.createElement('div');
    scopeBar.style.cssText = STYLES.scopeBar;
    const scopes: { value: typeof scope; label: string }[] = [
      { value: 'cell', label: `${colIndexToLetter(selectedCol)}${selectedRow + 1} only` },
      { value: 'column', label: `Col ${colIndexToLetter(selectedCol)} (all rows)` },
      { value: 'row', label: `Row ${selectedRow + 1} (all cols)` },
    ];
    scopes.forEach((s) => {
      const btn = document.createElement('button');
      btn.style.cssText = scope === s.value ? STYLES.scopeBtnActive : STYLES.scopeBtn;
      btn.textContent = s.label;
      btn.addEventListener('click', () => {
        scope = s.value;
        render();
      });
      scopeBar.appendChild(btn);
    });
    container.appendChild(scopeBar);

    // ---- Copy Actions ----
    const copyBar = document.createElement('div');
    copyBar.style.cssText = STYLES.copyBar;

    const copyRowBtn = document.createElement('button');
    copyRowBtn.style.cssText = STYLES.smallBtn;
    copyRowBtn.textContent = 'Copy to Row';
    copyRowBtn.addEventListener('click', () => {
      const rules = getCellRules();
      if (rules.length === 0) return;
      const updatedCF = { ...cf } as any;
      const updatedContent = content.map((row) => [...row]);
      // Store row-wide wildcard
      const wcKey = `${selectedRow}:*`;
      updatedCF[wcKey] = rules.map((r) => ({ ...r, sourceRow: selectedRow, sourceCol: selectedCol }));
      // Also apply to existing cols
      for (let c = 0; c < numCols; c++) {
        const colDelta = c - selectedCol;
        rules.forEach((rule) => {
          const shifted = colDelta === 0 ? { ...rule } : shiftRule(rule, 0, colDelta);
          applySingleCell(updatedCF, updatedContent, selectedRow, c, shifted);
        });
      }
      commitChanges(updatedCF, updatedContent);
    });
    copyBar.appendChild(copyRowBtn);

    const copyColBtn = document.createElement('button');
    copyColBtn.style.cssText = STYLES.smallBtn;
    copyColBtn.textContent = 'Copy to Column';
    copyColBtn.addEventListener('click', () => {
      const rules = getCellRules();
      if (rules.length === 0) return;
      const updatedCF = { ...cf } as any;
      const updatedContent = content.map((row) => [...row]);
      // Store column-wide wildcard (applies to future dynamic rows too)
      const wcKey = `*:${selectedCol}`;
      updatedCF[wcKey] = rules.map((r) => ({ ...r, sourceRow: selectedRow, sourceCol: selectedCol }));
      // Also apply to existing rows
      for (let r = 0; r < numRows; r++) {
        const rowDelta = r - selectedRow;
        rules.forEach((rule) => {
          const shifted = rowDelta === 0 ? { ...rule } : shiftRule(rule, rowDelta, 0);
          applySingleCell(updatedCF, updatedContent, r, selectedCol, shifted);
        });
      }
      commitChanges(updatedCF, updatedContent);
    });
    copyBar.appendChild(copyColBtn);

    container.appendChild(copyBar);

    rootElement.appendChild(container);
  }

  // ---- VISUAL EDITOR ----
  function renderVisualEditor(
    container: HTMLElement,
    existingRule: CellTokenRule | undefined,
    _tokens: string[],
  ): void {
    let vr: VisualRule = existingRule?.visualRule
      ? JSON.parse(JSON.stringify(existingRule.visualRule))
      : { branches: [], defaultResult: '' };

    // If existing rule is code mode, try to parse it into visual
    if (existingRule && existingRule.mode === 'code' && existingRule.compiledExpression) {
      const parsed = tryParseExpressionToVisualRule(existingRule.compiledExpression);
      if (parsed) {
        vr = parsed;
      }
    }

    // If no branches yet, try to pre-populate from inline ternary in the cell token
    if (vr.branches.length === 0 && !existingRule && _tokens.length > 0) {
      const tokenExpr = _tokens[selectedTokenIndex] || '';
      const parsed = tryParseExpressionToVisualRule(tokenExpr);
      if (parsed) {
        vr = parsed;
      }
    }

    const branchesDiv = document.createElement('div');

    function renderBranches(): void {
      branchesDiv.innerHTML = '';

      vr.branches.forEach((branch, idx) => {
        const row = document.createElement('div');
        row.style.cssText = STYLES.branchRow;

        const ifLabel = document.createElement('span');
        ifLabel.style.cssText = 'font-size:11px;font-weight:600;color:#666;min-width:20px;';
        ifLabel.textContent = idx === 0 ? 'IF' : 'ELSE IF';
        row.appendChild(ifLabel);

        // Field input (with autocomplete)
        const fieldInput = document.createElement('input');
        fieldInput.style.cssText = STYLES.input + 'width:70px;';
        fieldInput.placeholder = 'field';
        fieldInput.value = branch.field;
        fieldInput.setAttribute('list', datalistId);
        fieldInput.addEventListener('change', () => {
          branch.field = fieldInput.value;
          updatePreview();
        });
        row.appendChild(fieldInput);

        // Operator select
        const opSelect = document.createElement('select');
        opSelect.style.cssText = STYLES.input + 'width:75px;';
        OPERATORS.forEach((op) => {
          const opt = document.createElement('option');
          opt.value = op.value;
          opt.textContent = op.label;
          if (op.value === branch.operator) opt.selected = true;
          opSelect.appendChild(opt);
        });
        opSelect.addEventListener('change', () => {
          branch.operator = opSelect.value as ConditionOperator;
          updatePreview();
        });
        row.appendChild(opSelect);

        // Value input + var toggle (hidden for isEmpty/isNotEmpty)
        const valWrap = document.createElement('span');
        valWrap.style.cssText = 'display:inline-flex;align-items:center;gap:2px;';

        const valInput = document.createElement('input');
        valInput.style.cssText = STYLES.input + 'width:55px;';
        valInput.placeholder = 'value';
        valInput.value = branch.value;
        valInput.setAttribute('list', datalistId);
        valInput.disabled = branch.operator === 'isEmpty' || branch.operator === 'isNotEmpty';
        valInput.addEventListener('change', () => {
          branch.value = valInput.value;
          updatePreview();
        });
        valWrap.appendChild(valInput);

        const valVarBtn = document.createElement('button');
        valVarBtn.style.cssText = branch.valueIsVariable ? STYLES.varToggleActive : STYLES.varToggle;
        valVarBtn.textContent = 'var';
        valVarBtn.title = 'Toggle variable reference (unquoted in expression)';
        valVarBtn.addEventListener('click', () => {
          branch.valueIsVariable = !branch.valueIsVariable;
          valVarBtn.style.cssText = branch.valueIsVariable ? STYLES.varToggleActive : STYLES.varToggle;
          updatePreview();
        });
        valWrap.appendChild(valVarBtn);
        row.appendChild(valWrap);

        const arrow = document.createElement('span');
        arrow.style.cssText = 'font-size:11px;color:#999;';
        arrow.textContent = '\u2192';
        row.appendChild(arrow);

        // Result input + var toggle (with autocomplete)
        const resWrap = document.createElement('span');
        resWrap.style.cssText = 'display:inline-flex;align-items:center;gap:2px;';

        const resultInput = document.createElement('input');
        resultInput.style.cssText = STYLES.input + 'width:55px;';
        resultInput.placeholder = 'result';
        resultInput.value = branch.result;
        resultInput.setAttribute('list', datalistId);
        resultInput.addEventListener('change', () => {
          branch.result = resultInput.value;
          updatePreview();
        });
        resWrap.appendChild(resultInput);

        const resVarBtn = document.createElement('button');
        resVarBtn.style.cssText = branch.resultIsVariable ? STYLES.varToggleActive : STYLES.varToggle;
        resVarBtn.textContent = 'var';
        resVarBtn.title = 'Toggle variable reference (unquoted in expression)';
        resVarBtn.addEventListener('click', () => {
          branch.resultIsVariable = !branch.resultIsVariable;
          resVarBtn.style.cssText = branch.resultIsVariable ? STYLES.varToggleActive : STYLES.varToggle;
          updatePreview();
        });
        resWrap.appendChild(resVarBtn);
        row.appendChild(resWrap);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.style.cssText = STYLES.smallBtn;
        removeBtn.textContent = '\u00D7';
        removeBtn.addEventListener('click', () => {
          vr.branches.splice(idx, 1);
          renderBranches();
          updatePreview();
        });
        row.appendChild(removeBtn);

        branchesDiv.appendChild(row);
      });
    }

    renderBranches();
    container.appendChild(branchesDiv);

    // Add branch button
    const addBtn = document.createElement('button');
    addBtn.style.cssText = STYLES.smallBtn;
    addBtn.textContent = '+ Add Rule';
    addBtn.addEventListener('click', () => {
      vr.branches.push({ field: '', operator: '==', value: '', result: '' });
      renderBranches();
    });
    container.appendChild(addBtn);

    // ELSE row with var toggle
    const elseRow = document.createElement('div');
    elseRow.style.cssText = STYLES.branchRow + 'margin-top:4px;';
    const elseLabel = document.createElement('span');
    elseLabel.style.cssText = 'font-size:11px;font-weight:600;color:#666;min-width:40px;';
    elseLabel.textContent = 'ELSE';
    elseRow.appendChild(elseLabel);

    const elseInput = document.createElement('input');
    elseInput.style.cssText = STYLES.input + 'flex:1;';
    elseInput.placeholder = 'default value';
    elseInput.value = vr.defaultResult;
    elseInput.setAttribute('list', datalistId);
    elseInput.addEventListener('change', () => {
      vr.defaultResult = elseInput.value;
      updatePreview();
    });
    elseRow.appendChild(elseInput);

    const elseVarBtn = document.createElement('button');
    elseVarBtn.style.cssText = vr.defaultResultIsVariable ? STYLES.varToggleActive : STYLES.varToggle;
    elseVarBtn.textContent = 'var';
    elseVarBtn.title = 'Toggle variable reference (unquoted in expression)';
    elseVarBtn.addEventListener('click', () => {
      vr.defaultResultIsVariable = !vr.defaultResultIsVariable;
      elseVarBtn.style.cssText = vr.defaultResultIsVariable ? STYLES.varToggleActive : STYLES.varToggle;
      updatePreview();
    });
    elseRow.appendChild(elseVarBtn);

    container.appendChild(elseRow);

    // Preview
    const preview = document.createElement('div');
    preview.style.cssText = STYLES.preview;
    function updatePreview(): void {
      if (vr.branches.length > 0) {
        preview.textContent = 'Preview: ' + compileVisualRulesToExpression(vr);
      } else {
        preview.textContent = 'Add rules above to generate an expression.';
      }
    }
    updatePreview();
    container.appendChild(preview);

    // Save + Clear
    const actionBar = document.createElement('div');
    actionBar.style.cssText = 'display:flex;gap:4px;margin-top:4px;';

    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = STYLES.primaryBtn;
    saveBtn.textContent = 'Save Rule';
    saveBtn.addEventListener('click', () => {
      if (vr.branches.length === 0) return;
      const compiled = compileVisualRulesToExpression(vr);
      const newRule: CellTokenRule = {
        tokenIndex: selectedTokenIndex,
        mode: 'visual',
        visualRule: JSON.parse(JSON.stringify(vr)),
        compiledExpression: compiled,
      };
      saveWithScope(newRule);
    });
    actionBar.appendChild(saveBtn);

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = STYLES.dangerBtn;
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => clearRule());
    actionBar.appendChild(clearBtn);

    container.appendChild(actionBar);
  }

  // ---- CODE EDITOR ----
  function renderCodeEditor(
    container: HTMLElement,
    existingRule: CellTokenRule | undefined,
    _tokens: string[],
  ): void {
    const textarea = document.createElement('textarea');
    textarea.className = 'cf-code-area';
    textarea.style.cssText = STYLES.textarea;
    textarea.placeholder = 'e.g. amount > 1000 ? "High" : "Low"';

    // Pre-fill with existing expression or inline token expression
    if (existingRule?.compiledExpression) {
      textarea.value = existingRule.compiledExpression;
    } else if (_tokens.length > 0) {
      textarea.value = _tokens[selectedTokenIndex] || '';
    }
    container.appendChild(textarea);

    const hint = document.createElement('div');
    hint.style.cssText = STYLES.hint;
    hint.textContent =
      'Variables: field names, cell refs (A1, B2), date, dateTime, currentPage, totalPages.';
    container.appendChild(hint);

    // Save + Clear
    const actionBar = document.createElement('div');
    actionBar.style.cssText = 'display:flex;gap:4px;margin-top:4px;';

    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = STYLES.primaryBtn;
    saveBtn.textContent = 'Save Rule';
    saveBtn.addEventListener('click', () => {
      const expr = textarea.value.trim();
      if (!expr) return;
      const newRule: CellTokenRule = {
        tokenIndex: selectedTokenIndex,
        mode: 'code',
        compiledExpression: expr,
      };
      saveWithScope(newRule);
    });
    actionBar.appendChild(saveBtn);

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = STYLES.dangerBtn;
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => clearRule());
    actionBar.appendChild(clearBtn);

    container.appendChild(actionBar);
  }

  // Initial render
  render();
}
