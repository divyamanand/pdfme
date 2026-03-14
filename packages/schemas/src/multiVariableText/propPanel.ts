import { propPanel as parentPropPanel } from '../text/propPanel.js';
import { createInsertVariableWidget } from '../insertVariableWidget.js';
import { PropPanel, PropPanelWidgetProps } from '@pdfme/common';
import { MultiVariableTextSchema } from './types.js';

const insertVariableWidget = createInsertVariableWidget('text');

const mapDynamicVariables = (props: PropPanelWidgetProps) => {
  const { rootElement, changeSchemas, activeSchema, i18n, options } = props;

  const mvtSchema = activeSchema as unknown as MultiVariableTextSchema;
  const text = mvtSchema.text ?? '';
  if (!text) {
    // Static mode: no template text, no variables to manage
    rootElement.style.display = 'none';
    return;
  }
  const variables = JSON.parse(mvtSchema.content || '{}') as Record<string, string>;
  const variablesChanged = updateVariablesFromText(text, variables);
  const varNames = Object.keys(variables);

  if (variablesChanged) {
    changeSchemas([
      { key: 'content', value: JSON.stringify(variables), schemaId: activeSchema.id },
      { key: 'variables', value: varNames, schemaId: activeSchema.id },
      { key: 'readOnly', value: varNames.length === 0, schemaId: activeSchema.id },
    ]);
  }

  const placeholderRowEl = document
    .getElementById('placeholder-dynamic-var')
    ?.closest('.ant-form-item') as HTMLElement;
  if (!placeholderRowEl) {
    throw new Error('Failed to find Ant form placeholder row to create dynamic variables inputs.');
  }
  placeholderRowEl.style.display = 'none';

  // The wrapping form element has a display:flex which limits the width of the form fields, removing.
  (rootElement.parentElement as HTMLElement).style.display = 'block';

  if (varNames.length > 0) {
    for (let variableName of varNames) {
      const varRow = placeholderRowEl.cloneNode(true) as HTMLElement;

      const textarea = varRow.querySelector('textarea') as HTMLTextAreaElement;
      textarea.id = 'dynamic-var-' + variableName;
      textarea.value = variables[variableName];
      textarea.addEventListener('change', (e: Event) => {
        if (variableName in variables) {
          variables[variableName] = (e.target as HTMLTextAreaElement).value;
          changeSchemas([
            { key: 'content', value: JSON.stringify(variables), schemaId: activeSchema.id },
          ]);
        }
      });

      const label = varRow.querySelector('label') as HTMLLabelElement;
      label.innerText = variableName;

      varRow.style.display = 'block';
      rootElement.appendChild(varRow);
    }
  } else {
    const para = document.createElement('p');
    // Extract color value to avoid unsafe property access
    const colorValue = options?.theme?.token?.colorPrimary || '#168fe3';
    const isValidColor =
      /^#[0-9A-F]{6}$/i.test(colorValue) ||
      /^(rgb|hsl)a?\(\s*([+-]?\d+%?\s*,\s*){2,3}[+-]?\d+%?\s*\)$/i.test(colorValue);
    const safeColorValue = isValidColor ? colorValue : '#168fe3';

    // Use safe string concatenation for innerHTML
    const typingInstructions = i18n('schemas.mvt.typingInstructions');
    const sampleField = i18n('schemas.mvt.sampleField');
    para.innerHTML =
      typingInstructions +
      ` <code style="color:${safeColorValue}; font-weight:bold;">{` +
      sampleField +
      '}</code>';
    rootElement.appendChild(para);
  }
};

export const propPanel: PropPanel<MultiVariableTextSchema> = {
  schema: (propPanelProps: Omit<PropPanelWidgetProps, 'rootElement'>) => {
    if (typeof parentPropPanel.schema !== 'function') {
      throw new Error('Oops, is text schema no longer a function?');
    }
    // Safely call schema function with proper type handling
    const parentSchema =
      typeof parentPropPanel.schema === 'function' ? parentPropPanel.schema(propPanelProps) : {};
    return {
      insertVariablePicker: {
        type: 'void',
        widget: 'insertVariableWidget',
        bind: false,
        span: 24,
      },
      '----': { type: 'void', widget: 'Divider' },
      ...parentSchema,
      '-------': { type: 'void', widget: 'Divider' },
      dynamicVarContainer: {
        title: 'Variables Sample Data',
        type: 'string',
        widget: 'Card',
        span: 24,
        properties: {
          dynamicVariables: {
            type: 'object',
            widget: 'mapDynamicVariables',
            bind: false,
            span: 24,
          },
          placeholderDynamicVar: {
            title: 'Placeholder Dynamic Variable',
            type: 'string',
            format: 'textarea',
            props: {
              id: 'placeholder-dynamic-var',
              autoSize: {
                minRows: 2,
                maxRows: 5,
              },
            },
            span: 24,
          },
        },
      },
    };
  },
  widgets: { ...(parentPropPanel.widgets || {}), mapDynamicVariables, insertVariableWidget },
  defaultSchema: {
    ...parentPropPanel.defaultSchema,
    readOnly: false,
    type: 'text',
    text: 'Type Something...',
    width: 50,
    height: 15,
    content: '{}',
    variables: [],
  },
};

/** Known JS globals/keywords that should NOT be treated as user-defined variables */
const RESERVED_NAMES = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in',
  'void', 'delete', 'new', 'this', 'NaN', 'Infinity',
  'Math', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'JSON',
  'isNaN', 'parseFloat', 'parseInt', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'date', 'dateTime',
  'currentPage', 'totalPages',
]);

/**
 * Extract user-defined identifiers from an expression string.
 * Skips member-access properties (after `.`), string literals, and reserved names.
 */
const extractIdentifiers = (expr: string): string[] => {
  const cleaned = expr.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
  const tokenRegex = /\.?[a-zA-Z_$][a-zA-Z0-9_$]*/g;
  const ids = new Set<string>();
  let m;
  while ((m = tokenRegex.exec(cleaned)) !== null) {
    const token = m[0];
    if (token.startsWith('.')) continue;
    if (!RESERVED_NAMES.has(token)) ids.add(token);
  }
  return Array.from(ids);
};

const updateVariablesFromText = (text: string, variables: Record<string, string>): boolean => {
  // Find all {...} blocks and extract user-defined identifiers from each
  const blockRegex = /\{([^{}]+)\}/g;
  const allVarNames = new Set<string>();
  let blockMatch;
  while ((blockMatch = blockRegex.exec(text)) !== null) {
    for (const id of extractIdentifiers(blockMatch[1])) {
      allVarNames.add(id);
    }
  }

  let changed = false;
  for (const varName of allVarNames) {
    if (!(varName in variables)) {
      variables[varName] = varName.toUpperCase();
      changed = true;
    }
  }
  for (const varName of Object.keys(variables)) {
    if (!allVarNames.has(varName)) {
      delete variables[varName];
      changed = true;
    }
  }
  return changed;
};
