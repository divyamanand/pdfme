import type { PropPanel, PropPanelWidgetProps } from '@pdfme/common';
import { DEFAULT_FONT_NAME, getFallbackFontName } from '@pdfme/common';
import type { ExpressionFieldSchema } from './types.js';
import { HEX_COLOR_PATTERN } from '../constants.js';

const ExpressionWidget = (props: PropPanelWidgetProps) => {
  const { rootElement, changeSchemas, activeSchema } = props;

  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.style.cssText =
    'font-family:monospace;font-size:13px;padding:6px 8px;' +
    'border:1px solid #d9d9d9;border-radius:4px;min-height:56px;' +
    'resize:vertical;width:100%;box-sizing:border-box;';
  textarea.placeholder = 'e.g. Number(price) * quantity';

  const currentContent = (activeSchema as unknown as ExpressionFieldSchema)?.content || '';
  textarea.value = currentContent.replace(/^\{/, '').replace(/\}$/, '');

  textarea.addEventListener('blur', () => {
    const val = textarea.value.trim();
    const wrapped = val ? `{${val}}` : '{date}';
    changeSchemas([{ key: 'content', value: wrapped, schemaId: activeSchema.id }]);
  });

  container.appendChild(textarea);

  // Hint
  const hint = document.createElement('small');
  hint.style.cssText = 'color:#888;font-size:11px;line-height:1.4;';
  hint.textContent =
    'Built-ins: date, dateTime, currentPage, totalPages. ' +
    'Use input field names for calculations.';
  container.appendChild(hint);

  rootElement.appendChild(container);
};

export const propPanel: PropPanel<ExpressionFieldSchema> = {
  schema: ({ options, i18n }) => {
    const font = options.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
    const fontNames = Object.keys(font);
    const fallbackFontName = getFallbackFontName(font);

    return {
      expression: {
        title: 'JavaScript Expression',
        type: 'string',
        widget: 'ExpressionWidget',
        bind: false,
        span: 24,
      },
      '---': { type: 'void', widget: 'Divider' },
      fontName: {
        title: i18n('schemas.text.fontName'),
        type: 'string',
        widget: 'select',
        default: fallbackFontName,
        placeholder: fallbackFontName,
        props: { options: fontNames.map((name) => ({ label: name, value: name })) },
        span: 12,
      },
      fontSize: {
        title: i18n('schemas.text.size'),
        type: 'number',
        widget: 'inputNumber',
        props: { min: 1 },
        span: 6,
      },
      characterSpacing: {
        title: i18n('schemas.text.spacing'),
        type: 'number',
        widget: 'inputNumber',
        props: { min: 0 },
        span: 6,
      },
      lineHeight: {
        title: i18n('schemas.text.lineHeight'),
        type: 'number',
        widget: 'inputNumber',
        props: { step: 0.1, min: 0 },
        span: 8,
      },
      alignment: {
        title: i18n('schemas.text.textAlign'),
        type: 'string',
        widget: 'select',
        span: 8,
        props: {
          options: [
            { label: i18n('schemas.left'), value: 'left' },
            { label: i18n('schemas.center'), value: 'center' },
            { label: i18n('schemas.right'), value: 'right' },
          ],
        },
      },
      verticalAlignment: {
        title: i18n('schemas.text.verticalAlign'),
        type: 'string',
        widget: 'select',
        span: 8,
        props: {
          options: [
            { label: i18n('schemas.top'), value: 'top' },
            { label: i18n('schemas.middle'), value: 'middle' },
            { label: i18n('schemas.bottom'), value: 'bottom' },
          ],
        },
      },
      fontColor: {
        title: i18n('schemas.textColor'),
        type: 'string',
        widget: 'color',
        props: { disabledAlpha: true },
        rules: [{ pattern: HEX_COLOR_PATTERN, message: i18n('validation.hexColor') }],
        span: 8,
      },
      backgroundColor: {
        title: i18n('schemas.bgColor'),
        type: 'string',
        widget: 'color',
        props: { disabledAlpha: true },
        rules: [{ pattern: HEX_COLOR_PATTERN, message: i18n('validation.hexColor') }],
        span: 8,
      },
    };
  },
  widgets: { ExpressionWidget },
  defaultSchema: {
    name: '',
    type: 'expressionField',
    content: '{date}',
    readOnly: true,
    position: { x: 0, y: 0 },
    width: 60,
    height: 10,
    fontSize: 13,
    fontColor: '#000000',
    backgroundColor: '',
    alignment: 'left',
    verticalAlignment: 'top',
    lineHeight: 1,
    characterSpacing: 0,
    opacity: 1,
  } as ExpressionFieldSchema,
};
