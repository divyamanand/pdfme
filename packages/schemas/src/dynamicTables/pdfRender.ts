/**
 * PDF Renderer for the Dynamic Table pdfme plugin.
 *
 * Iterates through the RenderableTableInstance and delegates each cell's
 * rendering to pdfme's existing cell plugin (which uses rectangle, line,
 * and text renderers internally).
 */

import type { PDFRenderProps } from '@pdfme/common';
import cell from '../tables/cell.js';
import { rectangle } from '../shapes/rectAndEllipse.js';
import type { Region } from './engine/index.js';
import type { DynamicTableSchema } from './types.js';
import { instanceManager } from './instanceManager.js';
import { toPdfmeCellSchema, getCellDisplayValue } from './helpers/cellSchemaMapper.js';

const cellPdfRender = cell.pdf;
const rectanglePdfRender = rectangle.pdf;

/** Region iteration order */
const REGION_ORDER: Region[] = ['theader', 'lheader', 'rheader', 'body', 'footer'];

/**
 * pdfme pdf() function for the dynamic table plugin.
 *
 * Flow:
 * 1. Parse value → Table → RenderableTableInstance (via InstanceManager)
 * 2. Iterate all regions → rows → cells
 * 3. For each cell: map to PdfmeCellSchema, delegate to cellPdfRender
 * 4. Draw table outer border via rectanglePdfRender
 */
export async function pdfRender(arg: PDFRenderProps<DynamicTableSchema>): Promise<void> {
  const { value, schema } = arg;
  const { renderable } = instanceManager.getOrCreate(schema.name, value);

  const offsetX = schema.position.x;
  const offsetY = schema.position.y;
  const { settings } = renderable;

  // Draw cells region by region
  for (const region of REGION_ORDER) {
    // Skip hidden headers
    if (region === 'theader' && settings.headerVisibility?.theader === false) continue;
    if (region === 'lheader' && settings.headerVisibility?.lheader === false) continue;
    if (region === 'rheader' && settings.headerVisibility?.rheader === false) continue;

    const rows = renderable.getRowsInRegion(region);
    for (const row of rows) {
      for (const [_colIdx, cell] of row.cells) {
        const cellSchema = toPdfmeCellSchema(cell, offsetX, offsetY);
        const displayValue = getCellDisplayValue(cell);

        await cellPdfRender({
          ...arg,
          value: displayValue,
          schema: cellSchema as any,
        });
      }
    }
  }

  // Draw table outer border
  const { tableStyle } = renderable;
  if (tableStyle.borderWidth) {
    const borderWidth = tableStyle.borderWidth.top ?? 0.1;
    const borderColor = tableStyle.borderColor ?? '#000000';

    await rectanglePdfRender({
      ...arg,
      schema: {
        name: '',
        type: 'rectangle',
        position: { x: offsetX, y: offsetY },
        width: renderable.getWidth(),
        height: renderable.getHeight(),
        borderWidth,
        borderColor,
        color: '',
        readOnly: true,
      } as any,
    });
  }
}
