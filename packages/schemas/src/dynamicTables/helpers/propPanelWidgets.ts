/**
 * Custom propPanel widget functions for the dynamic table plugin.
 *
 * Each widget:
 * 1. Gets Table from cache
 * 2. Reads current values from parsed data
 * 3. Renders DOM inputs into rootElement
 * 4. On change: table.method() → commitTable() → changeSchemas()
 */

import type { PropPanelWidgetProps, SchemaForUI } from '@pdfme/common';
import { getFallbackFontName, DEFAULT_FONT_NAME } from '@pdfme/common';
import type { DynamicTableSchema } from '../types.js';
import type { TableExportData } from '../engine/index.js';
import { getTable, commitTable } from '../instanceManager.js';
import { showToast } from './toast.js';

type WidgetSchema = SchemaForUI & DynamicTableSchema;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseContent(schema: WidgetSchema): TableExportData {
  return JSON.parse(schema.content || '{}') as TableExportData;
}

/** Get the cached Table for the active schema and return a commit function */
function getTableAndCommit(props: PropPanelWidgetProps) {
  const schema = props.activeSchema as WidgetSchema;
  const table = getTable(schema.name, schema.content || '{}');
  const commit = () => {
    const json = commitTable(schema.name, table);
    props.changeSchemas([{ key: 'content', value: json, schemaId: schema.id }]);
  };
  return { table, commit, schema };
}

function createLabel(text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.textContent = text;
  Object.assign(label.style, {
    display: 'block',
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
    marginTop: '8px',
  });
  return label;
}

function createRow(): HTMLDivElement {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '4px',
  });
  return row;
}

function createNumberInput(value: number, min: number, step: number, onChange: (v: number) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.min = String(min);
  input.step = String(step);
  Object.assign(input.style, {
    width: '60px',
    padding: '4px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  });
  input.addEventListener('change', () => onChange(Number(input.value)));
  return input;
}

function createColorInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value || '#000000';
  Object.assign(input.style, { width: '32px', height: '24px', cursor: 'pointer', border: 'none' });
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function createCheckbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLDivElement {
  const wrapper = createRow();
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.fontSize = '12px';
  wrapper.appendChild(input);
  wrapper.appendChild(lbl);
  return wrapper;
}

function createSelect(options: { label: string; value: string }[], currentValue: string, onChange: (v: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  Object.assign(select.style, {
    padding: '4px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    flex: '1',
  });
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === currentValue) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

/**
 * Header visibility: 3 checkboxes for theader, lheader, rheader.
 */
export function headerVisibilityWidget(props: PropPanelWidgetProps): void {
  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const vis = parsed.settings?.headerVisibility ?? { theader: true, lheader: false, rheader: false };

  const { rootElement } = props;
  rootElement.style.width = '100%';

  const toggle = (key: 'theader' | 'lheader' | 'rheader', value: boolean) => {
    const { table, commit } = getTableAndCommit(props);
    const current = table.getSettings().headerVisibility ?? { theader: true, lheader: false, rheader: false };
    table.updateSettings({ headerVisibility: { ...current, [key]: value } });
    commit();
  };

  rootElement.appendChild(createCheckbox('Top Header', vis.theader !== false, (v) => toggle('theader', v)));
  rootElement.appendChild(createCheckbox('Left Header', vis.lheader === true, (v) => toggle('lheader', v)));
  rootElement.appendChild(createCheckbox('Right Header', vis.rheader === true, (v) => toggle('rheader', v)));
}

/**
 * Constraints: minRows, maxRows, minCols, maxCols.
 */
export function constraintsWidget(props: PropPanelWidgetProps): void {
  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const settings = parsed.settings ?? {};

  const { rootElement } = props;
  rootElement.style.width = '100%';

  // Current body dimensions for initial values
  const bodyRowCount = parsed.body?.length ?? 0;
  const bodyColCount = parsed.body?.[0]?.length ?? 0;

  // Track inputs + checkboxes for cross-syncing
  const fields: Record<string, { input: HTMLInputElement; checkbox: HTMLInputElement }> = {};

  // Only sync enabled (checked) inputs within the same group as the changed key
  const ROW_KEYS = ['minRows', 'maxRows'];
  const COL_KEYS = ['minCols', 'maxCols'];

  const syncGroup = (key: string, s: Partial<TableExportData['settings']>) => {
    const group = ROW_KEYS.includes(key) ? ROW_KEYS : COL_KEYS;
    for (const k of group) {
      const f = fields[k];
      if (!f) continue;
      const val = s?.[k as keyof typeof s] as number | undefined;
      if (val !== undefined) {
        f.input.value = String(val);
      } else if (f.checkbox.checked) {
        // Engine cleared it (e.g. validation rejected) — revert checkbox
        f.input.value = String(val ?? 0);
      }
      // Leave disabled inputs untouched
    }
  };

  const applyUpdate = (key: string, value: number | undefined) => {
    const { table, commit } = getTableAndCommit(props);
    const error = table.updateSettings({ [key]: value });
    const json = commitTable(schema.name, table);
    const updatedSettings = (JSON.parse(json) as TableExportData).settings ?? {};

    if (error) {
      showToast(error);
      // Revert only the changed input to its pre-error value
      const f = fields[key];
      if (f) {
        const current = updatedSettings[key as keyof typeof updatedSettings] as number | undefined;
        f.input.value = String(current ?? Number(f.input.value));
      }
      return;
    }

    props.changeSchemas([{ key: 'content', value: json, schemaId: schema.id }]);
    syncGroup(key, updatedSettings);
  };

  const addConstraintRow = (
    label: string,
    key: string,
    currentValue: number | undefined,
    defaultValue: number,
  ) => {
    const isDefined = currentValue !== undefined;

    const row = createRow();

    // Checkbox to enable/disable
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isDefined;
    row.appendChild(checkbox);

    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.fontSize = '12px';
    lbl.style.width = '62px';
    row.appendChild(lbl);

    // Number input
    const numInput = createNumberInput(currentValue ?? defaultValue, 0, 1, (v) => {
      if (checkbox.checked) applyUpdate(key, v);
    });
    numInput.disabled = !isDefined;
    if (!isDefined) numInput.style.opacity = '0.4';
    fields[key] = { input: numInput, checkbox };
    row.appendChild(numInput);

    // Checkbox toggle
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        numInput.disabled = false;
        numInput.style.opacity = '1';
        applyUpdate(key, Number(numInput.value));
      } else {
        numInput.disabled = true;
        numInput.style.opacity = '0.4';
        applyUpdate(key, undefined);
      }
    });

    rootElement.appendChild(row);
  };

  addConstraintRow('Min Rows', 'minRows', settings.minRows, bodyRowCount);
  addConstraintRow('Max Rows', 'maxRows', settings.maxRows,
    settings.minRows ?? bodyRowCount);
  addConstraintRow('Min Cols', 'minCols', settings.minCols, bodyColCount);
  addConstraintRow('Max Cols', 'maxCols', settings.maxCols,
    settings.minCols ?? bodyColCount);
}

