/**
 * PDF Renderer for the Dynamic Table pdfme plugin.
 *
 * Pure read-only rendering from Table.getRenderSnapshot().
 */

import type { PDFRenderProps } from '@pdfme/common';
import cell from '../tables/cell.js';
import { rectangle } from '../shapes/rectAndEllipse.js';
import type { Region } from './engine/index.js';
import type { DynamicTableSchema } from './types.js';
import { getTable } from './instanceManager.js';
import { toPdfmeCellSchema, getCellDisplayValue } from './helpers/cellSchemaMapper.js';

const cellPdfRender = cell.pdf;
const rectanglePdfRender = rectangle.pdf;

/** Region iteration order */
const REGION_ORDER: Region[] = ['theader', 'lheader', 'rheader', 'body', 'footer'];

export async function pdfRender(arg: PDFRenderProps<DynamicTableSchema>): Promise<void> {
  const { value, schema } = arg;
  const table = getTable(schema.name, value);
  const snapshot = table.getRenderSnapshot();

  const offsetX = schema.position.x;
  const offsetY = schema.position.y;
  const { settings } = snapshot;

  for (const region of REGION_ORDER) {
    if (region === 'theader' && settings.headerVisibility?.theader === false) continue;
    if (region === 'lheader' && settings.headerVisibility?.lheader === false) continue;
    if (region === 'rheader' && settings.headerVisibility?.rheader === false) continue;

    const rows = snapshot.getRowsInRegion(region);
    for (const row of rows) {
      for (const [_colIdx, c] of row.cells) {
        const cellSchema = toPdfmeCellSchema(c, offsetX, offsetY);
        const displayValue = getCellDisplayValue(c);

        await cellPdfRender({
          ...arg,
          value: displayValue,
          schema: cellSchema as any,
        });
      }
    }
  }

  const { tableStyle } = snapshot;
  if (tableStyle.borderWidth) {
    const borderWidth = tableStyle.borderWidth.top ?? 0.1;
    const borderColor = tableStyle.borderColor ?? '#000000';

    await rectanglePdfRender({
      ...arg,
      schema: {
        name: '',
        type: 'rectangle',
        position: { x: offsetX, y: offsetY },
        width: snapshot.getWidth(),
        height: snapshot.getHeight(),
        borderWidth,
        borderColor,
        color: '',
        readOnly: true,
      } as any,
    });
  }
}
