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
import type { TableExportData, SerializedHeaderNode, Region } from '../engine/index.js';
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

// ---------------------------------------------------------------------------
// Small icon-button helper
// ---------------------------------------------------------------------------

function createSmallButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.title = title;
  Object.assign(btn.style, {
    width: '20px',
    height: '20px',
    padding: '0',
    border: '1px solid #ccc',
    borderRadius: '3px',
    background: '#fafafa',
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: '18px',
    textAlign: 'center',
    flexShrink: '0',
  });
  btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return btn;
}

// ---------------------------------------------------------------------------
// Structure widget — tree view of all regions
// ---------------------------------------------------------------------------

/**
 * Shows a tree structure for the table:
 * - Top Header (theader) with sub-headers
 * - Left Header / Right Header (toggle + add/remove)
 * - Body row/col count with +/-
 * - Footer (toggle)
 * - Merge / Unmerge controls
 */
export function structureWidget(props: PropPanelWidgetProps): void {
  const { rootElement } = props;
  rootElement.style.width = '100%';

  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const vis = parsed.settings?.headerVisibility ?? { theader: true, lheader: false, rheader: false };
  const hasFooter = !!parsed.settings?.footer;
  const bodyRows = parsed.body?.length ?? 0;
  const bodyCols = parsed.body?.[0]?.length ?? 0;

  const getTC = () => getTableAndCommit(props);

  // --- Top Header (theader) ---
  const theaderNodes = parsed.headerTrees?.theader ?? [];
  renderRegionSection(rootElement, 'Top Header', vis.theader !== false, (val) => {
    const { table, commit } = getTC();
    if (val && theaderNodes.length === 0) table.addHeaderCell('theader' as Region);
    table.updateSettings({ headerVisibility: { ...vis, theader: val } });
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, theaderNodes, 'theader' as Region, getTC);
    // Add column button
    const addBtn = createSmallButton('+', 'Add column', () => {
      const { table, commit } = getTC();
      table.addHeaderCell('theader' as Region);
      commit();
    });
    addBtn.style.marginTop = '4px';
    container.appendChild(addBtn);
    return container;
  });

  // --- Left Header ---
  const lheaderNodes = parsed.headerTrees?.lheader ?? [];
  renderRegionSection(rootElement, 'Left Header', vis.lheader === true, (val) => {
    const { table, commit } = getTC();
    if (val && lheaderNodes.length === 0) table.addHeaderCell('lheader' as Region);
    table.updateSettings({ headerVisibility: { ...vis, lheader: val } });
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, lheaderNodes, 'lheader' as Region, getTC);
    const addBtn = createSmallButton('+', 'Add row', () => {
      const { table, commit } = getTC();
      table.addHeaderCell('lheader' as Region);
      commit();
    });
    addBtn.style.marginTop = '4px';
    container.appendChild(addBtn);
    return container;
  });

  // --- Right Header ---
  const rheaderNodes = parsed.headerTrees?.rheader ?? [];
  renderRegionSection(rootElement, 'Right Header', vis.rheader === true, (val) => {
    const { table, commit } = getTC();
    if (val && rheaderNodes.length === 0) table.addHeaderCell('rheader' as Region);
    table.updateSettings({ headerVisibility: { ...vis, rheader: val } });
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, rheaderNodes, 'rheader' as Region, getTC);
    const addBtn = createSmallButton('+', 'Add row', () => {
      const { table, commit } = getTC();
      table.addHeaderCell('rheader' as Region);
      commit();
    });
    addBtn.style.marginTop = '4px';
    container.appendChild(addBtn);
    return container;
  });

  // --- Body ---
  const bodySection = document.createElement('div');
  Object.assign(bodySection.style, { marginTop: '8px', padding: '6px', background: '#f9f9f9', borderRadius: '4px' });

  const bodyTitle = document.createElement('div');
  Object.assign(bodyTitle.style, { fontSize: '12px', fontWeight: '600', marginBottom: '4px' });
  bodyTitle.textContent = 'Body';
  bodySection.appendChild(bodyTitle);

  // Row controls
  const rowRow = createRow();
  const rowLabel = document.createElement('span');
  rowLabel.textContent = `Rows: ${bodyRows}`;
  rowLabel.style.fontSize = '12px';
  rowLabel.style.minWidth = '60px';
  rowRow.appendChild(rowLabel);
  rowRow.appendChild(createSmallButton('+', 'Add row', () => {
    const { table, commit } = getTC();
    const status = table.insertBodyRow(table.getRowHeights().length);
    if (status === 'max-reached') showToast('Maximum rows reached');
    commit();
  }));
  rowRow.appendChild(createSmallButton('−', 'Remove last row', () => {
    const { table, commit } = getTC();
    if (bodyRows <= 1) { showToast('Cannot remove the last row'); return; }
    const status = table.removeBodyRow(bodyRows - 1);
    if (status === 'cleared') showToast('Minimum rows — row cleared');
    commit();
  }));
  bodySection.appendChild(rowRow);

  // Column controls
  const colRow = createRow();
  const colLabel = document.createElement('span');
  colLabel.textContent = `Cols: ${bodyCols}`;
  colLabel.style.fontSize = '12px';
  colLabel.style.minWidth = '60px';
  colRow.appendChild(colLabel);
  colRow.appendChild(createSmallButton('+', 'Add column', () => {
    const { table, commit } = getTC();
    table.addHeaderCell('theader' as Region);
    commit();
  }));
  colRow.appendChild(createSmallButton('−', 'Remove last column', () => {
    const { table, commit } = getTC();
    if (bodyCols <= 1) { showToast('Cannot remove the last column'); return; }
    const status = table.removeBodyCol(bodyCols - 1);
    if (status === 'cleared') showToast('Minimum cols — column cleared');
    commit();
  }));
  bodySection.appendChild(colRow);

  rootElement.appendChild(bodySection);

  // --- Footer ---
  const footerNodes = parsed.headerTrees?.footer ?? [];
  renderRegionSection(rootElement, 'Footer', hasFooter, (val) => {
    const { table, commit } = getTC();
    if (val) {
      if (footerNodes.length === 0) table.addHeaderCell('footer' as Region);
      table.updateSettings({ footer: { mode: 'every-page' } });
    } else {
      table.updateSettings({ footer: undefined });
    }
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, footerNodes, 'footer' as Region, getTC);
    const addBtn = createSmallButton('+', 'Add footer cell', () => {
      const { table, commit } = getTC();
      table.addHeaderCell('footer' as Region);
      commit();
    });
    addBtn.style.marginTop = '4px';
    container.appendChild(addBtn);
    return container;
  });

  // --- Merge / Unmerge ---
  const mergeCount = parsed.merges?.length ?? 0;
  if (mergeCount > 0) {
    const mergeSection = document.createElement('div');
    Object.assign(mergeSection.style, { marginTop: '8px', padding: '6px', background: '#f9f9f9', borderRadius: '4px' });
    const mergeTitle = document.createElement('div');
    Object.assign(mergeTitle.style, { fontSize: '12px', fontWeight: '600', marginBottom: '4px' });
    mergeTitle.textContent = `Merged Regions (${mergeCount})`;
    mergeSection.appendChild(mergeTitle);

    for (const merge of parsed.merges ?? []) {
      const mRow = createRow();
      const mLabel = document.createElement('span');
      mLabel.style.fontSize = '11px';
      mLabel.textContent = `${merge.primaryRegion} [${merge.startRow},${merge.startCol}]→[${merge.endRow},${merge.endCol}]`;
      mRow.appendChild(mLabel);
      mRow.appendChild(createSmallButton('×', 'Unmerge', () => {
        const { table, commit } = getTC();
        table.unmergeCells(merge.cellId);
        commit();
      }));
      mergeSection.appendChild(mRow);
    }
    rootElement.appendChild(mergeSection);
  }
}

