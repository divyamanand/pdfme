import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Modal, Select, Button, Input, Space, AutoComplete } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type {
  TableConditionalFormatting,
  ConditionalRule,
  VisualRule,
  ConditionOperator,
  ChangeSchemas,
  SchemaForUI,
} from '@pdfme/common';
import {
  colIndexToLetter,
  compileVisualRulesToExpression,
  shiftRule,
  resolveRulesForCell,
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
  allSchemas: SchemaForUI[];
  changeSchemas: ChangeSchemas;
}

// Filter for CF-eligible schemas (all except image/signature)
const isCFEligible = (s: SchemaForUI) => s.type !== 'image' && s.type !== 'signature';
const isTableType = (s: SchemaForUI) => s.type === 'table' || s.type === 'nestedTable';

const ConditionalFormattingDialog: React.FC<ConditionalFormattingDialogProps> = ({
  open,
  onClose,
  schemas,
  allSchemas,
  changeSchemas,
}) => {
  const i18n = useContext(I18nContext);

  // Get all CF-eligible schemas on current page
  const eligibleSchemas = schemas.filter(isCFEligible);

  // State
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [currentMode, setCurrentMode] = useState<'visual' | 'code'>('visual');
  const [scope, setScope] = useState<'cell' | 'column' | 'row'>('cell');

  // Compute effective schema ID synchronously
  const effectiveSchemaId = useMemo(() => {
    if (selectedSchemaId && eligibleSchemas.some((s) => s.id === selectedSchemaId)) {
      return selectedSchemaId;
    }
    return eligibleSchemas[0]?.id || '';
  }, [selectedSchemaId, eligibleSchemas]);

  // Reset selection state when effective schema changes
  useEffect(() => {
    if (effectiveSchemaId !== selectedSchemaId) {
      setSelectedSchemaId(effectiveSchemaId);
      setSelectedRow(0);
      setSelectedCol(0);
    }
  }, [effectiveSchemaId, selectedSchemaId]);

  // Listen for canvas cell-select events (tables only)
  useEffect(() => {
    if (!open) return;

    const handleCellSelect = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.schemaId === effectiveSchemaId && detail.row !== undefined && detail.col !== undefined) {
        setSelectedRow(detail.row);
        setSelectedCol(detail.col);
      }
    };

    document.addEventListener('pdfme-table-cell-select', handleCellSelect);
    return () => document.removeEventListener('pdfme-table-cell-select', handleCellSelect);
  }, [open, effectiveSchemaId]);

  const selectedSchema = eligibleSchemas.find((s) => s.id === effectiveSchemaId) as any;
  const isTable = selectedSchema ? isTableType(selectedSchema) : false;

  // Parse table content (only relevant for table types)
  const content: string[][] = useMemo(() => {
    if (!selectedSchema || !isTable) return [];
    try {
      return JSON.parse(selectedSchema.content || '[]');
    } catch {
      return [];
    }
  }, [selectedSchema?.content, isTable]);
  const numRows = content.length;
  const numCols = content[0]?.length ?? 0;

  // Get CF data
  const cf: TableConditionalFormatting = isTable ? (selectedSchema?.conditionalFormatting || {}) : {};

  // For non-table schemas, the rule is stored directly on schema.conditionalFormatting
  const nonTableRule: ConditionalRule | undefined = !isTable ? selectedSchema?.conditionalFormatting : undefined;

  // Helper: get CF rule for a table cell
  const getCFRule = (r: number = selectedRow, c: number = selectedCol): ConditionalRule | undefined => {
    return resolveRulesForCell(cf, r, c);
  };

  const cellHasRule = (row: number, col: number): boolean => {
    return !!resolveRulesForCell(cf, row, col);
  };

  // Build autocomplete options — includes ALL schema field names + builtins + cell refs
  const autocompleteOptions = useMemo((): { value: string; label: string }[] => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    const add = (val: string, label?: string) => {
      if (!seen.has(val)) {
        seen.add(val);
        options.push({ value: val, label: label || val });
      }
    };

    // All schema field names across all pages
    for (const s of allSchemas) {
      if (s.name) add(s.name, `${s.name} (field)`);
    }
    // Builtins
    for (const b of BUILTINS) add(b, `${b} (builtin)`);
    // Current table cell refs (if table)
    if (isTable) {
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          add(colIndexToLetter(c) + (r + 1));
        }
      }
      // Cross-table cell refs (tableName.A1)
      for (const s of schemas) {
        if (!isTableType(s) || !s.name) continue;
        try {
          const rows: string[][] = JSON.parse((s as any).content || '[]');
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
              add(`${s.name}.${colIndexToLetter(c)}${r + 1}`);
            }
          }
        } catch {
          // skip
        }
      }
    }
    return options;
  }, [allSchemas, schemas, isTable, numRows, numCols]);

  const schemaId = selectedSchema?.id || '';

  // Get current rule for editor
  const existingRule: ConditionalRule | undefined = isTable ? getCFRule() : nonTableRule;

  // Save handler for table schemas
  const saveTableRule = useCallback(
    (newRule: ConditionalRule): void => {
      if (!schemaId) return;
      const updatedCF = { ...cf };

      if (scope === 'cell') {
        const key = `${selectedRow}:${selectedCol}`;
        updatedCF[key] = newRule;
      } else if (scope === 'column') {
        const wildcardRule: ConditionalRule = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
        const wcKey = `*:${selectedCol}`;
        updatedCF[wcKey] = wildcardRule;
        // Also apply to all existing rows
        for (let r = 0; r < numRows; r++) {
          const key = `${r}:${selectedCol}`;
          const rowDelta = r - selectedRow;
          updatedCF[key] = rowDelta === 0 ? newRule : shiftRule(newRule, rowDelta, 0);
        }
      } else if (scope === 'row') {
        const wildcardRule: ConditionalRule = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
        const wcKey = `${selectedRow}:*`;
        updatedCF[wcKey] = wildcardRule;
        // Also apply to all existing cols
        for (let c = 0; c < numCols; c++) {
          const key = `${selectedRow}:${c}`;
          const colDelta = c - selectedCol;
          updatedCF[key] = colDelta === 0 ? newRule : shiftRule(newRule, 0, colDelta);
        }
      }

      changeSchemas([{ key: 'conditionalFormatting', value: updatedCF, schemaId }]);
    },
    [cf, scope, selectedRow, selectedCol, schemaId, numRows, numCols, changeSchemas],
  );

  // Save handler for non-table schemas
  const saveNonTableRule = useCallback(
    (newRule: ConditionalRule): void => {
      if (!schemaId) return;
      changeSchemas([{ key: 'conditionalFormatting', value: newRule, schemaId }]);
    },
    [schemaId, changeSchemas],
  );

  const onSaveRule = useCallback(
    (newRule: ConditionalRule): void => {
      if (isTable) saveTableRule(newRule);
      else saveNonTableRule(newRule);
    },
    [isTable, saveTableRule, saveNonTableRule],
  );

  // Clear handler
  const clearRule = useCallback(() => {
    if (!schemaId) return;
    if (isTable) {
      const updated = { ...cf };
      const key = `${selectedRow}:${selectedCol}`;
      delete updated[key];
      changeSchemas([{ key: 'conditionalFormatting', value: updated, schemaId }]);
    } else {
      changeSchemas([{ key: 'conditionalFormatting', value: undefined, schemaId }]);
    }
  }, [cf, isTable, selectedRow, selectedCol, schemaId, changeSchemas]);

  if (!selectedSchema) {
    return (
      <Modal
        title="Conditional Formatting"
        open={open}
        onCancel={onClose}
        footer={null}
        width="min(960px, 90vw)"
      >
        <p>No eligible schemas on this page.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Conditional Formatting"
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(960px, 90vw)"
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      destroyOnClose
    >
      {/* Schema Selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, marginRight: 8 }}>Schema:</label>
        <Select
          value={effectiveSchemaId}
          onChange={(val) => {
            setSelectedSchemaId(val);
            setSelectedRow(0);
            setSelectedCol(0);
          }}
          style={{ width: 300 }}
          options={eligibleSchemas.map((s) => ({
            value: s.id,
            label: `${s.name} (${s.type})`,
          }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left: Cell Grid (tables only) */}
        {isTable && (
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
                        color: cellHasRule(r, c) ? '#1890ff' : '#999',
                      }}
                    >
                      {cellHasRule(r, c) ? '●' : '·'}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right: Rule Editor */}
        <div style={{ flex: '1 1 65%', paddingLeft: isTable ? 12 : 0 }}>
          {isTable && (
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Cell {colIndexToLetter(selectedCol)}{selectedRow + 1} {cellHasRule(selectedRow, selectedCol) && '●'}
            </div>
          )}
          {!isTable && (
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              {selectedSchema.name} {nonTableRule && '●'}
            </div>
          )}

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
            onSave={onSaveRule}
            onClear={clearRule}
            autocompleteOptions={autocompleteOptions}
          />

          {/* Scope Selector (tables only) */}
          {isTable && (
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
          )}
        </div>
      </div>
    </Modal>
  );
};

