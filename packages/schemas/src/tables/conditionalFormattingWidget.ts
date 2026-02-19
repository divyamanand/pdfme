/**
 * Conditional Formatting PropPanel widget for table / nestedTable plugins.
 *
 * Vanilla JS widget that provides:
 * - Cell grid selector (dropdown with A1, B2, etc.)
 * - Token tabs for each {{...}} in the cell
 * - Visual Rule Editor (IF/ELSE chain) or Code Editor toggle
 * - Copy to row / column buttons
 */
import type { PropPanelWidgetProps, TableConditionalFormatting, CellTokenRule, CellKey } from '@pdfme/common';
import {
  colIndexToLetter,
  parseTokens,
  compileVisualRulesToExpression,
  tryParseExpressionToVisualRule,
} from '@pdfme/common';
import type { VisualRule, VisualConditionBranch, ConditionOperator } from '@pdfme/common';

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
  dotIndicator: 'display:inline-block;width:6px;height:6px;border-radius:50%;background:#1890ff;margin-left:4px;',
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

// ============================================================================
// WIDGET FUNCTION
// ============================================================================

export function conditionalFormattingWidget(props: PropPanelWidgetProps): void {
  const { rootElement, changeSchemas, activeSchema } = props;

  const schema = activeSchema as any;
  const content: string[][] = (() => {
    try { return JSON.parse(schema.content || '[]'); } catch { return []; }
  })();
  const numRows = content.length;
  const numCols = content[0]?.length ?? 0;

  const cf: TableConditionalFormatting = schema.conditionalFormatting || {};

  // Widget state (closure-scoped)
  let selectedRow = 0;
  let selectedCol = 0;
  let selectedTokenIndex = 0;
  let currentMode: 'visual' | 'code' = 'visual';

  // ---- Helper: save updated CF to schema ----
  function saveCF(updated: TableConditionalFormatting): void {
    changeSchemas([{ key: 'conditionalFormatting', value: updated, schemaId: activeSchema.id }]);
  }

  // ---- Helper: get cell key ----
  function cellKey(): string {
    return `${selectedRow}:${selectedCol}`;
  }

  // ---- Helper: get rules for current cell ----
  function getCellRules(): CellTokenRule[] {
    return (cf as any)[cellKey()] || [];
  }

  // ---- Helper: get rule for current token ----
  function getTokenRule(): CellTokenRule | undefined {
    return getCellRules().find((r: CellTokenRule) => r.tokenIndex === selectedTokenIndex);
  }

  // ---- Helper: check if cell has rules ----
  function cellHasRules(row: number, col: number): boolean {
    const key = `${row}:${col}`;
    const rules = (cf as any)[key];
    return Array.isArray(rules) && rules.length > 0;
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

    // ---- Cell Selector ----
    const cellLabel = document.createElement('div');
    cellLabel.style.cssText = STYLES.label;
    cellLabel.textContent = 'Cell Conditions';
    container.appendChild(cellLabel);

    const cellSelect = document.createElement('select');
    cellSelect.style.cssText = STYLES.select;
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

    // ---- Cell content preview ----
    const cellContent = (content[selectedRow] && content[selectedRow][selectedCol]) || '';
    const tokens = parseTokens(cellContent);

    if (tokens.length === 0) {
      const noTok = document.createElement('div');
      noTok.style.cssText = STYLES.noTokens;
      noTok.textContent = 'No {{...}} tokens in this cell.';
      container.appendChild(noTok);
      rootElement.appendChild(container);
      return;
    }

    // ---- Token Tabs ----
    const tokLabel = document.createElement('div');
    tokLabel.style.cssText = STYLES.label;
    tokLabel.textContent = 'Tokens';
    container.appendChild(tokLabel);

    const tokenBar = document.createElement('div');
    tokenBar.style.cssText = STYLES.tokenBar;
    tokens.forEach((tok, idx) => {
      const btn = document.createElement('button');
      btn.style.cssText = idx === selectedTokenIndex ? STYLES.tokenTabActive : STYLES.tokenTab;
      const display = tok.length > 18 ? tok.substring(0, 16) + '\u2026' : tok;
      btn.textContent = `{{${display}}}`;
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
        // Try to convert code to visual
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

    // ---- Visual Editor ----
    if (currentMode === 'visual') {
      renderVisualEditor(container, existingRule, tokens);
    } else {
      renderCodeEditor(container, existingRule, tokens);
    }

    // ---- Copy Actions ----
    const copyBar = document.createElement('div');
    copyBar.style.cssText = STYLES.copyBar;

    const copyRowBtn = document.createElement('button');
    copyRowBtn.style.cssText = STYLES.smallBtn;
    copyRowBtn.textContent = 'Copy to Row';
    copyRowBtn.addEventListener('click', () => {
      const rules = getCellRules();
      if (rules.length === 0) return;
      const updated = { ...cf } as any;
      for (let c = 0; c < numCols; c++) {
        const key = `${selectedRow}:${c}`;
        updated[key] = rules.map((r: CellTokenRule) => ({ ...r }));
      }
      saveCF(updated);
    });
    copyBar.appendChild(copyRowBtn);

    const copyColBtn = document.createElement('button');
    copyColBtn.style.cssText = STYLES.smallBtn;
    copyColBtn.textContent = 'Copy to Column';
    copyColBtn.addEventListener('click', () => {
      const rules = getCellRules();
      if (rules.length === 0) return;
      const updated = { ...cf } as any;
      for (let r = 0; r < numRows; r++) {
        const key = `${r}:${selectedCol}`;
        updated[key] = rules.map((r: CellTokenRule) => ({ ...r }));
      }
      saveCF(updated);
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
    let vr: VisualRule = existingRule?.visualRule || { branches: [], defaultResult: '' };

    // If existing rule is code mode, try to parse it into visual
    if (existingRule && existingRule.mode === 'code' && existingRule.compiledExpression) {
      const parsed = tryParseExpressionToVisualRule(existingRule.compiledExpression);
      if (parsed) {
        vr = parsed;
        // Set the result for branches from the parsed data
        if (parsed.branches.length > 0) {
          const tokenExpr = _tokens[selectedTokenIndex] || '';
          const parsedFromInline = tryParseExpressionToVisualRule(tokenExpr);
          if (parsedFromInline && parsedFromInline.branches.length > 0) {
            vr = parsedFromInline;
          }
        }
      }
    }

    // If no branches yet, try to pre-populate from inline ternary in the cell token
    if (vr.branches.length === 0 && !existingRule) {
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

        // Field input
        const fieldInput = document.createElement('input');
        fieldInput.style.cssText = STYLES.input + 'width:70px;';
        fieldInput.placeholder = 'field';
        fieldInput.value = branch.field;
        fieldInput.addEventListener('change', () => { branch.field = fieldInput.value; updatePreview(); });
        row.appendChild(fieldInput);

        // Operator select
        const opSelect = document.createElement('select');
        opSelect.style.cssText = STYLES.input + 'width:75px;';
        OPERATORS.forEach(op => {
          const opt = document.createElement('option');
          opt.value = op.value;
          opt.textContent = op.label;
          if (op.value === branch.operator) opt.selected = true;
          opSelect.appendChild(opt);
        });
        opSelect.addEventListener('change', () => { branch.operator = opSelect.value as ConditionOperator; updatePreview(); });
        row.appendChild(opSelect);

        // Value input (hidden for isEmpty/isNotEmpty)
        const valInput = document.createElement('input');
        valInput.style.cssText = STYLES.input + 'width:60px;';
        valInput.placeholder = 'value';
        valInput.value = branch.value;
        valInput.disabled = branch.operator === 'isEmpty' || branch.operator === 'isNotEmpty';
        valInput.addEventListener('change', () => { branch.value = valInput.value; updatePreview(); });
        row.appendChild(valInput);

        const arrow = document.createElement('span');
        arrow.style.cssText = 'font-size:11px;color:#999;';
        arrow.textContent = '\u2192';
        row.appendChild(arrow);

        // Result input
        const resultInput = document.createElement('input');
        resultInput.style.cssText = STYLES.input + 'width:60px;';
        resultInput.placeholder = 'result';
        resultInput.value = branch.result;
        resultInput.addEventListener('change', () => { branch.result = resultInput.value; updatePreview(); });
        row.appendChild(resultInput);

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

    // ELSE row
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
    elseInput.addEventListener('change', () => { vr.defaultResult = elseInput.value; updatePreview(); });
    elseRow.appendChild(elseInput);
    container.appendChild(elseRow);

    // Preview
    const preview = document.createElement('div');
    preview.style.cssText = STYLES.preview;
    preview.className = 'cf-preview';
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
      saveRule(newRule);
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
    } else {
      const tokenExpr = _tokens[selectedTokenIndex] || '';
      textarea.value = tokenExpr;
    }
    container.appendChild(textarea);

    const hint = document.createElement('div');
    hint.style.cssText = STYLES.hint;
    hint.textContent = 'Built-ins: date, dateTime, currentPage, totalPages, cell refs (A1, B2). Use any input field names.';
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
      saveRule(newRule);
    });
    actionBar.appendChild(saveBtn);

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = STYLES.dangerBtn;
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => clearRule());
    actionBar.appendChild(clearBtn);

    container.appendChild(actionBar);
  }

  // ---- Save/Clear helpers ----
  function saveRule(newRule: CellTokenRule): void {
    const key = cellKey();
    const updated = { ...cf } as any;
    const existing: CellTokenRule[] = updated[key] ? [...updated[key]] : [];

    // Upsert: replace existing rule for this tokenIndex, or add new
    const idx = existing.findIndex((r: CellTokenRule) => r.tokenIndex === newRule.tokenIndex);
    if (idx >= 0) {
      existing[idx] = newRule;
    } else {
      existing.push(newRule);
    }
    updated[key] = existing;
    saveCF(updated);
  }

  function clearRule(): void {
    const key = cellKey();
    const updated = { ...cf } as any;
    const existing: CellTokenRule[] = updated[key] ? [...updated[key]] : [];

    const filtered = existing.filter((r: CellTokenRule) => r.tokenIndex !== selectedTokenIndex);
    if (filtered.length === 0) {
      delete updated[key];
    } else {
      updated[key] = filtered;
    }
    saveCF(updated);
  }

  // Initial render
  render();
}
