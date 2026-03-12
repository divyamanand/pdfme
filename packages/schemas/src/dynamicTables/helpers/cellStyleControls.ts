/**
 * Renders per-cell style controls for selected cells.
 * Used when "Cell" is selected in the region style dropdown.
 */

import type { PropPanelWidgetProps } from '@pdfme/common';
import { getFallbackFontName, DEFAULT_FONT_NAME } from '@pdfme/common';
import type { OverflowMode, CellStyle } from '../engine/index.js';
import {
  getTableAndCommit,
  createLabel,
  createRow,
  createNumberInput,
  createColorInput,
  createCheckbox,
  createSelect,
} from './domUtils.js';

export function renderCellStyleControls(props: PropPanelWidgetProps, container: HTMLElement): void {
  const getTC = () => getTableAndCommit(props);
  const { table } = getTC();
  const uiState = table.getUIState();
  const selectedIds = [...uiState.selectedCells];

  if (selectedIds.length === 0) {
    const msg = document.createElement('div');
    Object.assign(msg.style, { fontSize: '12px', color: '#999', padding: '8px 0' });
    msg.textContent = 'Click cells in the table to select them';
    container.appendChild(msg);
    return;
  }

  // For multi-selection, read the first cell's values as representative
  const primaryId = selectedIds[0];
  const primaryCell = table.getCellById(primaryId);
  if (!primaryCell) return;

  const overrides = primaryCell.styleOverrides;
  const cellOverflow = primaryCell.overflow;
  const globalOverflow = table.getSettings().overflow ?? 'wrap';

  const font = props.options.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
  const fontNames = Object.keys(font);
  const fallbackFontName = getFallbackFontName(font);

  // Resolve region style to show inherited values as placeholders
  const snapshot = table.getRenderSnapshot();
  const resolvedCell = snapshot.getCellByID(primaryId);
  const resolved = resolvedCell?.style;

  const updateAll = (patch: Partial<CellStyle>) => {
    const { table: t, commit } = getTC();
    for (const id of selectedIds) {
      t.updateCell(id, { style: patch });
    }
    commit();
  };

  const updateOverflow = (mode: OverflowMode | undefined) => {
    const { table: t, commit } = getTC();
    for (const id of selectedIds) {
      t.updateCell(id, { overflow: mode });
    }
    commit();
  };

  // Title with cell count
  const title = document.createElement('div');
  Object.assign(title.style, { fontSize: '12px', fontWeight: '600', marginBottom: '4px' });
  title.textContent = selectedIds.length === 1
    ? `Cell: ${primaryCell.rawValue}`
    : `${selectedIds.length} cells selected`;
  container.appendChild(title);

  // --- Overflow Mode ---
  container.appendChild(createLabel('Overflow'));
  const overflowOptions = [
    { label: `Inherit (${globalOverflow})`, value: '' },
    { label: 'Wrap', value: 'wrap' },
    { label: 'Increase Height', value: 'increase-height' },
    { label: 'Increase Width', value: 'increase-width' },
  ];
  container.appendChild(createSelect(overflowOptions, cellOverflow ?? '', (v) => {
    updateOverflow(v ? v as OverflowMode : undefined);
  }));

  // --- Font name ---
  container.appendChild(createLabel('Font'));
  container.appendChild(createSelect(
    [{ label: `Inherit`, value: '' }, ...fontNames.map(n => ({ label: n, value: n }))],
    overrides.fontName ?? '',
    (v) => updateAll({ fontName: v || undefined }),
  ));

  // --- Font size + line height ---
  const sizeRow = createRow();
  const sizeLabel = document.createElement('span');
  sizeLabel.textContent = 'Size';
  sizeLabel.style.fontSize = '12px';
  sizeRow.appendChild(sizeLabel);
  sizeRow.appendChild(createNumberInput(overrides.fontSize ?? resolved?.fontSize ?? 13, 1, 1, (v) => updateAll({ fontSize: v })));
  const lhLabel = document.createElement('span');
  lhLabel.textContent = 'LH';
  lhLabel.style.fontSize = '12px';
  sizeRow.appendChild(lhLabel);
  sizeRow.appendChild(createNumberInput(overrides.lineHeight ?? resolved?.lineHeight ?? 1, 0, 0.1, (v) => updateAll({ lineHeight: v })));
  container.appendChild(sizeRow);

  // --- Bold / Italic ---
  container.appendChild(createCheckbox('Bold', overrides.bold ?? resolved?.bold ?? false, (v) => updateAll({ bold: v })));
  container.appendChild(createCheckbox('Italic', overrides.italic ?? resolved?.italic ?? false, (v) => updateAll({ italic: v })));

  // --- Alignment ---
  const alignRow = createRow();
  const alignLabel = document.createElement('span');
  alignLabel.textContent = 'Align';
  alignLabel.style.fontSize = '12px';
  alignRow.appendChild(alignLabel);
  alignRow.appendChild(createSelect(
    [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }],
    overrides.alignment ?? resolved?.alignment ?? 'left',
    (v) => updateAll({ alignment: v as any }),
  ));
  alignRow.appendChild(createSelect(
    [{ label: 'Top', value: 'top' }, { label: 'Middle', value: 'middle' }, { label: 'Bottom', value: 'bottom' }],
    overrides.verticalAlignment ?? resolved?.verticalAlignment ?? 'middle',
    (v) => updateAll({ verticalAlignment: v as any }),
  ));
  container.appendChild(alignRow);

  // --- Colors ---
  const colorRow = createRow();
  const fcLabel = document.createElement('span');
  fcLabel.textContent = 'Font';
  fcLabel.style.fontSize = '12px';
  colorRow.appendChild(fcLabel);
  colorRow.appendChild(createColorInput(overrides.fontColor ?? resolved?.fontColor ?? '#000000', (v) => updateAll({ fontColor: v })));
  const bgLabel = document.createElement('span');
  bgLabel.textContent = 'BG';
  bgLabel.style.fontSize = '12px';
  colorRow.appendChild(bgLabel);
  colorRow.appendChild(createColorInput(overrides.backgroundColor ?? resolved?.backgroundColor ?? '#ffffff', (v) => updateAll({ backgroundColor: v })));
  container.appendChild(colorRow);

  // --- Border color + width ---
  const borderRow = createRow();
  const bcLabel = document.createElement('span');
  bcLabel.textContent = 'Border';
  bcLabel.style.fontSize = '12px';
  borderRow.appendChild(bcLabel);
  borderRow.appendChild(createColorInput(overrides.borderColor ?? resolved?.borderColor ?? '#888888', (v) => updateAll({ borderColor: v })));
  const bwVal = overrides.borderWidth?.top ?? resolved?.borderWidth?.top ?? 0.1;
  borderRow.appendChild(createNumberInput(bwVal, 0, 0.1, (v) => {
    updateAll({ borderWidth: { top: v, right: v, bottom: v, left: v } });
  }));
  container.appendChild(borderRow);

  // --- Padding ---
  container.appendChild(createLabel('Padding'));
  const padRow = createRow();
  const padLabels = ['T', 'R', 'B', 'L'];
  const padKeys = ['top', 'right', 'bottom', 'left'] as const;
  const currentPad = overrides.padding ?? resolved?.padding ?? { top: 5, right: 5, bottom: 5, left: 5 };
  for (let i = 0; i < 4; i++) {
    const l = document.createElement('span');
    l.textContent = padLabels[i];
    l.style.fontSize = '11px';
    padRow.appendChild(l);
    const key = padKeys[i];
    padRow.appendChild(createNumberInput(currentPad[key] ?? 5, 0, 1, (v) => {
      const { table: t } = getTC();
      const cell = t.getCellById(primaryId);
      const existingPad = cell?.styleOverrides.padding ?? { top: 5, right: 5, bottom: 5, left: 5 };
      updateAll({ padding: { ...existingPad, [key]: v } });
    }));
  }
  container.appendChild(padRow);

  // --- Reset to region defaults ---
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset to Region Defaults';
  Object.assign(resetBtn.style, {
    marginTop: '8px', width: '100%', padding: '6px 12px',
    border: '1px solid #ccc', borderRadius: '4px',
    background: '#fafafa', cursor: 'pointer', fontSize: '12px',
  });
  resetBtn.addEventListener('click', () => {
    const { table: t, commit } = getTC();
    for (const id of selectedIds) {
      t.clearCellStyleOverrides(id);
      t.updateCell(id, { overflow: undefined });
    }
    commit();
  });
  container.appendChild(resetBtn);
}
