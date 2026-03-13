import { getDefaultFont, UIRenderProps } from '@pdfme/common';
import { MultiVariableTextSchema } from './types.js';
import {
  uiRender as parentUiRender,
  buildStyledTextContainer,
  makeElementPlainTextContentEditable,
} from '../text/uiRender.js';
import { isEditable } from '../utils.js';
import { getFontKitFont } from '../text/helper.js';
import { substituteVariables } from './helper.js';

export const uiRender = async (arg: UIRenderProps<MultiVariableTextSchema>) => {
  const { value, schema, rootElement, mode, onChange, pageContext, ...rest } = arg;

  // Static mode: no template text → delegate to plain text behavior
  if (!schema.text) {
    await parentUiRender(arg as unknown as UIRenderProps<import('../text/types.js').TextSchema>);
    return;
  }

  // Dynamic mode: template with optional variables
  let text = schema.text;
  let numVariables = (schema.variables || []).length;

  if (mode === 'form' && numVariables > 0) {
    await formUiRender(arg);
    return;
  }

  await parentUiRender({
    value: isEditable(mode, schema) ? text : substituteVariables(text, value, pageContext),
    schema,
    mode: mode === 'form' ? 'viewer' : mode, // if no variables for form it's just a viewer
    rootElement,
    onChange: (arg: { key: string; value: unknown } | { key: string; value: unknown }[]) => {
      if (!Array.isArray(arg)) {
        if (onChange) {
          onChange({ key: 'text', value: arg.value });
        }
      } else {
        throw new Error('onChange is not an array, the parent text plugin has changed...');
      }
    },
    ...rest,
  });

  const textBlock = rootElement.querySelector('#text-' + String(schema.id)) as HTMLDivElement;
  if (!textBlock) {
    throw new Error('Text block not found. Ensure the text block has an id of "text-" + schema.id');
  }

  if (mode === 'designer') {
    textBlock.addEventListener('keyup', (event: KeyboardEvent) => {
      text = textBlock.textContent || '';
      if (keyPressShouldBeChecked(event)) {
        const newNumVariables = countUniqueVariableNames(text);
        if (numVariables !== newNumVariables) {
          if (onChange) {
            onChange({ key: 'text', value: text });
          }
          numVariables = newNumVariables;
        }
      }
    });
  }
};

/** Re-evaluate all expression spans inside a container using current variable values */
const refreshExpressionSpans = (container: HTMLElement, variables: Record<string, string>, pageCtx?: Record<string, unknown>) => {
  container.querySelectorAll('[data-expr]').forEach((span) => {
    const expr = span.getAttribute('data-expr')!;
    (span as HTMLElement).textContent = substituteVariables(`{${expr}}`, variables, pageCtx);
  });
};

const formUiRender = async (arg: UIRenderProps<MultiVariableTextSchema>) => {
  const { value, schema, rootElement, onChange, stopEditing, theme, _cache, options, pageContext } = arg;
  const rawText = schema.text!;

  if (rootElement.parentElement) {
    // remove the outline for the whole schema, we'll apply outlines on each individual variable field instead
    rootElement.parentElement.style.outline = '';
  }

  const variables: Record<string, string> = value
    ? (JSON.parse(value) as Record<string, string>) || {}
    : {};
  const substitutedText = substituteVariables(rawText, variables, pageContext);
  const font = options?.font || getDefaultFont();
  const fontKitFont = await getFontKitFont(
    schema.fontName,
    font,
    _cache as Map<string, import('fontkit').Font>,
  );

  const textBlock = buildStyledTextContainer(arg, fontKitFont, substitutedText);

  // Tokenize rawText into static text, simple-identifier variables (editable), and
  // complex expressions (evaluated, static). This supports both {name} and {price * 1.1}.
  const tokens = tokenizeTemplate(rawText, variables, pageContext);

  // Find variables that have inline editable spans (standalone {var} tokens)
  const inlineVarNames = new Set(
    tokens.filter((t): t is Extract<TemplateToken, { type: 'simpleVar' }> => t.type === 'simpleVar')
      .map(t => t.name),
  );
  // Variables that only appear inside expressions — need separate input fields
  const expressionOnlyVars = (schema.variables || []).filter(v => !inlineVarNames.has(v));

  if (expressionOnlyVars.length > 0) {
    const varSection = document.createElement('div');
    Object.assign(varSection.style, {
      width: '100%',
      padding: '2px 4px',
      boxSizing: 'border-box',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      marginBottom: '2px',
    });

    for (const varName of expressionOnlyVars) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '2px' });

      const label = document.createElement('label');
      label.textContent = varName + ':';
      Object.assign(label.style, {
        fontSize: '9px', whiteSpace: 'nowrap', color: theme.colorText,
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.value = variables[varName] ?? '';
      Object.assign(input.style, {
        width: '60px',
        fontSize: '9px',
        border: `1px dashed ${theme.colorPrimary}`,
        borderRadius: '2px',
        padding: '1px 3px',
        outline: 'none',
      });

      input.addEventListener('input', (e) => {
        variables[varName] = (e.target as HTMLInputElement).value;
        if (onChange) onChange({ key: 'content', value: JSON.stringify(variables) });
        refreshExpressionSpans(textBlock, variables, pageContext);
      });

      row.appendChild(label);
      row.appendChild(input);
      varSection.appendChild(row);
    }

    rootElement.insertBefore(varSection, textBlock);
  }

  for (const token of tokens) {
    if (token.type === 'text') {
      const span = document.createElement('span');
      span.style.letterSpacing = 'inherit';
      span.textContent = token.text;
      textBlock.appendChild(span);
    } else if (token.type === 'simpleVar') {
      const varName = token.name;
      const span = document.createElement('span');
      span.style.outline = `${theme.colorPrimary} dashed 1px`;
      makeElementPlainTextContentEditable(span);
      span.textContent = variables[varName] ?? '';
      span.addEventListener('blur', (e: Event) => {
        const newValue = (e.target as HTMLSpanElement).textContent || '';
        if (newValue !== variables[varName]) {
          variables[varName] = newValue;
          if (onChange) onChange({ key: 'content', value: JSON.stringify(variables) });
          if (stopEditing) stopEditing();
          refreshExpressionSpans(textBlock, variables, pageContext);
        }
      });
      textBlock.appendChild(span);
    } else {
      // Complex expression — show evaluated result as static span with data-expr for re-evaluation
      const span = document.createElement('span');
      span.style.letterSpacing = 'inherit';
      span.textContent = token.evaluated;
      span.setAttribute('data-expr', token.raw);
      textBlock.appendChild(span);
    }
  }
};

