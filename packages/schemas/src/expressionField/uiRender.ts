import type { UIRenderProps } from '@pdfme/common';
import type { ExpressionFieldSchema } from './types.js';

const DEFAULT_FONT_SIZE = 13;
const DEFAULT_FONT_COLOR = '#000000';

/**
 * UI rendering for Expression Field.
 *
 * - Designer mode: shows raw expression in teal monospace (code style)
 * - Viewer/Form mode: shows the resolved value with schema styling
 */
export const uiRender = async (arg: UIRenderProps<ExpressionFieldSchema>) => {
  const { value, schema, mode, rootElement } = arg;

  const div = document.createElement('div');
  const isDesigner = mode === 'designer';

  const fontSize = schema.fontSize ?? DEFAULT_FONT_SIZE;
  const fontColor = schema.fontColor ?? DEFAULT_FONT_COLOR;

  Object.assign(div.style, {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: isDesigner ? 'center' : ({
      top: 'flex-start',
      middle: 'center',
      bottom: 'flex-end',
    } as Record<string, string>)[schema.verticalAlignment ?? 'top'] ?? 'flex-start',
    justifyContent: ({
      left: 'flex-start',
      center: 'center',
      right: 'flex-end',
    } as Record<string, string>)[schema.alignment ?? 'left'] ?? 'flex-start',
    padding: '2px 4px',
    boxSizing: 'border-box',
    fontFamily: isDesigner ? 'monospace' : 'inherit',
    fontSize: `${fontSize}px`,
    lineHeight: String(schema.lineHeight ?? 1),
    letterSpacing: schema.characterSpacing ? `${schema.characterSpacing}pt` : undefined,
    color: isDesigner ? '#25c2a0' : fontColor,
    backgroundColor: isDesigner
      ? 'rgba(37,194,160,0.06)'
      : schema.backgroundColor || 'transparent',
    opacity: String(schema.opacity ?? 1),
  });

  // Designer: show raw expression with braces (visually marks it as code)
  // Viewer/Form: show the resolved value
  div.textContent = isDesigner ? (schema.content || '{ expression }') : value;
  rootElement.appendChild(div);
};
