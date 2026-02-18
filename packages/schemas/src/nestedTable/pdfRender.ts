import type { NestedTableSchema } from './types.js';
import type { PDFRenderProps, Schema, BasePdf, CommonOptions } from '@pdfme/common';
import type { TableSchema } from '../tables/types.js';
import cell from '../tables/cell.js';
import { getBodyWithRange } from '../tables/helper.js';
import { createSingleTable } from '../tables/tableHelper.js';
import { rectangle } from '../shapes/rectAndEllipse.js';
import {
  buildHeaderRows,
  getLeafNodes,
  getLeafWidthPercentages,
  getTreeDepth,
} from './treeUtils.js';

interface CreateTableArgs {
  schema: Schema;
  basePdf: BasePdf;
  options: CommonOptions;
  _cache: Map<string | number, unknown>;
}

type Pos = { x: number; y: number };

const cellPdfRender = cell.pdf;
const rectanglePdfRender = rectangle.pdf;

function pt2mm(pt: number): number {
  return pt * 0.352778;
}

async function drawCell(
  arg: PDFRenderProps<NestedTableSchema>,
  cellValue: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  await cellPdfRender({
    ...arg,
    value: cellValue,
    schema: {
      name: '',
      type: 'cell',
      position: { x, y },
      width,
      height,
      fontName: arg.schema.headStyles.fontName,
      alignment: arg.schema.headStyles.alignment,
      verticalAlignment: arg.schema.headStyles.verticalAlignment,
      fontSize: arg.schema.headStyles.fontSize,
      lineHeight: arg.schema.headStyles.lineHeight,
      characterSpacing: arg.schema.headStyles.characterSpacing,
      backgroundColor: arg.schema.headStyles.backgroundColor,
      fontColor: arg.schema.headStyles.fontColor,
      borderColor: arg.schema.headStyles.borderColor,
      borderWidth: arg.schema.headStyles.borderWidth,
      padding: arg.schema.headStyles.padding,
    },
  });
}

async function renderNestedHeaders(arg: PDFRenderProps<NestedTableSchema>): Promise<number> {
  const { schema } = arg;

  if (!schema.showHead || !Array.isArray(schema.headerTree) || schema.headerTree.length === 0) {
    return 0;
  }

  const maxDepth = getTreeDepth(schema.headerTree);
  const headerRows = buildHeaderRows(schema.headerTree);
  const leaves = getLeafNodes(schema.headerTree);

  // Calculate header row height
  const fontSize = schema.headStyles.fontSize;
  const lineHeight = schema.headStyles.lineHeight;
  const padding = schema.headStyles.padding;
  const singleRowHeight =
    pt2mm(fontSize) * lineHeight + (padding.top || 0) + (padding.bottom || 0);
  const totalHeaderHeight = maxDepth * singleRowHeight;

  // Calculate leaf widths in mm
  const leafWidthPercentages = getLeafWidthPercentages(schema.headerTree);
  const leafWidthsMm = leafWidthPercentages.map((pct) => (schema.width * pct) / 100);

  // Calculate column x positions
  const leafXPositions: number[] = [];
  let cumulativeX = schema.position.x;
  for (let i = 0; i < leafWidthsMm.length; i++) {
    leafXPositions.push(cumulativeX);
    cumulativeX += leafWidthsMm[i];
  }

  // Render header rows
  for (const headerRow of headerRows) {
    for (const headerCell of headerRow) {
      const cellX = leafXPositions[headerCell.colStart];
      const cellWidth = leafWidthsMm
        .slice(headerCell.colStart, headerCell.colStart + headerCell.colspan)
        .reduce((a, b) => a + b, 0);
      const cellY = schema.position.y + headerCell.row * singleRowHeight;
      const cellHeight = headerCell.rowspan * singleRowHeight;

      await drawCell(arg, headerCell.label, cellX, cellY, cellWidth, cellHeight);
    }
  }

  return totalHeaderHeight;
}

export const pdfRender = async (arg: PDFRenderProps<NestedTableSchema>) => {
  const { value, schema, basePdf, options, _cache } = arg;

  // Render nested headers
  const headerHeight = await renderNestedHeaders(arg);

  // Extract leaf column labels for object-row normalisation
  const leaves = getLeafNodes(schema.headerTree);
  const leafLabels = leaves.map((n) => n.label);

  // Prepare body for rendering (supports both string[][] and {col:val}[] input)
  const body = getBodyWithRange(
    typeof value !== 'string' ? JSON.stringify(value || '[]') : value,
    schema.__bodyRange,
    leafLabels,
  );

  const typedBody: string[][] = Array.isArray(body)
    ? body.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell)) : []))
    : [];

  if (typedBody.length === 0) {
    return;
  }
  const leafWidthPercentages = getLeafWidthPercentages(schema.headerTree);

  const syntheticTableSchema: TableSchema = {
    ...schema,
    type: 'table',
    showHead: false,
    head: leafLabels,
    headWidthPercentages: leafWidthPercentages,
    position: {
      x: schema.position.x,
      y: schema.position.y + headerHeight,
    },
    height: schema.height - headerHeight,
  };

  const createTableArgs: CreateTableArgs = {
    schema: syntheticTableSchema,
    basePdf,
    options,
    _cache,
  };

  const table = await createSingleTable(typedBody, createTableArgs);

  // Render body cells
  let rowY = syntheticTableSchema.position.y;
  for (const row of table.body) {
    let colX = syntheticTableSchema.position.x;
    for (const column of table.columns) {
      const bodyCell = row.cells[column.index];
      if (bodyCell) {
        await cellPdfRender({
          ...arg,
          value: bodyCell.raw,
          schema: {
            name: '',
            type: 'cell',
            position: { x: colX, y: rowY },
            width: column.width,
            height: row.height,
            fontName: bodyCell.styles.fontName,
            alignment: bodyCell.styles.alignment,
            verticalAlignment: bodyCell.styles.verticalAlignment,
            fontSize: bodyCell.styles.fontSize,
            lineHeight: bodyCell.styles.lineHeight,
            characterSpacing: bodyCell.styles.characterSpacing,
            backgroundColor: bodyCell.styles.backgroundColor,
            fontColor: bodyCell.styles.textColor,
            borderColor: bodyCell.styles.lineColor,
            borderWidth: bodyCell.styles.lineWidth,
            padding: bodyCell.styles.cellPadding,
          },
        });
      }
      colX += column.width;
    }
    rowY += row.height;
  }

  // Draw table border
  const lineWidth = schema.tableStyles.borderWidth;
  const lineColor = schema.tableStyles.borderColor;
  if (lineWidth && lineColor) {
    await rectanglePdfRender({
      ...arg,
      schema: {
        name: '',
        type: 'rectangle',
        borderWidth: lineWidth,
        borderColor: lineColor,
        color: '',
        position: { x: schema.position.x, y: schema.position.y },
        width: schema.width,
        height: schema.position.y + schema.height - schema.position.y,
        readOnly: true,
      },
    });
  }
};
