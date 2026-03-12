/**
 * Settings widgets: headerVisibilityWidget, constraintsWidget, overflowWidget.
 */

import type { PropPanelWidgetProps } from '@pdfme/common';
import type { TableExportData } from '../../engine/index.js';
import { showToast } from '../toast.js';
import { commitTable } from '../../instanceManager.js';
import type { WidgetSchema } from '../domUtils.js';
import {
  parseContent,
  getTableAndCommit,
  createRow,
  createNumberInput,
  createCheckbox,
  createSelect,
  createLabel,
} from '../domUtils.js';

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
