import { Schema, BasePdf, BlankPdf, CommonOptions, isBlankPdf } from '@pdfme/common';
import { createSingleTable } from '../tables/tableHelper.js';
import { getBodyWithRange, getBody } from '../tables/helper.js';
import type { NestedTableSchema } from './types.js';
import { getTreeDepth, getLeafNodes, getLeafWidthPercentages } from './treeUtils.js';

function pt2mm(pt: number): number {
  return pt * 0.352778;
}

export const getDynamicHeightsForNestedTable = async (
  value: string,
  args: {
    schema: Schema;
    basePdf: BasePdf;
    options: CommonOptions;
    _cache: Map<string | number, unknown>;
  }
): Promise<number[]> => {
  if (args.schema.type !== 'nestedTable') return Promise.resolve([args.schema.height]);
  const schema = args.schema as NestedTableSchema;

  // Calculate header height
  const maxDepth = getTreeDepth(schema.headerTree);
  const fontSize = schema.headStyles.fontSize;
  const lineHeight = schema.headStyles.lineHeight;
  const padding = schema.headStyles.padding;
  const singleRowHeight = pt2mm(fontSize) * lineHeight + (padding.top || 0) + (padding.bottom || 0);
  const headerHeight = schema.showHead ? maxDepth * singleRowHeight : 0;

  // Get body
  const body =
    schema.__bodyRange?.start === 0 ? getBody(value) : getBodyWithRange(value, schema.__bodyRange);

  const typedBody: string[][] = Array.isArray(body)
    ? body.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell)) : []))
    : [];

  if (typedBody.length === 0) {
    return [headerHeight];
  }

  // Create synthetic table schema for body
  const leaves = getLeafNodes(schema.headerTree);
  const leafLabels = leaves.map((n) => n.label);
  const leafWidthPercentages = getLeafWidthPercentages(schema.headerTree);
  const syntheticTableSchema: any = {
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

  const createTableArgs = {
    schema: syntheticTableSchema,
    basePdf: args.basePdf,
    options: args.options,
    _cache: args._cache,
  };

  const table = await createSingleTable(typedBody, createTableArgs);
  const bodyHeights = table.body.map((row) => row.height);

  // Header is indivisible; body rows are individually breakable
  const shouldRepeatHeader = schema.repeatHead && isBlankPdf(args.basePdf) && headerHeight > 0;

  if (!shouldRepeatHeader) {
    return [headerHeight, ...bodyHeights];
  }

  // Apply header repetition logic
  const basePdf = args.basePdf as BlankPdf;
  const [paddingTop, , paddingBottom] = basePdf.padding;
  const pageContentHeight = basePdf.height - paddingTop - paddingBottom;
  const getPageStartY = (pageIndex: number) => pageIndex * pageContentHeight + paddingTop;

  const initialPageIndex = Math.max(
    0,
    Math.floor((schema.position.y - paddingTop) / pageContentHeight)
  );
  const SAFETY_MARGIN = 0.5;

  let currentPageIndex = initialPageIndex;
  let currentPageY = schema.position.y;
  let rowsOnCurrentPage = 0;
  const result: number[] = [headerHeight];

  for (let i = 0; i < bodyHeights.length; i++) {
    const rowHeight = bodyHeights[i];

    while (true) {
      const currentPageStartY = getPageStartY(currentPageIndex);
      const remainingHeight = currentPageStartY + pageContentHeight - currentPageY;
      const needsHeader = rowsOnCurrentPage === 0 && currentPageIndex > initialPageIndex;
      const totalRowHeight = rowHeight + (needsHeader ? headerHeight : 0);

      if (totalRowHeight > remainingHeight - SAFETY_MARGIN) {
        if (
          rowsOnCurrentPage === 0 &&
          Math.abs(currentPageY - currentPageStartY) < SAFETY_MARGIN
        ) {
          result.push(totalRowHeight);
          currentPageY += totalRowHeight;
          rowsOnCurrentPage++;
          break;
        }
        currentPageIndex++;
        currentPageY = getPageStartY(currentPageIndex);
        rowsOnCurrentPage = 0;
        continue;
      }

      result.push(totalRowHeight);
      currentPageY += totalRowHeight;
      rowsOnCurrentPage++;

      if (currentPageY >= currentPageStartY + pageContentHeight - SAFETY_MARGIN) {
        currentPageIndex++;
        currentPageY = getPageStartY(currentPageIndex);
        rowsOnCurrentPage = 0;
      }
      break;
    }
  }

  return result;
};