// ---------------------------------------------------------------------------
// Helpers for structureWidget
// ---------------------------------------------------------------------------

function renderRegionSection(
  parent: HTMLElement,
  label: string,
  enabled: boolean,
  onToggle: (val: boolean) => void,
  renderContent?: () => HTMLElement,
): void {
  const section = document.createElement('div');
  Object.assign(section.style, { marginTop: '6px', padding: '6px', background: '#f9f9f9', borderRadius: '4px' });

  const header = createRow();
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = enabled;
  checkbox.addEventListener('change', () => onToggle(checkbox.checked));
  header.appendChild(checkbox);

  const title = document.createElement('span');
  title.textContent = label;
  Object.assign(title.style, { fontSize: '12px', fontWeight: '600' });
  header.appendChild(title);
  section.appendChild(header);

  if (enabled && renderContent) {
    section.appendChild(renderContent());
  }

  parent.appendChild(section);
}

function renderHeaderTree(
  container: HTMLElement,
  nodes: SerializedHeaderNode[],
  region: Region,
  getTC: () => ReturnType<typeof getTableAndCommit>,
  parentId?: string,
  depth: number = 0,
): void {
  for (const node of nodes) {
    const nodeRow = document.createElement('div');
    Object.assign(nodeRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 0',
      paddingLeft: `${depth * 14}px`,
    });

    // Expand indicator for nodes with children
    const indicator = document.createElement('span');
    indicator.style.fontSize = '10px';
    indicator.style.width = '10px';
    indicator.textContent = node.children.length > 0 ? '▼' : '•';
    nodeRow.appendChild(indicator);

    // Label
    const label = document.createElement('span');
    label.style.fontSize = '12px';
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    label.textContent = String(node.rawValue || node.cellId.slice(0, 6));
    nodeRow.appendChild(label);

    // Add child button for all header regions (theader, lheader, rheader, footer)
    if (region !== 'body') {
      nodeRow.appendChild(createSmallButton('+', 'Add child', () => {
        const { table, commit } = getTC();
        table.addHeaderCell(region, node.cellId);
        commit();
      }));
    }

    // Remove button
    nodeRow.appendChild(createSmallButton('×', 'Remove', () => {
      const { table, commit } = getTC();
      table.removeHeaderCell(node.cellId, region, !parentId, parentId);
      commit();
    }));

    container.appendChild(nodeRow);

    // Recurse children
    if (node.children.length > 0) {
      renderHeaderTree(container, node.children, region, getTC, node.cellId, depth + 1);
    }
  }
}
