/**
 * Renders region style controls (font, color, border, padding) for a given region.
 */

import type { PropPanelWidgetProps } from '@pdfme/common';
import { getFallbackFontName, DEFAULT_FONT_NAME } from '@pdfme/common';
import type { WidgetSchema } from './domUtils.js';
import {
  parseContent,
  getTableAndCommit,
  createLabel,
  createRow,
  createNumberInput,
  createColorInput,
  createSelect,
} from './domUtils.js';

export function renderRegionStyleControls(props: PropPanelWidgetProps, region: string, container: HTMLElement): void {
  const schema = props.activeSchema as WidgetSchema;
  const parsed = parseContent(schema);
  const regionStyles = parsed.regionStyles ?? {};
  const style = (regionStyles as Record<string, any>)[region] ?? {};

  const font = props.options.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
  const fontNames = Object.keys(font);
  const fallbackFontName = getFallbackFontName(font);

  const update = (patch: Record<string, unknown>) => {
    const { table, commit } = getTableAndCommit(props);
    const current = table.getRegionStyle(region as any) ?? {};
    table.setRegionStyle(region as any, { ...current, ...patch } as any);
    commit();
  };

  // Font name
  container.appendChild(createLabel('Font'));
  container.appendChild(createSelect(
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
  container.appendChild(sizeRow);

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
  container.appendChild(alignRow);

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
  container.appendChild(colorRow);

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
  container.appendChild(borderRow);

  // Padding
  container.appendChild(createLabel('Padding'));
  const padRow = createRow();
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
      // Read fresh padding from the table to avoid stale closure
      const { table } = getTableAndCommit(props);
      const currentStyle = (table.getRegionStyle(region as any) as any) ?? {};
      const currentPad = currentStyle.padding ?? { top: 5, right: 5, bottom: 5, left: 5 };
      update({ padding: { ...currentPad, [key]: v } });
    }));
  }
  container.appendChild(padRow);

  // Alternate background color (body only)
  if (region === 'body') {
    const altRow = createRow();
    const altLabel = document.createElement('span');
    altLabel.textContent = 'Alt BG';
    altLabel.style.fontSize = '12px';
    altRow.appendChild(altLabel);
    altRow.appendChild(createColorInput(style.alternateBackgroundColor ?? '#f5f5f5', (v) => update({ alternateBackgroundColor: v })));
    container.appendChild(altRow);
  }
}
