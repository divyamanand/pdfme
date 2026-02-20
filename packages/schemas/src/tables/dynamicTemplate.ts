import { Schema, BasePdf, BlankPdf, CommonOptions, isBlankPdf, getPagePadding } from '@pdfme/common';
import { createSingleTable } from './tableHelper.js';
import { getBodyWithRange, getBody } from './helper.js';
import { TableSchema } from './types.js';

export const getDynamicHeightsForTable = async (
  value: string,
  args: {
    schema: Schema;
    basePdf: BasePdf;
    options: CommonOptions;
    _cache: Map<string | number, unknown>;
  },
): Promise<number[]> => {
  if (args.schema.type !== 'table') return Promise.resolve([args.schema.height]);
  const schema = args.schema as TableSchema;
  const body =
    schema.__bodyRange?.start === 0
      ? getBody(value, schema.head)
      : getBodyWithRange(value, schema.__bodyRange, schema.head);
  const table = await createSingleTable(body, args);

  const baseHeights = schema.showHead
    ? table.allRows().map((row) => row.height)
    : [0].concat(table.body.map((row) => row.height));

  const headerHeight = schema.showHead ? table.getHeadHeight() : 0;
  const shouldRepeatHeader = schema.repeatHead && isBlankPdf(args.basePdf) && headerHeight > 0;

  if (!shouldRepeatHeader) {
    return baseHeights;
  }

  const basePdf = args.basePdf as BlankPdf;
  // First, estimate initial page with default padding to get the right page index
  const roughPageIndex = Math.max(0, Math.floor((schema.position.y - 10) / (basePdf.height - 20)));
  const [paddingTop, , paddingBottom] = getPagePadding(basePdf, roughPageIndex);
  const pageContentHeight = basePdf.height - paddingTop - paddingBottom;
  const getPageStartY = (pageIndex: number) => pageIndex * pageContentHeight + paddingTop;

  // Now calculate the accurate initial page index using the actual padding
  const initialPageIndex = Math.max(
    0,
    Math.floor((schema.position.y - paddingTop) / pageContentHeight),
  );
  const headRowCount = schema.showHead ? table.head.length : 0;
  const SAFETY_MARGIN = 0.5;

  let currentPageIndex = initialPageIndex;
  let currentPageY = schema.position.y;
  let rowsOnCurrentPage = 0;

  const result: number[] = [];

  for (let i = 0; i < baseHeights.length; i++) {
    const isBodyRow = i >= headRowCount;
    const rowHeight = baseHeights[i];

    while (true) {
      const currentPageStartY = getPageStartY(currentPageIndex);
      const remainingHeight = currentPageStartY + pageContentHeight - currentPageY;
      const needsHeader =
        isBodyRow && rowsOnCurrentPage === 0 && currentPageIndex > initialPageIndex;
      const totalRowHeight = rowHeight + (needsHeader ? headerHeight : 0);

      if (totalRowHeight > remainingHeight - SAFETY_MARGIN) {
        if (rowsOnCurrentPage === 0 && Math.abs(currentPageY - currentPageStartY) < SAFETY_MARGIN) {
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
