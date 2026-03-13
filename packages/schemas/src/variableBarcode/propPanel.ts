import type { PropPanel, PropPanelWidgetProps } from '@pdfme/common';
import type { VariableBarcodeSchema } from './types.js';
import { updateVariablesFromText } from './helper.js';
import {
  DEFAULT_BARCODE_BG_COLOR,
  DEFAULT_BARCODE_COLOR,
  DEFAULT_BARCODE_INCLUDETEXT,
} from '../barcodes/constants.js';
import { DEFAULT_OPACITY, HEX_COLOR_PATTERN } from '../constants.js';
import type { BarcodeTypes } from '../barcodes/types.js';

/** Default sample text per barcode type */
const defaultTextByType: Partial<Record<BarcodeTypes, string>> = {
  qrcode: 'https://pdfme.com/{id}',
  code128: 'ORDER-{orderId}',
  code39: 'CODE-{id}',
  ean13: '212345678900{check}',
  ean8: '0234567{check}',
  nw7: 'A0123{id}B',
  itf14: '0460123456{id}',
  upca: '41600033{id}',
  upce: '0012345{id}',
  japanpost: '6540123789-{id}-K-Z',
  gs1datamatrix: '(01)03453120000011(17)191125(10){lot}',
  pdf417: 'Variable data: {data}',
};

const defaultSizeByType: Partial<Record<BarcodeTypes, { width: number; height: number }>> = {
  qrcode: { width: 30, height: 30 },
  gs1datamatrix: { width: 30, height: 30 },
  japanpost: { width: 80, height: 7.2 },
  ean13: { width: 40, height: 16 },
  itf14: { width: 40, height: 12 },
  upca: { width: 40, height: 16 },
  pdf417: { width: 40, height: 16 },
};

const barcodeHasHumanText = (type: BarcodeTypes) =>
  type !== 'qrcode' && type !== 'gs1datamatrix' && type !== 'pdf417';

/** PropPanel widget: auto-detects simple variables from schema.text, renders a textarea per variable. */
const mapVariableBarcodeVars = (props: PropPanelWidgetProps) => {
  const { rootElement, changeSchemas, activeSchema, i18n, options } = props;
  const schema = activeSchema as unknown as VariableBarcodeSchema;
  const text = schema.text || '';
  const variables = (() => {
    try { return JSON.parse(schema.content || '{}') as Record<string, string>; } catch { return {}; }
  })();

  const changed = updateVariablesFromText(text, variables);
  const varNames = Object.keys(variables);

  if (changed) {
    changeSchemas([
      { key: 'content', value: JSON.stringify(variables), schemaId: activeSchema.id },
      { key: 'variables', value: varNames, schemaId: activeSchema.id },
    ]);
  }

  // Reuse the placeholder row pattern from MVT: hide the placeholder, clone per variable
  const placeholderRowEl = document
    .getElementById('vb-placeholder-var')
    ?.closest('.ant-form-item') as HTMLElement;
  if (!placeholderRowEl) return;
  placeholderRowEl.style.display = 'none';
  (rootElement.parentElement as HTMLElement).style.display = 'block';

  if (varNames.length > 0) {
    for (const varName of varNames) {
      const row = placeholderRowEl.cloneNode(true) as HTMLElement;
      const textarea = row.querySelector('textarea') as HTMLTextAreaElement;
      textarea.id = 'vb-var-' + varName;
      textarea.value = variables[varName];
      textarea.addEventListener('change', (e) => {
        if (varName in variables) {
          variables[varName] = (e.target as HTMLTextAreaElement).value;
          changeSchemas([{ key: 'content', value: JSON.stringify(variables), schemaId: activeSchema.id }]);
        }
      });
      const label = row.querySelector('label') as HTMLLabelElement;
      label.innerText = varName;
      row.style.display = 'block';
      rootElement.appendChild(row);
    }
  } else {
    const para = document.createElement('p');
    const colorValue = options?.theme?.token?.colorPrimary || '#168fe3';
    const safeColor = /^#[0-9A-F]{6}$/i.test(colorValue) ? colorValue : '#168fe3';
    const instructions = i18n('schemas.mvt.typingInstructions');
    const sample = i18n('schemas.mvt.sampleField');
    para.innerHTML = instructions + ` <code style="color:${safeColor};font-weight:bold;">{${sample}}</code>`;
    rootElement.appendChild(para);
  }
};

export const getPropPanelByType = (type: BarcodeTypes): PropPanel<VariableBarcodeSchema> => {
  const hasText = barcodeHasHumanText(type);
  const defaultText = defaultTextByType[type] ?? `{value}`;
  const defaultVars: Record<string, string> = {};
  updateVariablesFromText(defaultText, defaultVars);
  const { width, height } = defaultSizeByType[type] ?? { width: 40, height: 20 };

  return {
    schema: ({ i18n }) => ({
      text: {
        title: 'Template',
        type: 'string',
        format: 'textarea',
        props: { autoSize: { minRows: 2, maxRows: 5 } },
        span: 24,
      },
      '-------': { type: 'void', widget: 'Divider' },
      variablesContainer: {
        title: 'Variables Sample Data',
        type: 'string',
        widget: 'Card',
        span: 24,
        properties: {
          variableFields: {
            type: 'object',
            widget: 'mapVariableBarcodeVars',
            bind: false,
            span: 24,
          },
          vbPlaceholder: {
            title: 'Placeholder Variable',
            type: 'string',
            format: 'textarea',
            props: { id: 'vb-placeholder-var', autoSize: { minRows: 2, maxRows: 5 } },
            span: 24,
          },
        },
      },
      barColor: {
        title: i18n('schemas.barcodes.barColor'),
        type: 'string',
        widget: 'color',
        props: { disabledAlpha: true },
        rules: [{ pattern: HEX_COLOR_PATTERN, message: i18n('validation.hexColor') }],
      },
      backgroundColor: {
        title: i18n('schemas.bgColor'),
        type: 'string',
        widget: 'color',
        props: { disabledAlpha: true },
        rules: [{ pattern: HEX_COLOR_PATTERN, message: i18n('validation.hexColor') }],
      },
      ...(hasText ? {
        textColor: {
          title: i18n('schemas.textColor'),
          type: 'string',
          widget: 'color',
          props: { disabledAlpha: true },
        },
        includetext: {
          title: i18n('schemas.barcodes.includetext'),
          type: 'boolean',
          widget: 'switch',
        },
      } : {}),
    }),
    widgets: { mapVariableBarcodeVars },
    defaultSchema: {
      name: '',
      type,
      text: defaultText,
      variables: Object.keys(defaultVars),
      content: JSON.stringify(defaultVars),
      position: { x: 0, y: 0 },
      width,
      height,
      rotate: 0,
      opacity: DEFAULT_OPACITY,
      backgroundColor: DEFAULT_BARCODE_BG_COLOR,
      barColor: DEFAULT_BARCODE_COLOR,
      ...(hasText ? { textColor: DEFAULT_BARCODE_COLOR, includetext: DEFAULT_BARCODE_INCLUDETEXT } : {}),
    },
  };
};