// Simple identifier regex — matches {name}, {orderId}, etc. but NOT {price * 1.1}
const SIMPLE_VAR_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

type TemplateToken =
  | { type: 'text'; text: string }
  | { type: 'simpleVar'; name: string }
  | { type: 'expression'; evaluated: string; raw: string };

/** Tokenize a template string into static text, simple-identifier vars, and complex expressions. */
const tokenizeTemplate = (
  rawText: string,
  variables: Record<string, string>,
  pageCtx?: Record<string, unknown>,
): TemplateToken[] => {
  const tokens: TemplateToken[] = [];
  let i = 0;
  while (i < rawText.length) {
    if (rawText[i] !== '{') {
      const start = i;
      while (i < rawText.length && rawText[i] !== '{') i++;
      tokens.push({ type: 'text', text: rawText.slice(start, i) });
    } else {
      // Find matching closing brace (handle nested braces)
      let depth = 1;
      let j = i + 1;
      while (j < rawText.length && depth > 0) {
        if (rawText[j] === '{') depth++;
        else if (rawText[j] === '}') depth--;
        j++;
      }
      const inner = rawText.slice(i + 1, j - 1);
      if (SIMPLE_VAR_RE.test(inner)) {
        tokens.push({ type: 'simpleVar', name: inner });
      } else {
        // Evaluate the expression using substituteVariables on just this segment
        const evaluated = substituteVariables(`{${inner}}`, variables, pageCtx);
        tokens.push({ type: 'expression', evaluated, raw: inner });
      }
      i = j;
    }
  }
  return tokens;
};

/** Reserved names — JS globals and expression builtins (must match propPanel's set) */
const RESERVED_NAMES = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in',
  'void', 'delete', 'new', 'this', 'NaN', 'Infinity',
  'Math', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'JSON',
  'isNaN', 'parseFloat', 'parseInt', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'date', 'dateTime',
  'currentPage', 'totalPages',
]);

/** Count unique user-defined variable identifiers in all {...} blocks */
const countUniqueVariableNames = (content: string) => {
  const blockRegex = /\{([^{}]+)\}/g;
  const allIds = new Set<string>();
  let blockMatch;
  while ((blockMatch = blockRegex.exec(content)) !== null) {
    const cleaned = blockMatch[1].replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
    const tokenRegex = /\.?[a-zA-Z_$][a-zA-Z0-9_$]*/g;
    let m;
    while ((m = tokenRegex.exec(cleaned)) !== null) {
      const token = m[0];
      if (!token.startsWith('.') && !RESERVED_NAMES.has(token)) {
        allIds.add(token);
      }
    }
  }
  return allIds.size;
};

/**
 * An optimisation to try to minimise jank while typing.
 * Only check whether variables were modified based on certain key presses.
 * Regex would otherwise be performed on every key press (which isn't terrible, but this code helps).
 */
const keyPressShouldBeChecked = (event: KeyboardEvent) => {
  if (
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight'
  ) {
    return false;
  }

  const selection = window.getSelection();
  const contenteditable = event.target as HTMLDivElement;

  const isCursorAtEnd = selection?.focusOffset === contenteditable?.textContent?.length;
  if (isCursorAtEnd) {
    return event.key === '}' || event.key === 'Backspace' || event.key === 'Delete';
  }

  const isCursorAtStart = selection?.anchorOffset === 0;
  if (isCursorAtStart) {
    return event.key === '{' || event.key === 'Backspace' || event.key === 'Delete';
  }

  return true;
};
