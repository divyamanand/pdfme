import type { UIRenderProps, Mode } from '@pdfme/common';
import type { NestedTableSchema } from './types.js';
import type { Styles } from '../tables/types.js';
import { px2mm, ZOOM, shiftCFRows, shiftCFCols } from '@pdfme/common';
import { createSingleTable } from '../tables/tableHelper.js';
import { getBody, getBodyWithRange } from '../tables/helper.js';
import cell from '../tables/cell.js';
import { Row } from '../tables/classes.js';
import {
  buildHeaderRows,
  getLeafNodes,
  getLeafWidthPercentages,
  getTreeDepth,
  updateLeafWidth,
  renameNode,
} from './treeUtils.js';

const buttonSize = 30;

function createButton(options: {
  width: number;
  height: number;
  top: string;
  left?: string;
  right?: string;
  text: string;
  onClick: (e: MouseEvent) => void;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.style.width = `${options.width}px`;
  button.style.height = `${options.height}px`;
  button.style.position = 'absolute';
  button.style.top = options.top;
  if (options.left !== undefined) {
    button.style.left = options.left;
  }
  if (options.right !== undefined) {
    button.style.right = options.right;
  }
  button.innerText = options.text;
  button.onclick = options.onClick;
  return button;
}

type RowType = InstanceType<typeof Row>;

const cellUiRender = cell.ui;

function pt2mm(pt: number): number {
  return pt * 0.352778;
}

// Convert Styles (from table engine) to CellStyle properties (for cellUiRender schema)
const convertToCellStyle = (styles: Styles) => ({
  fontName: styles.fontName,
  alignment: styles.alignment,
  verticalAlignment: styles.verticalAlignment,
  fontSize: styles.fontSize,
  lineHeight: styles.lineHeight,
  characterSpacing: styles.characterSpacing,
  backgroundColor: styles.backgroundColor,
  fontColor: styles.textColor,
  borderColor: styles.lineColor,
  borderWidth: styles.lineWidth,
  padding: styles.cellPadding,
});

const calcResizedLeafWidthPercentages = (arg: {
  currentLeafWidthPercentages: number[];
  currentLeafWidths: number[];
  changedLeafWidth: number;
  changedLeafIndex: number;
}) => {
  const { currentLeafWidthPercentages, currentLeafWidths, changedLeafWidth, changedLeafIndex } =
    arg;
  const widthPercentages = [...currentLeafWidthPercentages];
  const totalWidth = currentLeafWidths.reduce((a, b) => a + b, 0);
  const changedWidthPercentage = (changedLeafWidth / totalWidth) * 100;
  const originalNextWidthPercentage = widthPercentages[changedLeafIndex + 1] ?? 0;
  const adjustment = widthPercentages[changedLeafIndex] - changedWidthPercentage;
  widthPercentages[changedLeafIndex] = changedWidthPercentage;
  if (changedLeafIndex + 1 < widthPercentages.length) {
    widthPercentages[changedLeafIndex + 1] = originalNextWidthPercentage + adjustment;
  }
  return widthPercentages;
};

const setBorder = (
  div: HTMLDivElement,
  borderPosition: 'Top' | 'Left' | 'Right' | 'Bottom',
  arg: UIRenderProps<NestedTableSchema>,
) => {
  div.style[`border${borderPosition}`] = `${String(arg.schema.tableStyles.borderWidth)}mm solid ${
    arg.schema.tableStyles.borderColor
  }`;
};

const headerEditingPosition = { row: -1, colStart: -1 };
const bodyEditingPosition = { rowIndex: -1, colIndex: -1 };

const resetEditingPosition = () => {
  headerEditingPosition.row = -1;
  headerEditingPosition.colStart = -1;
  bodyEditingPosition.rowIndex = -1;
  bodyEditingPosition.colIndex = -1;
};

export const uiRender = async (arg: UIRenderProps<NestedTableSchema>) => {
  const { rootElement, onChange, schema, value, mode, scale = 1 } = arg;

  rootElement.innerHTML = '';

  // Guard against missing or corrupted headerTree
  const headerTree = Array.isArray(schema.headerTree) ? schema.headerTree : [];
  if (headerTree.length === 0 && schema.headerTree !== headerTree) {
    // headerTree was corrupted, restore it
    return;
  }

  const leaves = getLeafNodes(headerTree);
  const leafLabels = leaves.map((l) => l.label);
  const leafWidthPercentages = getLeafWidthPercentages(headerTree);
  const leafWidthsMm = leafWidthPercentages.map((pct) => (schema.width * pct) / 100);

  // Compute header height from tree depth
  const showHead = schema.showHead && headerTree.length > 0;
  const maxDepth = showHead ? getTreeDepth(headerTree) : 0;
  const singleRowHeight = showHead
    ? pt2mm(schema.headStyles?.fontSize || 13) * (schema.headStyles?.lineHeight || 1) +
      (schema.headStyles?.padding?.top || 0) +
      (schema.headStyles?.padding?.bottom || 0)
    : 0;
  const headerHeight = maxDepth * singleRowHeight;

  // Build synthetic TableSchema for body rendering
  const syntheticTableSchema = {
    ...schema,
    type: 'table',
    showHead: false,
    head: leafLabels,
    headWidthPercentages: leafWidthPercentages,
  };
  const body = getBody(value, leafLabels);
  const bodyWidthRange = getBodyWithRange(value, schema.__bodyRange, leafLabels);

  const typedBody: string[][] = Array.isArray(bodyWidthRange)
    ? bodyWidthRange.map((row) => (Array.isArray(row) ? row.map((c) => String(c)) : []))
    : [];

  const table = await createSingleTable(typedBody, {
    ...arg,
    schema: syntheticTableSchema,
  } as any);

  // Handle editing position changes
  const handleChangeHeaderEditingPosition = (newPosition: {
    row: number;
    colStart: number;
  }) => {
    resetEditingPosition();
    headerEditingPosition.row = newPosition.row;
    headerEditingPosition.colStart = newPosition.colStart;
    void uiRender(arg);
  };

  const handleChangeBodyEditingPosition = (newPosition: {
    rowIndex: number;
    colIndex: number;
  }) => {
    resetEditingPosition();
    bodyEditingPosition.rowIndex = newPosition.rowIndex;
    bodyEditingPosition.colIndex = newPosition.colIndex;
    void uiRender(arg);
  };

  // ---- Render nested header rows ----
  if (showHead) {
    const headerRows = buildHeaderRows(headerTree);

    // Calculate leaf x positions
    const leafXPositions: number[] = [];
    let cumulativeX = 0;
    for (let i = 0; i < leafWidthsMm.length; i++) {
      leafXPositions.push(cumulativeX);
      cumulativeX += leafWidthsMm[i];
    }

    for (const headerCell of headerRows.flat()) {
      const cellX = leafXPositions[headerCell.colStart];
      const cellWidth = leafWidthsMm
        .slice(headerCell.colStart, headerCell.colStart + headerCell.colspan)
        .reduce((a, b) => a + b, 0);
      const cellY = headerCell.row * singleRowHeight;
      const cellHeight = headerCell.rowspan * singleRowHeight;

      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = `${cellY}mm`;
      div.style.left = `${cellX}mm`;
      div.style.width = `${cellWidth}mm`;
      div.style.height = `${cellHeight}mm`;
      div.style.boxSizing = 'border-box';
      div.style.cursor = mode === 'designer' ? 'text' : 'default';

      // Draw borders for header cells
      const isFirstRow = headerCell.row === 0;
      const isFirstColumn = headerCell.colStart === 0;
      const isLastColumn = headerCell.colStart + headerCell.colspan === leaves.length;
      const isBottomOfHeader = headerCell.row + headerCell.rowspan === maxDepth;

      if (isFirstRow) setBorder(div, 'Top', arg);
      if (isFirstColumn) setBorder(div, 'Left', arg);
      if (isLastColumn) setBorder(div, 'Right', arg);
      if (typedBody.length === 0 && isBottomOfHeader) {
        setBorder(div, 'Bottom', arg);
      }

      div.addEventListener('click', () => {
        if (mode === 'viewer') return;
        handleChangeHeaderEditingPosition({
          row: headerCell.row,
          colStart: headerCell.colStart,
        });
      });

      rootElement.appendChild(div);

      const isEditing =
        headerEditingPosition.row === headerCell.row &&
        headerEditingPosition.colStart === headerCell.colStart;
      let cellMode: Mode = 'viewer';
      if (mode === 'designer') {
        cellMode = isEditing ? 'designer' : 'form';
      }

      // Use headStyles directly (CellStyle fields: fontColor, borderColor, etc.)
      void cellUiRender({
        ...arg,
        stopEditing: () => {
          if (mode === 'form') {
            resetEditingPosition();
          }
        },
        mode: cellMode,
        onChange: (v) => {
          if (!arg.onChange) return;
          const newValue = (Array.isArray(v) ? v[0].value : v.value) as string;
          const newTree = renameNode(headerTree, headerCell.node.id, newValue);
          arg.onChange({ key: 'headerTree', value: newTree });
        },
        value: headerCell.label,
        placeholder: '',
        rootElement: div,
        schema: {
          name: '',
          type: 'cell',
          content: headerCell.label,
          position: { x: cellX, y: cellY },
          width: cellWidth,
          height: cellHeight,
          ...schema.headStyles,
        } as any,
      });
    }
  }

  // ---- Render body rows ----
  let rowOffsetY = headerHeight;
  table.body.forEach((row, rowIndex) => {
    const { cells, height } = row;
    let colOffsetX = 0;
    Object.values(cells).forEach((bodyCell, colIndex) => {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = `${rowOffsetY}mm`;
      div.style.left = `${colOffsetX}mm`;
      div.style.width = `${bodyCell.width}mm`;
      div.style.height = `${bodyCell.height}mm`;
      div.style.boxSizing = 'border-box';

      // Draw borders for body cells
      const isFirstColumn = colIndex === 0;
      const isLastColumn = colIndex === Object.values(cells).length - 1;
      const isLastRow = rowIndex === table.body.length - 1;

      if (rowIndex === 0 && !showHead) {
        setBorder(div, 'Top', arg);
      }
      if (isFirstColumn) setBorder(div, 'Left', arg);
      if (isLastColumn) setBorder(div, 'Right', arg);
      if (isLastRow) setBorder(div, 'Bottom', arg);

      div.style.cursor =
        mode === 'designer' || mode === 'form' ? 'text' : 'default';

      div.addEventListener('click', () => {
        if (mode === 'viewer') return;
        handleChangeBodyEditingPosition({ rowIndex, colIndex });
      });
      rootElement.appendChild(div);

      const isEditing =
        bodyEditingPosition.rowIndex === rowIndex &&
        bodyEditingPosition.colIndex === colIndex;
      let cellMode: Mode = 'viewer';
      if (mode === 'form') {
        cellMode = isEditing && !schema.readOnly ? 'designer' : 'viewer';
      } else if (mode === 'designer') {
        cellMode = isEditing ? 'designer' : 'form';
      }

      void cellUiRender({
        ...arg,
        stopEditing: () => {
          if (mode === 'form') {
            resetEditingPosition();
          }
        },
        mode: cellMode,
        onChange: (v) => {
          if (!arg.onChange) return;
          const newValue = (Array.isArray(v) ? v[0].value : v.value) as string;
          const fullBody = getBody(value, leafLabels);
          const startRange = schema.__bodyRange?.start ?? 0;
          fullBody[rowIndex + startRange][colIndex] = newValue;
          arg.onChange({ key: 'content', value: JSON.stringify(fullBody) });
        },
        value: bodyCell.raw,
        placeholder: '',
        rootElement: div,
        schema: {
          name: '',
          type: 'cell',
          content: bodyCell.raw,
          position: { x: colOffsetX, y: rowOffsetY },
          width: bodyCell.width,
          height: bodyCell.height,
          ...convertToCellStyle(bodyCell.styles),
        },
      });
      colOffsetX += bodyCell.width;
    });
    rowOffsetY += height;
  });

  // ---- Buttons ----
  const totalHeight = headerHeight + table.getBodyHeight();

  const createAddRowButton = () =>
    createButton({
      width: buttonSize,
      height: buttonSize,
      top: `${totalHeight}mm`,
      left: `calc(50% - ${buttonSize / 2}px)`,
      text: '+',
      onClick: () => {
        const newRow = Array(leaves.length).fill('') as string[];
        if (onChange) onChange({ key: 'content', value: JSON.stringify(body.concat([newRow])) });
      },
    });

  const createRemoveRowButtons = () => {
    let offsetY = headerHeight;
    return table.body.map((row, i) => {
      offsetY = offsetY + row.height;
      return createButton({
        width: buttonSize,
        height: buttonSize,
        top: `${offsetY - px2mm(buttonSize)}mm`,
        right: `-${buttonSize}px`,
        text: '-',
        onClick: () => {
          const removedRowIndex = i + (schema.__bodyRange?.start ?? 0);
          const newBody = body.filter((_, j) => j !== removedRowIndex);
          if (onChange) {
            const changes: Array<{ key: string; value: any }> = [
              { key: 'content', value: JSON.stringify(newBody) },
            ];
            if (schema.conditionalFormatting) {
              changes.push({
                key: 'conditionalFormatting',
                value: shiftCFRows(schema.conditionalFormatting, removedRowIndex, -1),
              });
            }
            onChange(changes);
          }
        },
      });
    });
  };

  if (mode === 'form' && onChange && !schema.readOnly) {
    if (
      schema.__bodyRange?.end === undefined ||
      schema.__bodyRange.end >= (JSON.parse(value || '[]') as string[][]).length
    ) {
      rootElement.appendChild(createAddRowButton());
    }
    createRemoveRowButtons().forEach((button) => rootElement.appendChild(button));
  }

  if (mode === 'designer' && onChange) {
    rootElement.appendChild(createAddRowButton());
    createRemoveRowButtons().forEach((button) => rootElement.appendChild(button));

    // Column resize drag handles
    let offsetX = 0;
    table.columns.forEach((column, i) => {
      if (table.columns.length === 1) return;
      offsetX = offsetX + column.width;
      if (i === table.columns.length - 1) return;

      const dragHandle = document.createElement('div');
      const lineWidth = 5;
      dragHandle.style.width = `${lineWidth}px`;
      dragHandle.style.height = '100%';
      dragHandle.style.backgroundColor = '#eee';
      dragHandle.style.opacity = '0.5';
      dragHandle.style.cursor = 'col-resize';
      dragHandle.style.position = 'absolute';
      dragHandle.style.zIndex = '10';
      dragHandle.style.left = `${offsetX - px2mm(lineWidth) / 2}mm`;
      dragHandle.style.top = '0';

      const setColor = (e: MouseEvent) => {
        const handle = e.target as HTMLDivElement;
        handle.style.backgroundColor = '#2196f3';
      };
      const resetColor = (e: MouseEvent) => {
        const handle = e.target as HTMLDivElement;
        handle.style.backgroundColor = '#eee';
      };
      dragHandle.addEventListener('mouseover', setColor);
      dragHandle.addEventListener('mouseout', resetColor);

      const prevColumnLeft = offsetX - column.width;
      const nextColumnRight = offsetX - px2mm(lineWidth) + table.columns[i + 1].width;

      dragHandle.addEventListener('mousedown', (e) => {
        resetEditingPosition();
        dragHandle.removeEventListener('mouseover', setColor);
        dragHandle.removeEventListener('mouseout', resetColor);

        const startClientX = e.clientX;
        const startLeft = Number(dragHandle.style.left.replace('mm', ''));

        let move = 0;
        const mouseMove = (e: MouseEvent) => {
          const deltaX = e.clientX - startClientX;
          const moveX = deltaX / ZOOM / scale;
          let newLeft = startLeft + moveX;

          if (newLeft < prevColumnLeft) newLeft = prevColumnLeft;
          if (newLeft >= nextColumnRight) newLeft = nextColumnRight;
          dragHandle.style.left = `${newLeft}mm`;
          move = newLeft - startLeft;
        };
        rootElement.addEventListener('mousemove', mouseMove);

        const commitResize = () => {
          if (move !== 0) {
            const newLeafWidthPercentages = calcResizedLeafWidthPercentages({
              currentLeafWidthPercentages: leafWidthPercentages,
              currentLeafWidths: table.columns.map((col) => col.width),
              changedLeafWidth: table.columns[i].width + move,
              changedLeafIndex: i,
            });

            const newHeaderTree = leaves.reduce((tree, leaf, leafIdx) => {
              return updateLeafWidth(tree, leaf.id, newLeafWidthPercentages[leafIdx]);
            }, headerTree);

            onChange({ key: 'headerTree', value: newHeaderTree });
          }
          move = 0;
          dragHandle.addEventListener('mouseover', setColor);
          dragHandle.addEventListener('mouseout', resetColor);
          rootElement.removeEventListener('mousemove', mouseMove);
          rootElement.removeEventListener('mouseup', commitResize);
        };
        rootElement.addEventListener('mouseup', commitResize);
      });
      rootElement.appendChild(dragHandle);
    });
  }

  if (mode === 'viewer') {
    resetEditingPosition();
  }

  // Auto-adjust height (guard against NaN to prevent infinite loop)
  if (totalHeight > 0 && isFinite(totalHeight) && totalHeight !== schema.height && onChange) {
    onChange({ key: 'height', value: totalHeight });
  }
};