/**
 * Overflow mode selector.
 */
export function overflowWidget(props: PropPanelWidgetProps): void {
  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const current = parsed.settings?.overflow ?? 'wrap';

  const { rootElement } = props;
  rootElement.style.width = '100%';

  rootElement.appendChild(createLabel('Overflow'));
  rootElement.appendChild(createSelect(
    [
      { label: 'Wrap', value: 'wrap' },
      { label: 'Increase Height', value: 'increase-height' },
      { label: 'Increase Width', value: 'increase-width' },
    ],
    current,
    (v) => {
      const { table, commit } = getTableAndCommit(props);
      table.updateSettings({ overflow: v as any });
      commit();
    },
  ));
}

/**
 * Table style: border color, border width.
 */
export function tableStyleWidget(props: PropPanelWidgetProps): void {
  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const style = parsed.tableStyle ?? {};

  const { rootElement } = props;
  rootElement.style.width = '100%';

  const update = (patch: Record<string, unknown>) => {
    const { table, commit } = getTableAndCommit(props);
    table.setTableStyle(patch as any);
    commit();
  };

  // Border color
  const colorRow = createRow();
  const colorLabel = document.createElement('span');
  colorLabel.textContent = 'Border Color';
  colorLabel.style.fontSize = '12px';
  colorRow.appendChild(colorLabel);
  colorRow.appendChild(createColorInput(style.borderColor ?? '#000000', (v) => update({ borderColor: v })));
  rootElement.appendChild(colorRow);

  // Border width
  const widthRow = createRow();
  const widthLabel = document.createElement('span');
  widthLabel.textContent = 'Border Width';
  widthLabel.style.fontSize = '12px';
  widthRow.appendChild(widthLabel);
  const bw = style.borderWidth?.top ?? 0.1;
  widthRow.appendChild(createNumberInput(bw, 0, 0.1, (v) => {
    update({ borderWidth: { top: v, right: v, bottom: v, left: v } });
  }));
  rootElement.appendChild(widthRow);
}

/**
 * Region style widget for theader.
 * Full cell style controls: font, size, colors, alignment, borders, padding.
 */
export function regionStyleWidget(props: PropPanelWidgetProps): void {
  renderRegionStyleControls(props, 'theader');
}

/**
 * Body style widget: same as region style + alternateBackgroundColor.
 */
export function bodyStyleWidget(props: PropPanelWidgetProps): void {
  renderRegionStyleControls(props, 'body');
}

// ---------------------------------------------------------------------------
// Shared region style renderer
// ---------------------------------------------------------------------------

