/**
 * Style widgets: tableStyleWidget, regionStyleSelectWidget, cellStyleWidget.
 */

import type { PropPanelWidgetProps } from '@pdfme/common';
import type { WidgetSchema } from '../domUtils.js';
import {
  parseContent,
  getTableAndCommit,
  createLabel,
  createRow,
  createColorInput,
  createNumberInput,
  createSelect,
} from '../domUtils.js';
import { renderRegionStyleControls } from '../regionStyleControls.js';
import { renderCellStyleControls } from '../cellStyleControls.js';

// Track selected region per schema for the unified region style widget
const selectedRegionMap = new Map<string, string>();

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
 * Unified region style widget with a region selector dropdown.
 * Shows region style controls normally, or cell style controls when "Cell" is selected.
 * Selecting "Cell" activates styling mode (purple highlights, click-to-select).
 */
export function regionStyleSelectWidget(props: PropPanelWidgetProps): void {
  const schema = props.activeSchema as WidgetSchema;
  const schemaId = schema.id;
  const parsed = parseContent(schema);
  const vis = parsed.settings?.headerVisibility ?? { theader: true, lheader: false, rheader: false };
  const hasFooter = !!parsed.settings?.footer;

  // Build list of active regions + "Cell" option
  const regions: { label: string; value: string }[] = [];
  if (vis.theader !== false) regions.push({ label: 'Top Header', value: 'theader' });
  if (vis.lheader) regions.push({ label: 'Left Header', value: 'lheader' });
  if (vis.rheader) regions.push({ label: 'Right Header', value: 'rheader' });
  regions.push({ label: 'Body', value: 'body' });
  if (hasFooter) regions.push({ label: 'Footer', value: 'footer' });
  regions.push({ label: '── Cell ──', value: '_cell' });

  // If we're in styling mode, force to _cell
  const getTC = () => getTableAndCommit(props);
  const { table } = getTC();
  const currentMode = table.getUIState().mergeMode;
  let selectedRegion = currentMode === 'styling'
    ? '_cell'
    : (selectedRegionMap.get(schemaId) ?? 'body');
  if (selectedRegion !== '_cell' && !regions.some(r => r.value === selectedRegion)) {
    selectedRegion = regions[0].value;
  }

  const { rootElement } = props;
  rootElement.style.width = '100%';

  // Container for style controls
  const controlsContainer = document.createElement('div');

  const refreshCellControls = () => {
    controlsContainer.innerHTML = '';
    renderCellStyleControls(props, controlsContainer);
  };

  const switchTo = (v: string) => {
    selectedRegionMap.set(schemaId, v);
    const { table: t } = getTC();
    if (v === '_cell') {
      t.setMergeMode('styling');
      t.onSelectionChange(refreshCellControls);
    } else {
      if (t.getUIState().mergeMode === 'styling') {
        t.setMergeMode('none');
      }
      t.onSelectionChange(undefined);
    }
    // Re-render the canvas so the banner/highlights match the new mode
    t.triggerRender();
    controlsContainer.innerHTML = '';
    if (v === '_cell') {
      renderCellStyleControls(props, controlsContainer);
    } else {
      renderRegionStyleControls(props, v, controlsContainer);
    }
  };

  // Region selector
  rootElement.appendChild(createLabel('Region'));
  const regionSelect = createSelect(regions, selectedRegion, switchTo);
  rootElement.appendChild(regionSelect);

  rootElement.appendChild(controlsContainer);
  if (selectedRegion === '_cell') {
    table.onSelectionChange(refreshCellControls);
    renderCellStyleControls(props, controlsContainer);
  } else {
    renderRegionStyleControls(props, selectedRegion, controlsContainer);
  }
}

/**
 * Standalone cell style widget — delegates to renderCellStyleControls.
 * Kept for potential standalone use; the primary entry point is now
 * the "Cell" option in regionStyleSelectWidget.
 */
export function cellStyleWidget(props: PropPanelWidgetProps): void {
  const { rootElement } = props;
  rootElement.style.width = '100%';
  renderCellStyleControls(props, rootElement);
}
