import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Modal, Select, Button, Input, InputNumber, Space, AutoComplete } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type {
  TableConditionalFormatting,
  ConditionalRule,
  VisualRule,
  VisualConditionBranch,
  ConditionClause,
  ConditionOperator,
  ChangeSchemas,
  SchemaForUI,
  CFStyleOverrides,
  CFValueType,
} from '@pdfme/common';
import {
  colIndexToLetter,
  compileVisualRulesToExpression,
  shiftRule,
  resolveRulesForCell,
  resolveValueType,
  getBranchClauses,
} from '@pdfme/common';
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

const AGG_FUNCTIONS = [
  { name: 'sum',     hint: 'sum(A1, A2, ...)' },
  { name: 'min',     hint: 'min(A1, A2, ...)' },
  { name: 'max',     hint: 'max(A1, A2, ...)' },
  { name: 'avg',     hint: 'avg(A1, A2, ...)' },
  { name: 'product', hint: 'product(A1, A2, ...)' },
  { name: 'count',   hint: 'count(A1, A2, ...)' },
];

const VALUE_TYPE_OPTIONS: { value: CFValueType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'variable', label: 'Variable' },
  { value: 'field', label: 'Field' },
  { value: 'dateTime', label: 'DateTime' },
];

const TypeSelector: React.FC<{
  value: CFValueType;
  onChange: (type: CFValueType) => void;
}> = ({ value, onChange }) => (
  <Select
    size="small"
    value={value}
    onChange={onChange}
    style={{ width: 88, fontSize: 10 }}
    options={VALUE_TYPE_OPTIONS}
  />
);

const ValueInput: React.FC<{
  value: string;
  valueType: CFValueType;
  onChange: (val: string) => void;
  autocompleteOptions: { value: string; label: string }[];
  placeholder?: string;
  filterOption: (input: string, option?: { value: string; label: string }) => boolean;
}> = ({ value: val, valueType, onChange, autocompleteOptions, placeholder, filterOption }) => {
  switch (valueType) {
    case 'number':
      return (
        <InputNumber
          size="small"
          value={val !== '' ? Number(val) : undefined}
          onChange={(n) => onChange(n !== null && n !== undefined ? String(n) : '')}
          placeholder={placeholder || '0'}
          style={{ width: 100, fontSize: 11 }}
        />
      );
    case 'variable':
    case 'field':
      return (
        <AutoComplete
          options={autocompleteOptions}
          filterOption={filterOption}
          value={val}
          onChange={onChange}
          placeholder={placeholder || (valueType === 'field' ? 'field ref' : 'variable')}
          style={{ width: 100, fontSize: 11 }}
          size="small"
        />
      );
    case 'dateTime':
      return (
        <Input
          size="small"
          value={val}
          onChange={(e) => onChange(e.target.value)}
          placeholder="YYYY-MM-DD"
          style={{ width: 110, fontSize: 11 }}
        />
      );
    default: // text
      return (
        <Input
          size="small"
          value={val}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'text'}
          style={{ width: 100, fontSize: 11 }}
        />
      );
  }
};

interface ConditionalFormattingDialogProps {
  open: boolean;
  onClose: () => void;
  schemas: SchemaForUI[];
  allSchemas: SchemaForUI[];
  changeSchemas: ChangeSchemas;
}