interface RuleEditorProps {
  mode: 'visual' | 'code';
  existingRule: ConditionalRule | undefined;
  onSave: (rule: ConditionalRule) => void;
  onClear: () => void;
  autocompleteOptions: { value: string; label: string }[];
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
  autocompleteOptions: { value: string; label: string }[];
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
      branches: [...rule.branches, { field: '', operator: '==', value: '', result: '', valueIsVariable: false, resultIsVariable: false }],
    });
  };

  const removeBranch = (idx: number) => {
    onRuleChange({
      ...rule,
      branches: rule.branches.filter((_, i) => i !== idx),
    });
  };

  const preview = compileVisualRulesToExpression(rule);

  const filterOption = (inputValue: string, option?: { value: string; label: string }) =>
    (option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase());

  return (
    <div>
      {rule.branches.map((branch, idx) => (
        <div key={idx} style={{ marginBottom: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{idx === 0 ? 'IF' : 'ELSE IF'}</span>
            <AutoComplete
              options={autocompleteOptions}
              filterOption={filterOption}
              value={branch.field}
              onSelect={(val) => updateBranch(idx, 'field', val)}
              onChange={(val) => updateBranch(idx, 'field', val)}
              placeholder="field"
              style={{ width: 100, fontSize: 11 }}
              size="small"
            />
            <select
              value={branch.operator}
              onChange={(e) => updateBranch(idx, 'operator', e.target.value as ConditionOperator)}
              style={{ width: 85, fontSize: 11, height: 24 }}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            {!['isEmpty', 'isNotEmpty'].includes(branch.operator) && (
              <AutoComplete
                options={autocompleteOptions}
                filterOption={filterOption}
                value={branch.value}
                onSelect={(val) => {
                  updateBranch(idx, 'value', val);
                  updateBranch(idx, 'valueIsVariable', true);
                }}
                onChange={(val) => {
                  updateBranch(idx, 'value', val);
                  const isKnown = autocompleteOptions.some(opt => opt.value === val);
                  updateBranch(idx, 'valueIsVariable', isKnown);
                }}
                placeholder="value"
                style={{ width: 100, fontSize: 11 }}
                size="small"
              />
            )}
            <span style={{ fontSize: 10, color: '#999' }}>→</span>
            <AutoComplete
              options={autocompleteOptions}
              filterOption={filterOption}
              value={branch.result}
              onSelect={(val) => {
                updateBranch(idx, 'result', val);
                updateBranch(idx, 'resultIsVariable', true);
              }}
              onChange={(val) => {
                updateBranch(idx, 'result', val);
                const isKnown = autocompleteOptions.some(opt => opt.value === val);
                updateBranch(idx, 'resultIsVariable', isKnown);
              }}
              placeholder="result"
              style={{ width: 100, fontSize: 11 }}
              size="small"
            />
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

      <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4, fontSize: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 600 }}>ELSE:</span>
          <AutoComplete
            options={autocompleteOptions}
            filterOption={filterOption}
            value={rule.defaultResult}
            onSelect={(val) => {
              onRuleChange({ ...rule, defaultResult: val, defaultResultIsVariable: true });
            }}
            onChange={(val) => {
              const isKnown = autocompleteOptions.some(opt => opt.value === val);
              onRuleChange({ ...rule, defaultResult: val, defaultResultIsVariable: isKnown });
            }}
            placeholder="default result"
            style={{ flex: 1, fontSize: 11 }}
            size="small"
          />
        </div>
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
