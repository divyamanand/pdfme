/**
 * Shared DOM utilities and table helpers for dynamicTable propPanel widgets.
 */

import type { PropPanelWidgetProps, SchemaForUI } from '@pdfme/common';
import type { DynamicTableSchema } from '../types.js';
import type { TableExportData } from '../engine/index.js';
import { getTable, commitTable } from '../instanceManager.js';

export type WidgetSchema = SchemaForUI & DynamicTableSchema;

export function parseContent(schema: WidgetSchema): TableExportData {
  return JSON.parse(schema.content || '{}') as TableExportData;
}

/** Get the cached Table for the active schema and return a commit function */
export function getTableAndCommit(props: PropPanelWidgetProps) {
  const schema = props.activeSchema as WidgetSchema;
  const table = getTable(schema.name, schema.content || '{}');
  const commit = () => {
    const json = commitTable(schema.name, table);
    const snapshot = table.getRenderSnapshot();
    const changes: { key: string; value: unknown; schemaId: string }[] = [
      { key: 'content', value: json, schemaId: schema.id },
    ];
    const newW = snapshot.getWidth();
    const newH = snapshot.getHeight();
    if (Math.abs(schema.width - newW) > 0.01) {
      changes.push({ key: 'width', value: newW, schemaId: schema.id });
    }
    if (Math.abs(schema.height - newH) > 0.01) {
      changes.push({ key: 'height', value: newH, schemaId: schema.id });
    }
    props.changeSchemas(changes);
  };
  return { table, commit, schema };
}

export function createLabel(text: string): HTMLLabelElement {
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

export function createRow(): HTMLDivElement {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '4px',
  });
  return row;
}

export function createNumberInput(value: number, min: number, step: number, onChange: (v: number) => void): HTMLInputElement {
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

export function createColorInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value || '#000000';
  Object.assign(input.style, { width: '32px', height: '24px', cursor: 'pointer', border: 'none' });
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

export function createCheckbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLDivElement {
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

export function createSelect(options: { label: string; value: string }[], currentValue: string, onChange: (v: string) => void): HTMLSelectElement {
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

export function createSmallButton(text: string, title: string, onClick: () => void): HTMLButtonElement {
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