// Branch style picker component for per-branch styles, prefix, suffix
const BranchStylePicker: React.FC<{
  styles?: CFStyleOverrides;
  prefix?: string;
  suffix?: string;
  onChange: (styles: CFStyleOverrides | undefined) => void;
  onPrefixChange: (v: string) => void;
  onSuffixChange: (v: string) => void;
}> = ({ styles, prefix, suffix, onChange, onPrefixChange, onSuffixChange }) => {
  const [expanded, setExpanded] = useState(false);
  const hasStyles = styles && Object.keys(styles).length > 0;

  const updateStyle = (key: keyof CFStyleOverrides, value: any) => {
    const updated = { ...(styles || {}) };
    if (value === undefined || value === '' || value === null || value === false) {
      delete (updated as any)[key];
    } else {
      (updated as any)[key] = value;
    }
    onChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Input size="small" value={prefix || ''} onChange={(e) => onPrefixChange(e.target.value)} placeholder="prefix" style={{ width: 60, fontSize: 10 }} />
        <span style={{ fontSize: 10, color: '#999' }}>[ result ]</span>
        <Input size="small" value={suffix || ''} onChange={(e) => onSuffixChange(e.target.value)} placeholder="suffix" style={{ width: 60, fontSize: 10 }} />
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 10, padding: '2px 6px', cursor: 'pointer',
            border: hasStyles ? '1px solid #1890ff' : '1px solid #d9d9d9',
            backgroundColor: hasStyles ? '#e6f7ff' : '#fff',
            borderRadius: 3,
          }}
        >
          Style {hasStyles ? '●' : ''}
        </button>
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 4, marginTop: 4, backgroundColor: '#f9f9f9', borderRadius: 3, fontSize: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            Font: <input type="color" value={styles?.fontColor || '#000000'} onChange={(e) => updateStyle('fontColor', e.target.value)} style={{ width: 24, height: 18, border: 'none', cursor: 'pointer' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            BG: <input type="color" value={styles?.backgroundColor || '#ffffff'} onChange={(e) => updateStyle('backgroundColor', e.target.value)} style={{ width: 24, height: 18, border: 'none', cursor: 'pointer' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            Size: <input type="number" value={styles?.fontSize ?? ''} onChange={(e) => updateStyle('fontSize', e.target.value ? Number(e.target.value) : undefined)} style={{ width: 40, fontSize: 10, height: 20 }} min={1} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            Align:
            <select value={styles?.alignment || ''} onChange={(e) => updateStyle('alignment', e.target.value || undefined)} style={{ fontSize: 10, height: 20 }}>
              <option value="">default</option>
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input type="checkbox" checked={!!styles?.strikethrough} onChange={(e) => updateStyle('strikethrough', e.target.checked || undefined)} />
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input type="checkbox" checked={!!styles?.underline} onChange={(e) => updateStyle('underline', e.target.checked || undefined)} />
            <span style={{ textDecoration: 'underline' }}>U</span>
          </label>
        </div>
      )}
    </div>
  );
};

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
      if (detail?.schemaId && detail.row !== undefined && detail.col !== undefined) {
        // Update selected schema if it changed
        if (detail.schemaId !== effectiveSchemaId) {
          setSelectedSchemaId(detail.schemaId);
        }
        // Update selected cell
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

  // Auto-detect scope from existing CF rules when selected cell or cf changes
  useEffect(() => {
    if (!isTable) return;
    const cellKey = `${selectedRow}:${selectedCol}`;
    if (cf[cellKey]) {
      setScope('cell');
    } else if (cf[`*:${selectedCol}`]) {
      setScope('column');
    } else if (cf[`${selectedRow}:*`]) {
      setScope('row');
    } else {
      setScope('cell');
    }
  }, [selectedRow, selectedCol, cf, isTable]);

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
    // Aggregate functions
    for (const { name, hint } of AGG_FUNCTIONS) add(name, `${hint} (aggregate)`);
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
        // Store only the wildcard; resolveRulesForCell shifts it at eval time
        updatedCF[`*:${selectedCol}`] = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
        // Clear any individual cell rules for this column so wildcard takes effect
        for (let r = 0; r < numRows; r++) {
          delete updatedCF[`${r}:${selectedCol}`];
        }
      } else if (scope === 'row') {
        // Store only the wildcard; resolveRulesForCell shifts it at eval time
        updatedCF[`${selectedRow}:*`] = { ...newRule, sourceRow: selectedRow, sourceCol: selectedCol };
        // Clear any individual cell rules for this row so wildcard takes effect
        for (let c = 0; c < numCols; c++) {
          delete updatedCF[`${selectedRow}:${c}`];
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
  const [codeStyles, setCodeStyles] = useState<CFStyleOverrides | undefined>(existingRule?.codeStyles);

  // Sync state when existingRule changes (e.g., when user selects different cell)
  useEffect(() => {
    setVisualRule(
      existingRule?.visualRule ? JSON.parse(JSON.stringify(existingRule.visualRule)) : { branches: [], defaultResult: '' },
    );
    setCodeValue(existingRule?.compiledExpression || '');
    setCodeStyles(existingRule?.codeStyles);
  }, [existingRule]);

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
      codeStyles={codeStyles}
      onCodeStylesChange={setCodeStyles}
      onSave={() => {
        onSave({
          mode: 'code',
          compiledExpression: codeValue.trim(),
          codeStyles,
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
  // Update a result/style field on a branch (non-clause fields)
  const updateBranch = (idx: number, field: keyof VisualConditionBranch, value: any) => {
    const newBranches = [...rule.branches];
    (newBranches[idx] as any)[field] = value;
    onRuleChange({ ...rule, branches: newBranches });
  };

  // Update a specific condition clause within a branch
  const updateClause = (branchIdx: number, clauseIdx: number, field: keyof ConditionClause, value: any) => {
    const newBranches = [...rule.branches];
    const branch = { ...newBranches[branchIdx] };
    const clauses = getBranchClauses(branch).map((c, i) =>
      i === clauseIdx ? { ...c, [field]: value } : c
    );
    // Sync legacy fields from first clause for backward compat
    branch.conditions = clauses;
    branch.field = clauses[0].field;
    branch.operator = clauses[0].operator;
    branch.value = clauses[0].value;
    branch.valueIsVariable = clauses[0].valueIsVariable;
    branch.valueType = clauses[0].valueType;
    newBranches[branchIdx] = branch;
    onRuleChange({ ...rule, branches: newBranches });
  };

  // Add a new clause to a branch (new clauses default to AND connector)
  const addClause = (branchIdx: number) => {
    const newBranches = [...rule.branches];
    const branch = { ...newBranches[branchIdx] };
    branch.conditions = [
      ...getBranchClauses(branch),
      { field: '', operator: '==' as ConditionOperator, value: '', valueType: 'text' as CFValueType, logic: 'AND' as const },
    ];
    newBranches[branchIdx] = branch;
    onRuleChange({ ...rule, branches: newBranches });
  };

  // Remove a clause from a branch (only when >1 clauses exist)
  const removeClause = (branchIdx: number, clauseIdx: number) => {
    const newBranches = [...rule.branches];
    const branch = { ...newBranches[branchIdx] };
    const clauses = getBranchClauses(branch).filter((_, i) => i !== clauseIdx);
    branch.conditions = clauses;
    if (clauses.length > 0) {
      branch.field = clauses[0].field;
      branch.operator = clauses[0].operator;
      branch.value = clauses[0].value;
      branch.valueIsVariable = clauses[0].valueIsVariable;
      branch.valueType = clauses[0].valueType;
    }
    newBranches[branchIdx] = branch;
    onRuleChange({ ...rule, branches: newBranches });
  };

  const addBranch = () => {
    onRuleChange({
      ...rule,
      branches: [...rule.branches, {
        conditions: [{ field: '', operator: '==' as ConditionOperator, value: '', valueType: 'text' as CFValueType }],
        conditionLogic: 'AND' as const,
        field: '', operator: '==' as ConditionOperator, value: '', result: '',
        valueType: 'text' as CFValueType, resultType: 'text' as CFValueType,
      }],
    });
  };

  const removeBranch = (idx: number) => {
    onRuleChange({ ...rule, branches: rule.branches.filter((_, i) => i !== idx) });
  };

  const preview = compileVisualRulesToExpression(rule);

  const filterOption = (inputValue: string, option?: { value: string; label: string }) =>
    (option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase());

  return (
    <div>
      {rule.branches.map((branch, branchIdx) => {
        const clauses = getBranchClauses(branch);
        const rType = resolveValueType(branch.result, branch.resultIsVariable, branch.resultType);
        return (
          <div key={branchIdx} style={{ marginBottom: 10, padding: 10, backgroundColor: '#f0f7ff', borderRadius: 6, border: '1px solid #d6e4ff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {/* Branch header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1890ff' }}>
                {branchIdx === 0 ? 'IF' : `ELSE IF #${branchIdx + 1}`}
              </span>
              <Button type="text" danger size="small" onClick={() => removeBranch(branchIdx)} icon={<DeleteOutlined />} />
            </div>

            {/* Condition clauses */}
            {clauses.map((clause, clauseIdx) => {
              const vType = resolveValueType(clause.value, clause.valueIsVariable, clause.valueType);
              return (
                <div key={clauseIdx}>
                  {/* AND / OR connector — per-clause, each can be independently AND or OR */}
                  {clauseIdx > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '3px 0' }}>
                      <Select
                        size="small"
                        value={clause.logic ?? 'AND'}
                        onChange={(val) => updateClause(branchIdx, clauseIdx, 'logic', val as 'AND' | 'OR')}
                        options={[{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }]}
                        style={{ width: 68 }}
                      />
                    </div>
                  )}
                  {/* Clause row */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    <AutoComplete
                      options={autocompleteOptions}
                      filterOption={filterOption}
                      value={clause.field}
                      onSelect={(val) => updateClause(branchIdx, clauseIdx, 'field', val)}
                      onChange={(val) => updateClause(branchIdx, clauseIdx, 'field', val)}
                      placeholder="field"
                      style={{ width: 100, fontSize: 11 }}
                      size="small"
                    />
                    <Select
                      size="small"
                      value={clause.operator}
                      onChange={(val) => updateClause(branchIdx, clauseIdx, 'operator', val as ConditionOperator)}
                      style={{ width: 100, fontSize: 11 }}
                      options={OPERATORS}
                    />
                    {!['isEmpty', 'isNotEmpty'].includes(clause.operator) && (
                      <>
                        <TypeSelector
                          value={vType}
                          onChange={(t) => {
                            updateClause(branchIdx, clauseIdx, 'valueType', t);
                            updateClause(branchIdx, clauseIdx, 'valueIsVariable', t === 'variable' || t === 'field');
                          }}
                        />
                        <ValueInput
                          value={clause.value}
                          valueType={vType}
                          onChange={(val) => {
                            updateClause(branchIdx, clauseIdx, 'value', val);
                            updateClause(branchIdx, clauseIdx, 'valueIsVariable', vType === 'variable' || vType === 'field');
                          }}
                          autocompleteOptions={autocompleteOptions}
                          filterOption={filterOption}
                          placeholder="value"
                        />
                      </>
                    )}
                    {/* Remove clause button (only shown when >1 clauses) */}
                    {clauses.length > 1 && (
                      <Button
                        type="text" danger size="small"
                        onClick={() => removeClause(branchIdx, clauseIdx)}
                        icon={<DeleteOutlined />}
                        title="Remove condition"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add another condition */}
            <Button
              size="small" type="dashed"
              onClick={() => addClause(branchIdx)}
              style={{ marginBottom: 8, fontSize: 10 }}
            >
              + AND/OR Condition
            </Button>

            {/* Result row */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: '#666', fontWeight: 600 }}>THEN</span>
              <TypeSelector
                value={rType}
                onChange={(t) => {
                  updateBranch(branchIdx, 'resultType', t);
                  updateBranch(branchIdx, 'resultIsVariable', t === 'variable' || t === 'field');
                }}
              />
              <ValueInput
                value={branch.result}
                valueType={rType}
                onChange={(val) => {
                  updateBranch(branchIdx, 'result', val);
                  updateBranch(branchIdx, 'resultIsVariable', rType === 'variable' || rType === 'field');
                }}
                autocompleteOptions={autocompleteOptions}
                filterOption={filterOption}
                placeholder="result"
              />
            </div>
            <BranchStylePicker
              styles={branch.styles}
              prefix={branch.prefix}
              suffix={branch.suffix}
              onChange={(s) => updateBranch(branchIdx, 'styles', s)}
              onPrefixChange={(v) => updateBranch(branchIdx, 'prefix', v)}
              onSuffixChange={(v) => updateBranch(branchIdx, 'suffix', v)}
            />
          </div>
        );
      })}

      <Button size="small" style={{ marginBottom: 8 }} onClick={addBranch}>
        + Add Rule
      </Button>

      <div style={{ marginBottom: 10, padding: 10, backgroundColor: '#f5f5f5', borderRadius: 6, border: '1px solid #e8e8e8', fontSize: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#666' }}>ELSE:</span>
          <TypeSelector
            value={resolveValueType(rule.defaultResult, rule.defaultResultIsVariable, rule.defaultResultType)}
            onChange={(t) => {
              onRuleChange({
                ...rule,
                defaultResultType: t,
                defaultResultIsVariable: t === 'variable' || t === 'field',
              });
            }}
          />
          <ValueInput
            value={rule.defaultResult}
            valueType={resolveValueType(rule.defaultResult, rule.defaultResultIsVariable, rule.defaultResultType)}
            onChange={(val) => {
              const dType = resolveValueType(val, rule.defaultResultIsVariable, rule.defaultResultType);
              onRuleChange({
                ...rule,
                defaultResult: val,
                defaultResultIsVariable: dType === 'variable' || dType === 'field',
              });
            }}
            autocompleteOptions={autocompleteOptions}
            filterOption={filterOption}
            placeholder="default result"
          />
        </div>
        <BranchStylePicker
          styles={rule.defaultStyles}
          prefix={rule.defaultPrefix}
          suffix={rule.defaultSuffix}
          onChange={(s) => onRuleChange({ ...rule, defaultStyles: s })}
          onPrefixChange={(v) => onRuleChange({ ...rule, defaultPrefix: v })}
          onSuffixChange={(v) => onRuleChange({ ...rule, defaultSuffix: v })}
        />
      </div>

      <div style={{ marginBottom: 10, padding: 8, backgroundColor: '#fafafa', borderRadius: 4, border: '1px solid #e8e8e8' }}>
        <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>Compiled Expression:</div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#333', wordBreak: 'break-all' }}>
          {preview}
        </div>
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
  codeStyles?: CFStyleOverrides;
  onCodeStylesChange: (styles: CFStyleOverrides | undefined) => void;
  onSave: () => void;
  onClear: () => void;
}

const CodeRuleEditor: React.FC<CodeRuleEditorProps> = ({ value, onChange, codeStyles, onCodeStylesChange, onSave, onClear }) => {
  const [showStyles, setShowStyles] = useState(false);
  const hasStyles = codeStyles && Object.keys(codeStyles).length > 0;

  const updateStyle = (key: keyof CFStyleOverrides, val: any) => {
    const updated = { ...(codeStyles || {}) };
    if (val === undefined || val === '' || val === null || val === false) {
      delete (updated as any)[key];
    } else {
      (updated as any)[key] = val;
    }
    onCodeStylesChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

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
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setShowStyles(!showStyles)}
          style={{
            fontSize: 10, padding: '2px 8px', cursor: 'pointer',
            border: hasStyles ? '1px solid #1890ff' : '1px solid #d9d9d9',
            backgroundColor: hasStyles ? '#e6f7ff' : '#fff',
            borderRadius: 3,
          }}
        >
          Style Overrides {hasStyles ? '●' : ''}
        </button>
        {showStyles && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 6, marginTop: 4, backgroundColor: '#f9f9f9', borderRadius: 3, fontSize: 10, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              Font: <input type="color" value={codeStyles?.fontColor || '#000000'} onChange={(e) => updateStyle('fontColor', e.target.value)} style={{ width: 24, height: 18, border: 'none', cursor: 'pointer' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              BG: <input type="color" value={codeStyles?.backgroundColor || '#ffffff'} onChange={(e) => updateStyle('backgroundColor', e.target.value)} style={{ width: 24, height: 18, border: 'none', cursor: 'pointer' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              Size: <input type="number" value={codeStyles?.fontSize ?? ''} onChange={(e) => updateStyle('fontSize', e.target.value ? Number(e.target.value) : undefined)} style={{ width: 40, fontSize: 10, height: 20 }} min={1} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              Align:
              <select value={codeStyles?.alignment || ''} onChange={(e) => updateStyle('alignment', e.target.value || undefined)} style={{ fontSize: 10, height: 20 }}>
                <option value="">default</option>
                <option value="left">left</option>
                <option value="center">center</option>
                <option value="right">right</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input type="checkbox" checked={!!codeStyles?.strikethrough} onChange={(e) => updateStyle('strikethrough', e.target.checked || undefined)} />
              <span style={{ textDecoration: 'line-through' }}>S</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input type="checkbox" checked={!!codeStyles?.underline} onChange={(e) => updateStyle('underline', e.target.checked || undefined)} />
              <span style={{ textDecoration: 'underline' }}>U</span>
            </label>
          </div>
        )}
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
