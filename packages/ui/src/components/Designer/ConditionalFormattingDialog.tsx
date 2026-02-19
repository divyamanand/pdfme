import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Modal, Select, Button, Tabs, Input, Space } from 'antd';
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import type {
  TableConditionalFormatting,
  CellTokenRule,
  VisualRule,
  ConditionOperator,
  ChangeSchemas,
  SchemaForUI,
} from '@pdfme/common';
import {
  colIndexToLetter,
  parseTokens,
  replaceTokenAtIndex,
  compileVisualRulesToExpression,
  tryParseExpressionToVisualRule,
  shiftCellRefsInExpression,
  shiftRule,
} from '@pdfme/common';
import type { VisualConditionBranch } from '@pdfme/common';
import { I18nContext } from '../../contexts.js';

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

interface ConditionalFormattingDialogProps {
  open: boolean;
  onClose: () => void;
  schemas: SchemaForUI[];
  changeSchemas: ChangeSchemas;
}

const ConditionalFormattingDialog: React.FC<ConditionalFormattingDialogProps> = ({
  open,
  onClose,
  schemas,
  changeSchemas,
}) => {
  const i18n = useContext(I18nContext);

  // Get all table/nestedTable schemas
  const tableSchemas = schemas.filter((s) => s.type === 'table' || s.type === 'nestedTable');

  // State
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<'visual' | 'code'>('visual');
  const [scope, setScope] = useState<'cell' | 'column' | 'row'>('cell');

  // Auto-select first table when dialog opens
  useEffect(() => {
    if (open && tableSchemas.length > 0 && !selectedTableId) {
      setSelectedTableId(tableSchemas[0].id);
      setSelectedRow(0);
      setSelectedCol(0);
      setSelectedTokenIndex(0);
    }
  }, [open, tableSchemas, selectedTableId]);

  // Listen for canvas cell-select events
  useEffect(() => {
    if (!open) return;

    const handleCellSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.schemaId === selectedTableId && detail.row !== undefined && detail.col !== undefined) {
        setSelectedRow(detail.row);
        setSelectedCol(detail.col);
        setSelectedTokenIndex(0);
      }
    };

    document.addEventListener('pdfme-table-cell-select', handleCellSelect);
    return () => document.removeEventListener('pdfme-table-cell-select', handleCellSelect);
  }, [open, selectedTableId]);

  const selectedSchema = tableSchemas.find((s) => s.id === selectedTableId) as any;

  const content: string[][] = (() => {
    if (!selectedSchema) return [];
    try {
      return JSON.parse(selectedSchema.content || '[]');
    } catch {
      return [];
    }
  })();
  const numRows = content.length;
  const numCols = content[0]?.length ?? 0;

  const cf: TableConditionalFormatting = selectedSchema?.conditionalFormatting || {};

  // Helper: get CF rules for a cell (cell-specific → *:col → row:*)
  const getCFRules = (r: number = selectedRow, c: number = selectedCol): CellTokenRule[] => {
    const cellKey = `${r}:${c}`;
    const cellRules = (cf as any)[cellKey];
    if (Array.isArray(cellRules) && cellRules.length > 0) return cellRules;
    const colWildcard = (cf as any)[`*:${c}`];
    if (Array.isArray(colWildcard) && colWildcard.length > 0) return colWildcard;
    const rowWildcard = (cf as any)[`${r}:*`];
    if (Array.isArray(rowWildcard) && rowWildcard.length > 0) return rowWildcard;
    return [];
  };

  const getTokenRule = (): CellTokenRule | undefined => {
    return getCFRules().find((r) => r.tokenIndex === selectedTokenIndex);
  };

  const cellHasRules = (row: number, col: number): boolean => {
    return getCFRules(row, col).length > 0;
  };

  const getEffectiveTokens = (): { tokens: string[]; isVirtual: boolean } => {
    const cellContent = (content[selectedRow] && content[selectedRow][selectedCol]) || '';
    const tokens = parseTokens(cellContent);
    if (tokens.length === 0) {
      return { tokens: ['__cell_value__'], isVirtual: true };
    }
    return { tokens, isVirtual: false };
  };

  // Helper: build autocomplete options
  const buildAutocompleteList = (): string[] => {
    const options: string[] = [];
    // Field names
    for (const s of schemas) {
      if (s.name && !options.includes(s.name)) options.push(s.name);
    }
    // Builtins
    for (const b of BUILTINS) {
      if (!options.includes(b)) options.push(b);
    }
    // Current table cell refs
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const ref = colIndexToLetter(c) + (r + 1);
        if (!options.includes(ref)) options.push(ref);
      }
    }
    // Cross-table cell refs
    for (const s of schemas) {
      if (s.type !== 'table' && s.type !== 'nestedTable') continue;
      if (!s.name) continue;
      try {
        const rows: string[][] = JSON.parse((s as any).content || '[]');
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
            const ref = `${s.name}.${colIndexToLetter(c)}${r + 1}`;
            if (!options.includes(ref)) options.push(ref);
          }
        }
      } catch {
        // skip
      }
    }
    return options;
  };

  const applySingleCell = useCallback(
    (updatedCF: any, updatedContent: string[][], row: number, col: number, rule: CellTokenRule): void => {
      const key = `${row}:${col}`;
      const existing: CellTokenRule[] = updatedCF[key] ? [...updatedCF[key]] : [];
      const idx = existing.findIndex((r) => r.tokenIndex === rule.tokenIndex);
      if (idx >= 0) existing[idx] = rule;
      else existing.push(rule);
      updatedCF[key] = existing;

      if (!updatedContent[row]) return;
      const cellText = updatedContent[row][col] ?? '';
      const tokens = parseTokens(cellText);

      if (tokens.length === 0) {
        updatedContent[row][col] = `{{${rule.compiledExpression}}}`;
      } else if (rule.tokenIndex < tokens.length) {
        updatedContent[row][col] = replaceTokenAtIndex(
          cellText,
          rule.tokenIndex,
          `{{${rule.compiledExpression}}}`,
        );
      }
    },
    [],
  );

  const schemaId = selectedSchema?.id || '';

  const saveWithScope = useCallback(
    (newRule: CellTokenRule): void => {
      if (!schemaId) return;
      const updatedCF = { ...cf } as any;
      const updatedContent = content.map((row) => [...row]);

      if (scope === 'cell') {
        applySingleCell(updatedCF, updatedContent, selectedRow, selectedCol, newRule);
      } else if (scope === 'column') {
        const wildcardRule: CellTokenRule = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
        const wcKey = `*:${selectedCol}`;
        updatedCF[wcKey] = [wildcardRule];
        for (let r = 0; r < numRows; r++) {
          const rowDelta = r - selectedRow;
          const shifted = rowDelta === 0 ? newRule : shiftRule(newRule, rowDelta, 0);
          applySingleCell(updatedCF, updatedContent, r, selectedCol, shifted);
        }
      } else if (scope === 'row') {
        const wildcardRule: CellTokenRule = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
        const wcKey = `${selectedRow}:*`;
        updatedCF[wcKey] = [wildcardRule];
        for (let c = 0; c < numCols; c++) {
          const colDelta = c - selectedCol;
          const shifted = colDelta === 0 ? newRule : shiftRule(newRule, 0, colDelta);
          applySingleCell(updatedCF, updatedContent, selectedRow, c, shifted);
        }
      }

      changeSchemas([
        { key: 'content', value: JSON.stringify(updatedContent), schemaId },
        { key: 'conditionalFormatting', value: updatedCF, schemaId },
      ]);
    },
    [cf, content, scope, selectedRow, selectedCol, schemaId, numRows, numCols, changeSchemas, applySingleCell],
  );

  const clearRule = useCallback(() => {
    if (!schemaId) return;
    const updated = { ...cf } as any;
    const key = `${selectedRow}:${selectedCol}`;
    const existing: CellTokenRule[] = updated[key] ? [...updated[key]] : [];
    const filtered = existing.filter((r) => r.tokenIndex !== selectedTokenIndex);
    if (filtered.length === 0) delete updated[key];
    else updated[key] = filtered;
    changeSchemas([{ key: 'conditionalFormatting', value: updated, schemaId }]);
  }, [cf, selectedRow, selectedCol, selectedTokenIndex, schemaId, changeSchemas]);

  const { tokens: effectiveTokens, isVirtual } = getEffectiveTokens();
  const existingRule = getTokenRule();

  if (!selectedSchema) {
    return (
      <Modal
        title="Cell Conditions"
        open={open}
        onCancel={onClose}
        footer={null}
        width="min(960px, 90vw)"
      >
        <p>No tables available on this page.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Cell Conditions"
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(960px, 90vw)"
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      destroyOnClose
    >
      {/* Table Selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, marginRight: 8 }}>Table:</label>
        <Select
          value={selectedTableId}
          onChange={setSelectedTableId}
          style={{ width: 300 }}
          options={tableSchemas.map((s) => ({
            value: s.id,
            label: `${s.name} (${s.type})`,
          }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left: Cell Grid */}
        <div style={{ flex: '0 0 35%', borderRight: '1px solid #f0f0f0', paddingRight: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Cell Selection</div>

          {/* Column headers */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <div style={{ width: 24, fontSize: 11, color: '#999' }}></div>
            {Array.from({ length: numCols }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 24,
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#666',
                }}
              >
                {colIndexToLetter(i)}
              </div>
            ))}
          </div>

          {/* Body grid */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {Array.from({ length: numRows }, (_, r) => (
              <div key={r} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <div style={{ width: 24, fontSize: 11, color: '#999', textAlign: 'center' }}>{r + 1}</div>
                {Array.from({ length: numCols }, (_, c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setSelectedRow(r);
                      setSelectedCol(c);
                      setSelectedTokenIndex(0);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      padding: 0,
                      border: r === selectedRow && c === selectedCol ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      backgroundColor: r === selectedRow && c === selectedCol ? '#e6f7ff' : '#fff',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 10,
                      color: cellHasRules(r, c) ? '#1890ff' : '#999',
                    }}
                  >
                    {cellHasRules(r, c) ? '●' : '·'}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Rule Editor */}
        <div style={{ flex: '1 1 65%', paddingLeft: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Cell {colIndexToLetter(selectedCol)}{selectedRow + 1} {cellHasRules(selectedRow, selectedCol) && '●'}
          </div>

          {/* Token Tabs */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Tokens:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {effectiveTokens.map((tok, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTokenIndex(idx)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    border: idx === selectedTokenIndex ? '1px solid #1890ff' : '1px solid #d9d9d9',
                    backgroundColor: idx === selectedTokenIndex ? '#e6f7ff' : '#fff',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: idx === selectedTokenIndex ? '#1890ff' : '#666',
                    fontFamily: 'monospace',
                  }}
                >
                  {isVirtual ? '[cell value]' : `{{${tok.length > 18 ? tok.substring(0, 16) + '…' : tok}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Toggle */}
          <div style={{ marginBottom: 12, display: 'flex', gap: 4 }}>
            <button
              onClick={() => setCurrentMode('visual')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                border: currentMode === 'visual' ? '1px solid #1890ff' : '1px solid #d9d9d9',
                backgroundColor: currentMode === 'visual' ? '#1890ff' : '#fff',
                color: currentMode === 'visual' ? '#fff' : '#666',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Visual
            </button>
            <button
              onClick={() => setCurrentMode('code')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                border: currentMode === 'code' ? '1px solid #1890ff' : '1px solid #d9d9d9',
                backgroundColor: currentMode === 'code' ? '#1890ff' : '#fff',
                color: currentMode === 'code' ? '#fff' : '#666',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Code
            </button>
          </div>

          {/* Editor Content */}
          <RuleEditor
            mode={currentMode}
            existingRule={existingRule}
            onSave={saveWithScope}
            onClear={clearRule}
            autocompleteOptions={buildAutocompleteList()}
          />

          {/* Scope Selector */}
          <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Apply to:</div>
            <Space>
              <button
                onClick={() => setScope('cell')}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  border: scope === 'cell' ? '1px solid #722ed1' : '1px solid #d9d9d9',
                  backgroundColor: scope === 'cell' ? '#f9f0ff' : '#fff',
                  color: scope === 'cell' ? '#722ed1' : '#666',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {colIndexToLetter(selectedCol)}{selectedRow + 1} only
              </button>
              <button
                onClick={() => setScope('column')}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  border: scope === 'column' ? '1px solid #722ed1' : '1px solid #d9d9d9',
                  backgroundColor: scope === 'column' ? '#f9f0ff' : '#fff',
                  color: scope === 'column' ? '#722ed1' : '#666',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Col {colIndexToLetter(selectedCol)} (all rows)
              </button>
              <button
                onClick={() => setScope('row')}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  border: scope === 'row' ? '1px solid #722ed1' : '1px solid #d9d9d9',
                  backgroundColor: scope === 'row' ? '#f9f0ff' : '#fff',
                  color: scope === 'row' ? '#722ed1' : '#666',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Row {selectedRow + 1} (all cols)
              </button>
            </Space>
          </div>
        </div>
      </div>
    </Modal>
  );
};

interface RuleEditorProps {
  mode: 'visual' | 'code';
  existingRule: CellTokenRule | undefined;
  onSave: (rule: CellTokenRule) => void;
  onClear: () => void;
  autocompleteOptions: string[];
}

const RuleEditor: React.FC<RuleEditorProps> = ({ mode, existingRule, onSave, onClear, autocompleteOptions }) => {
  const [visualRule, setVisualRule] = useState<VisualRule>(
    existingRule?.visualRule ? JSON.parse(JSON.stringify(existingRule.visualRule)) : { branches: [], defaultResult: '' },
  );
  const [codeValue, setCodeValue] = useState(existingRule?.compiledExpression || '');

  if (mode === 'visual') {
    return (
      <VisualRuleEditor
        rule={visualRule}
        onRuleChange={setVisualRule}
        onSave={() => {
          const compiled = compileVisualRulesToExpression(visualRule);
          onSave({
            tokenIndex: 0,
            mode: 'visual',
            visualRule: JSON.parse(JSON.stringify(visualRule)),
            compiledExpression: compiled,
          });
        }}
        onClear={onClear}
        autocompleteOptions={autocompleteOptions}
      />
    );
  }

  return (
    <CodeRuleEditor
      value={codeValue}
      onChange={setCodeValue}
      onSave={() => {
        onSave({
          tokenIndex: 0,
          mode: 'code',
          compiledExpression: codeValue.trim(),
        });
      }}
      onClear={onClear}
    />
  );
};

interface VisualRuleEditorProps {
  rule: VisualRule;
  onRuleChange: (rule: VisualRule) => void;
  onSave: () => void;
  onClear: () => void;
  autocompleteOptions: string[];
}

const VisualRuleEditor: React.FC<VisualRuleEditorProps> = ({ rule, onRuleChange, onSave, onClear, autocompleteOptions }) => {
  const updateBranch = (idx: number, field: keyof VisualConditionBranch, value: any) => {
    const newBranches = [...rule.branches];
    (newBranches[idx] as any)[field] = value;
    onRuleChange({ ...rule, branches: newBranches });
  };

  const addBranch = () => {
    onRuleChange({
      ...rule,
      branches: [...rule.branches, { field: '', operator: '==', value: '', result: '' }],
    });
  };

  const removeBranch = (idx: number) => {
    onRuleChange({
      ...rule,
      branches: rule.branches.filter((_, i) => i !== idx),
    });
  };

  const preview = compileVisualRulesToExpression(rule);

  return (
    <div>
      {rule.branches.map((branch, idx) => (
        <div key={idx} style={{ marginBottom: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'IF' : 'ELSE IF'}</span>
            <Input
              placeholder="field"
              value={branch.field}
              onChange={(e) => updateBranch(idx, 'field', e.target.value)}
              list={`ac-field-${idx}`}
              style={{ width: 70, fontSize: 11, height: 24 }}
            />
            <datalist id={`ac-field-${idx}`}>
              {autocompleteOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <select
              value={branch.operator}
              onChange={(e) => updateBranch(idx, 'operator', e.target.value as ConditionOperator)}
              style={{ width: 75, fontSize: 11, height: 24 }}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            {!['isEmpty', 'isNotEmpty'].includes(branch.operator) && (
              <Input
                placeholder="value"
                value={branch.value}
                onChange={(e) => updateBranch(idx, 'value', e.target.value)}
                list={`ac-val-${idx}`}
                style={{ width: 60, fontSize: 11, height: 24 }}
              />
            )}
            <datalist id={`ac-val-${idx}`}>
              {autocompleteOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <span style={{ fontSize: 10, color: '#999' }}>→</span>
            <Input
              placeholder="result"
              value={branch.result}
              onChange={(e) => updateBranch(idx, 'result', e.target.value)}
              list={`ac-res-${idx}`}
              style={{ width: 60, fontSize: 11, height: 24 }}
            />
            <datalist id={`ac-res-${idx}`}>
              {autocompleteOptions.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <Button
              type="text"
              danger
              size="small"
              onClick={() => removeBranch(idx)}
              icon={<DeleteOutlined />}
            />
          </div>
        </div>
      ))}

      <Button size="small" style={{ marginBottom: 8 }} onClick={addBranch}>
        + Add Rule
      </Button>

      <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>
        ELSE: <Input.TextArea value={rule.defaultResult} onChange={(e) => onRuleChange({ ...rule, defaultResult: e.target.value })} rows={1} />
      </div>

      <div style={{ marginBottom: 8, padding: 6, backgroundColor: '#f5f5f5', borderRadius: 3, fontSize: 10, fontFamily: 'monospace' }}>
        {preview}
      </div>

      <Space>
        <Button type="primary" size="small" onClick={onSave}>
          Save Rule
        </Button>
        <Button danger size="small" onClick={onClear}>
          Clear
        </Button>
      </Space>
    </div>
  );
};

interface CodeRuleEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}

const CodeRuleEditor: React.FC<CodeRuleEditorProps> = ({ value, onChange, onSave, onClear }) => {
  return (
    <div>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='e.g. amount > 1000 ? "High" : "Low"'
        rows={4}
        style={{ fontSize: 11, fontFamily: 'monospace', marginBottom: 8 }}
      />
      <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
        Variables: field names, cell refs (A1, B2), table.A1, currentPage, totalPages
      </div>
      <Space>
        <Button type="primary" size="small" onClick={onSave}>
          Save Rule
        </Button>
        <Button danger size="small" onClick={onClear}>
          Clear
        </Button>
      </Space>
    </div>
  );
};

export default ConditionalFormattingDialog;