function renderRegionStyleControls(props: PropPanelWidgetProps, region: string): void {
  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const regionStyles = parsed.regionStyles ?? {};
  const style = (regionStyles as Record<string, any>)[region] ?? {};

  const font = props.options.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
  const fontNames = Object.keys(font);
  const fallbackFontName = getFallbackFontName(font);

  const { rootElement } = props;
  rootElement.style.width = '100%';

  const update = (patch: Record<string, unknown>) => {
    const { table, commit } = getTableAndCommit(props);
    const current = table.getRegionStyle(region as any) ?? {};
    table.setRegionStyle(region as any, { ...current, ...patch } as any);
    commit();
  };

  // Font name
  rootElement.appendChild(createLabel('Font'));
  rootElement.appendChild(createSelect(
    fontNames.map((n) => ({ label: n, value: n })),
    style.fontName ?? fallbackFontName,
    (v) => update({ fontName: v }),
  ));

  // Font size + line height
  const sizeRow = createRow();
  const sizeLabel = document.createElement('span');
  sizeLabel.textContent = 'Size';
  sizeLabel.style.fontSize = '12px';
  sizeRow.appendChild(sizeLabel);
  sizeRow.appendChild(createNumberInput(style.fontSize ?? 13, 1, 1, (v) => update({ fontSize: v })));
  const lhLabel = document.createElement('span');
  lhLabel.textContent = 'LH';
  lhLabel.style.fontSize = '12px';
  sizeRow.appendChild(lhLabel);
  sizeRow.appendChild(createNumberInput(style.lineHeight ?? 1, 0, 0.1, (v) => update({ lineHeight: v })));
  rootElement.appendChild(sizeRow);

  // Alignment
  const alignRow = createRow();
  const alignLabel = document.createElement('span');
  alignLabel.textContent = 'Align';
  alignLabel.style.fontSize = '12px';
  alignRow.appendChild(alignLabel);
  alignRow.appendChild(createSelect(
    [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }],
    style.alignment ?? 'left',
    (v) => update({ alignment: v }),
  ));
  alignRow.appendChild(createSelect(
    [{ label: 'Top', value: 'top' }, { label: 'Middle', value: 'middle' }, { label: 'Bottom', value: 'bottom' }],
    style.verticalAlignment ?? 'middle',
    (v) => update({ verticalAlignment: v }),
  ));
  rootElement.appendChild(alignRow);

  // Colors
  const colorRow = createRow();
  const fcLabel = document.createElement('span');
  fcLabel.textContent = 'Font';
  fcLabel.style.fontSize = '12px';
  colorRow.appendChild(fcLabel);
  colorRow.appendChild(createColorInput(style.fontColor ?? '#000000', (v) => update({ fontColor: v })));
  const bgLabel = document.createElement('span');
  bgLabel.textContent = 'BG';
  bgLabel.style.fontSize = '12px';
  colorRow.appendChild(bgLabel);
  colorRow.appendChild(createColorInput(style.backgroundColor ?? '#ffffff', (v) => update({ backgroundColor: v })));
  rootElement.appendChild(colorRow);

  // Border color + width
  const borderRow = createRow();
  const bcLabel = document.createElement('span');
  bcLabel.textContent = 'Border';
  bcLabel.style.fontSize = '12px';
  borderRow.appendChild(bcLabel);
  borderRow.appendChild(createColorInput(style.borderColor ?? '#888888', (v) => update({ borderColor: v })));
  const bwVal = style.borderWidth?.top ?? 0.1;
  borderRow.appendChild(createNumberInput(bwVal, 0, 0.1, (v) => {
    update({ borderWidth: { top: v, right: v, bottom: v, left: v } });
  }));
  rootElement.appendChild(borderRow);

  // Padding
  rootElement.appendChild(createLabel('Padding'));
  const padRow = createRow();
  const padTop = style.padding?.top ?? 5;
  const padLabels = ['T', 'R', 'B', 'L'];
  const padKeys = ['top', 'right', 'bottom', 'left'] as const;
  const padValues = [style.padding?.top ?? 5, style.padding?.right ?? 5, style.padding?.bottom ?? 5, style.padding?.left ?? 5];
  for (let i = 0; i < 4; i++) {
    const l = document.createElement('span');
    l.textContent = padLabels[i];
    l.style.fontSize = '11px';
    padRow.appendChild(l);
    const key = padKeys[i];
    padRow.appendChild(createNumberInput(padValues[i], 0, 1, (v) => {
      const current = style.padding ?? { top: 5, right: 5, bottom: 5, left: 5 };
      update({ padding: { ...current, [key]: v } });
    }));
  }
  rootElement.appendChild(padRow);

  // Alternate background color (body only)
  if (region === 'body') {
    const altRow = createRow();
    const altLabel = document.createElement('span');
    altLabel.textContent = 'Alt BG';
    altLabel.style.fontSize = '12px';
    altRow.appendChild(altLabel);
    altRow.appendChild(createColorInput(style.alternateBackgroundColor ?? '#f5f5f5', (v) => update({ alternateBackgroundColor: v })));
    rootElement.appendChild(altRow);
  }
}
