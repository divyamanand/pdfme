/**
 * Structure widget — tree view of all table regions with add/remove/merge controls.
 */

import type { PropPanelWidgetProps } from '@pdfme/common';
import type { SerializedHeaderNode, SerializedBodyCell, Region } from '../../engine/index.js';
import { showToast } from '../toast.js';
import { buildMergeRect } from '../../uiComponents/cellSelection.js';
import type { WidgetSchema } from '../domUtils.js';
import {
  parseContent,
  getTableAndCommit,
  createRow,
  createSmallButton,
} from '../domUtils.js';

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
        const result = table.addHeaderCell(region, node.cellId);
        if (result === 'exceeds-bounds') { showToast('Table would exceed page boundaries'); return; }
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
    table.updateSettings({ headerVisibility: { ...vis, theader: val } });
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, theaderNodes, 'theader' as Region, getTC);
    // Add column button
    const addBtn = createSmallButton('+', 'Add column', () => {
      const { table, commit } = getTC();
      const result = table.addHeaderCell('theader' as Region);
      if (result === 'exceeds-bounds') { showToast('Table would exceed page boundaries'); return; }
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
    table.updateSettings({ headerVisibility: { ...vis, lheader: val } });
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, lheaderNodes, 'lheader' as Region, getTC);
    const addBtn = createSmallButton('+', 'Add row', () => {
      const { table, commit } = getTC();
      const result = table.addHeaderCell('lheader' as Region);
      if (result === 'exceeds-bounds') { showToast('Table would exceed page boundaries'); return; }
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
    table.updateSettings({ headerVisibility: { ...vis, rheader: val } });
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';
    renderHeaderTree(container, rheaderNodes, 'rheader' as Region, getTC);
    const addBtn = createSmallButton('+', 'Add row', () => {
      const { table, commit } = getTC();
      const result = table.addHeaderCell('rheader' as Region);
      if (result === 'exceeds-bounds') { showToast('Table would exceed page boundaries'); return; }
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
    if (status === 'max-reached') { showToast('Maximum rows reached'); return; }
    if (status === 'exceeds-bounds') { showToast('Table would exceed page boundaries'); return; }
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
    const result = table.addHeaderCell('theader' as Region);
    if (result === 'exceeds-bounds') { showToast('Table would exceed page boundaries'); return; }
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

  // Column width inputs
  const colWidthsSection = document.createElement('div');
  Object.assign(colWidthsSection.style, { marginTop: '6px' });
  const cwLabel = document.createElement('div');
  cwLabel.textContent = 'Column Widths (mm)';
  Object.assign(cwLabel.style, { fontSize: '11px', color: '#666', marginBottom: '2px' });
  colWidthsSection.appendChild(cwLabel);
  const cwGrid = document.createElement('div');
  Object.assign(cwGrid.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  {
    const { table } = getTableAndCommit(props);
    const widths = table.getColumnWidths();
    for (let i = 0; i < widths.length; i++) {
      const colIdx = i;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = String(Math.round(widths[i] * 100) / 100);
      inp.min = '1';
      inp.step = 'any';
      inp.title = `Col ${i + 1}`;
      Object.assign(inp.style, { width: '48px', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px' });
      inp.addEventListener('change', () => {
        const requested = Math.max(1, parseFloat(inp.value) || 1);
        const { table: t, commit: c } = getTableAndCommit(props);
        const curWidths = t.getColumnWidths();
        const oldW = curWidths[colIdx];
        const totalW = curWidths.reduce((s, w) => s + w, 0);
        const { width: availW } = t.getAvailableSpace();
        const maxAllowed = Math.max(1, oldW + (availW - totalW));
        const v = Math.min(requested, maxAllowed);
        if (requested > maxAllowed) {
          showToast('Column width clamped to fit page boundaries');
          inp.value = String(Math.round(v * 100) / 100);
        }
        t.setColumnWidth(colIdx, v);
        c();
      });
      cwGrid.appendChild(inp);
    }
  }
  colWidthsSection.appendChild(cwGrid);
  bodySection.appendChild(colWidthsSection);

  // Row height inputs
  const rowHeightsSection = document.createElement('div');
  Object.assign(rowHeightsSection.style, { marginTop: '6px' });
  const rhLabel = document.createElement('div');
  rhLabel.textContent = 'Row Heights (mm)';
  Object.assign(rhLabel.style, { fontSize: '11px', color: '#666', marginBottom: '2px' });
  rowHeightsSection.appendChild(rhLabel);
  const rhGrid = document.createElement('div');
  Object.assign(rhGrid.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  {
    const { table } = getTableAndCommit(props);
    const heights = table.getRowHeights();
    for (let i = 0; i < heights.length; i++) {
      const rowIdx = i;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = String(Math.round(heights[i] * 100) / 100);
      inp.min = '1';
      inp.step = '0.01';
      inp.title = `Row ${i + 1}`;
      Object.assign(inp.style, { width: '48px', padding: '2px 4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '11px' });
      inp.addEventListener('change', () => {
        const raw = Math.max(1, parseFloat(inp.value) || 1);
        const requested = Math.round(raw * 100) / 100;
        inp.value = String(requested);
        const { table: t, commit: c } = getTableAndCommit(props);
        const curHeights = t.getRowHeights();
        const oldH = curHeights[rowIdx];
        const mainH = curHeights.reduce((s, h) => s + h, 0);
        const footerH = t.getFooterRowHeights().reduce((s, h) => s + h, 0);
        const totalH = mainH + footerH;
        const { height: availH } = t.getAvailableSpace();
        const maxAllowed = Math.max(1, Math.round((oldH + (availH - totalH)) * 100) / 100);
        const v = Math.min(requested, maxAllowed);
        if (requested > maxAllowed) {
          showToast('Row height clamped to fit page boundaries');
          inp.value = String(v);
        }
        t.setRowHeight(rowIdx, v);
        c();
      });
      rhGrid.appendChild(inp);
    }
  }
  rowHeightsSection.appendChild(rhGrid);
  bodySection.appendChild(rowHeightsSection);

  rootElement.appendChild(bodySection);

  // --- Footer (flat 2D rows, independent cells) ---
  const footerGrid: SerializedBodyCell[][] = parsed.footer ?? [];
  renderRegionSection(rootElement, 'Footer', hasFooter, (val) => {
    const { table, commit } = getTC();
    if (val) {
      table.updateSettings({ footer: { mode: 'every-page' } });
      if (table.getFooter().length === 0) {
        table.addFooterRow();
      }
    } else {
      table.updateSettings({ footer: undefined });
    }
    commit();
  }, () => {
    const container = document.createElement('div');
    container.style.paddingLeft = '12px';

    footerGrid.forEach((row: SerializedBodyCell[], rowIdx: number) => {
      const rowEl = createRow();
      const rowLabel = document.createElement('span');
      rowLabel.textContent = `Row ${rowIdx + 1}:`;
      Object.assign(rowLabel.style, { fontSize: '11px', color: '#666', marginRight: '4px' });
      rowEl.appendChild(rowLabel);

      row.forEach((_cell: SerializedBodyCell, colIdx: number) => {
        const chip = document.createElement('span');
        chip.textContent = String(_cell.rawValue || `Cell ${colIdx + 1}`);
        Object.assign(chip.style, {
          fontSize: '11px', padding: '1px 6px', background: '#e8f0fe',
          borderRadius: '10px', marginRight: '2px', display: 'inline-flex', alignItems: 'center', gap: '2px',
        });
        const del = document.createElement('span');
        del.textContent = '×';
        del.style.cursor = 'pointer';
        del.addEventListener('click', () => {
          const { table: t, commit: c } = getTC();
          t.removeFooterCell(rowIdx, colIdx);
          c();
        });
        chip.appendChild(del);
        rowEl.appendChild(chip);
      });

      const addCellBtn = createSmallButton('+', 'Add cell to this row', () => {
        const { table: t, commit: c } = getTC();
        t.addFooterCell(rowIdx);
        c();
      });
      rowEl.appendChild(addCellBtn);

      const removeRowBtn = createSmallButton('−', 'Remove row', () => {
        const { table: t, commit: c } = getTC();
        t.removeFooterRow(rowIdx);
        c();
      });
      rowEl.appendChild(removeRowBtn);
      container.appendChild(rowEl);
    });

    const addRowBtn = createSmallButton('+ Add Row', 'Add footer row', () => {
      const { table: t, commit: c } = getTC();
      t.addFooterRow();
      c();
    });
    addRowBtn.style.marginTop = '4px';
    container.appendChild(addRowBtn);
    return container;
  });

  // --- Merge / Unmerge ---
  const mergeSection = document.createElement('div');
  Object.assign(mergeSection.style, { marginTop: '8px', padding: '6px', background: '#f9f9f9', borderRadius: '4px' });
  rootElement.appendChild(mergeSection);

  /** Rebuild merge section content based on current merge mode */
  function renderMergeSection() {
    mergeSection.innerHTML = '';
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '12px', fontWeight: '600', marginBottom: '6px' });
    title.textContent = 'Merge / Unmerge';
    mergeSection.appendChild(title);

    const { table: mTable } = getTC();
    const mode = mTable.getUIState().mergeMode;

    const mkBtn = (text: string, tip: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.title = tip;
      Object.assign(btn.style, {
        padding: '2px 8px',
        border: '1px solid #ccc',
        borderRadius: '3px',
        background: '#fafafa',
        cursor: 'pointer',
        fontSize: '11px',
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      });
      btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
      return btn;
    };

    if (mode === 'selecting') {
      const info = document.createElement('div');
      Object.assign(info.style, { fontSize: '11px', color: '#ff9800', marginBottom: '4px' });
      info.textContent = 'Click cells on canvas to select, then confirm.';
      mergeSection.appendChild(info);

      const btnRow = createRow();
      btnRow.appendChild(mkBtn('\u2713 Confirm', 'Merge selected cells', () => {
        const { table, commit } = getTC();
        const snapshot = table.getRenderSnapshot();
        const rect = buildMergeRect(table, snapshot);
        if (!rect) {
          showToast('Select a rectangular block of ≥2 cells in the same region');
          return;
        }
        table.mergeCells(rect);
        table.setMergeMode('none');
        commit();
      }));
      btnRow.appendChild(mkBtn('\u2715 Cancel', 'Cancel merge selection', () => {
        const { table, commit } = getTC();
        table.setMergeMode('none');
        table.triggerRender();
        renderMergeSection();
        commit();
      }));
      mergeSection.appendChild(btnRow);
    } else if (mode === 'unmerging') {
      const info = document.createElement('div');
      Object.assign(info.style, { fontSize: '11px', color: '#f44336', marginBottom: '4px' });
      info.textContent = 'Click a merged cell on canvas to unmerge it.';
      mergeSection.appendChild(info);

      const btnRow = createRow();
      btnRow.appendChild(mkBtn('\u2715 Cancel', 'Cancel unmerge', () => {
        const { table, commit } = getTC();
        table.setMergeMode('none');
        table.triggerRender();
        renderMergeSection();
        commit();
      }));
      mergeSection.appendChild(btnRow);
    } else {
      const btnRow = createRow();
      btnRow.appendChild(mkBtn('\u229e Merge', 'Select cells on canvas to merge', () => {
        const { table, commit } = getTC();
        table.setMergeMode('selecting');
        table.triggerRender();
        renderMergeSection();
        commit();
      }));
      const mergeCount = parsed.merges?.length ?? 0;
      if (mergeCount > 0) {
        btnRow.appendChild(mkBtn('\u229f Unmerge', 'Click a merged cell to unmerge', () => {
          const { table, commit } = getTC();
          table.setMergeMode('unmerging');
          table.triggerRender();
          renderMergeSection();
          commit();
        }));
      }
      mergeSection.appendChild(btnRow);

      if (mergeCount > 0) {
        const listTitle = document.createElement('div');
        Object.assign(listTitle.style, { fontSize: '11px', fontWeight: '500', marginTop: '6px', marginBottom: '2px' });
        listTitle.textContent = `Merged Regions (${mergeCount})`;
        mergeSection.appendChild(listTitle);

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
      }
    }
  }

  renderMergeSection();
}
