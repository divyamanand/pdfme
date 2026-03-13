import type * as CSS from 'csstype';
import { UIRenderProps } from '@pdfme/common';
import type { VariableBarcodeSchema } from './types.js';
import { createBarCode, validateBarcodeInput } from '../barcodes/helper.js';
import { addAlphaToHex, createErrorElm, isEditable } from '../utils.js';
import { substituteVariables } from '../multiVariableText/helper.js';
import { updateVariablesFromText } from './helper.js';

const fullSize: CSS.Properties = { width: '100%', height: '100%' };

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const renderBarcodePreview = async (
  schema: VariableBarcodeSchema,
  resolved: string,
  container: HTMLElement,
): Promise<void> => {
  // Remove any existing barcode image
  container.querySelectorAll('img').forEach((img) => img.remove());
  container.querySelectorAll('.barcode-error').forEach((el) => el.remove());

  if (!resolved) return;
  try {
    if (!validateBarcodeInput(schema.type, resolved))
      throw new Error('Invalid barcode input');
    const imageBuf = await createBarCode({ ...schema, type: schema.type, input: resolved });
    const blob = new Blob([new Uint8Array(imageBuf)], { type: 'image/png' });
    const dataURL = await blobToDataURL(blob);
    const img = document.createElement('img');
    img.src = dataURL;
    Object.assign(img.style, { ...fullSize, borderRadius: 0 });
    container.appendChild(img);
  } catch {
    const err = createErrorElm();
    err.classList.add('barcode-error');
    container.appendChild(err);
  }
};

export const uiRender = async (arg: UIRenderProps<VariableBarcodeSchema>): Promise<void> => {
  const { value, schema, rootElement, mode, onChange, stopEditing, tabIndex, placeholder, theme, pageContext } = arg;

  // Determine if this is a dynamic (template) barcode or a static (direct value) barcode
  const isDynamic = Boolean(schema.text);

  const container = document.createElement('div');
  Object.assign(container.style, {
    ...fullSize,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Open Sans', sans-serif",
    boxSizing: 'border-box',
    overflow: 'hidden',
  } as CSS.Properties);
  rootElement.appendChild(container);

  if (!isDynamic) {
    // ── Static barcode mode: same UX as the original barcodes plugin ──
    const editable = isEditable(mode, schema);
    if (editable) {
      const input = document.createElement('input');
      Object.assign(input.style, {
        width: '100%',
        position: 'absolute',
        textAlign: 'center',
        fontSize: '12pt',
        fontWeight: 'bold',
        color: theme.colorWhite,
        backgroundColor: editable || value ? addAlphaToHex('#000000', 80) : 'none',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      } as CSS.Properties);
      input.value = value;
      input.placeholder = placeholder || '';
      input.tabIndex = tabIndex || 0;
      input.addEventListener('change', (e: Event) => {
        if (onChange) onChange({ key: 'content', value: (e.target as HTMLInputElement).value });
      });
      input.addEventListener('blur', () => {
        if (stopEditing) stopEditing();
      });
      container.appendChild(input);
      input.setSelectionRange(value.length, value.length);
      if (mode === 'designer') {
        input.focus();
      }
    }

    if (!value) return;
    try {
      if (!validateBarcodeInput(schema.type, value))
        throw new Error('Invalid barcode input');
      const imageBuf = await createBarCode({ ...schema, type: schema.type, input: value });
      const blob = new Blob([new Uint8Array(imageBuf)], { type: 'image/png' });
      const dataURL = await blobToDataURL(blob);
      const img = document.createElement('img');
      img.src = dataURL;
      Object.assign(img.style, { ...fullSize, borderRadius: 0 });
      container.appendChild(img);
    } catch {
      container.appendChild(createErrorElm());
    }
    return;
  }

  // ── Dynamic barcode mode: template with variables + expressions ──
  const variables: Record<string, string> = (() => {
    try {
      return value ? (JSON.parse(value) as Record<string, string>) : {};
    } catch {
      return {};
    }
  })();

  const resolved = substituteVariables(schema.text || '', variables, pageContext);

  if (mode === 'designer') {
    // Designer: show a semi-transparent text input for the template string + barcode preview
    const input = document.createElement('input');
    Object.assign(input.style, {
      width: '100%',
      position: 'absolute',
      textAlign: 'center',
      fontSize: '10pt',
      fontWeight: 'bold',
      color: theme.colorWhite,
      backgroundColor: addAlphaToHex('#000000', 80),
      border: 'none',
      top: 0,
      zIndex: '1',
    } as CSS.Properties);
    input.value = schema.text || '';
    input.placeholder = 'Template e.g. https://app.com/{id}';

    let debounceTimer: ReturnType<typeof setTimeout>;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newText = input.value;
        const vars = (() => {
          try { return JSON.parse(schema.content || '{}') as Record<string, string>; } catch { return {}; }
        })();
        const changed = updateVariablesFromText(newText, vars);
        const changes: { key: string; value: unknown }[] = [{ key: 'text', value: newText }];
        if (changed) {
          changes.push({ key: 'content', value: JSON.stringify(vars) });
          changes.push({ key: 'variables', value: Object.keys(vars) });
        }
        if (onChange) onChange(changes);
        const r = substituteVariables(newText, vars, pageContext);
        void renderBarcodePreview(schema, r, previewWrap);
      }, 300);
    });
    container.appendChild(input);

    const previewWrap = document.createElement('div');
    Object.assign(previewWrap.style, { ...fullSize, position: 'relative' } as CSS.Properties);
    container.appendChild(previewWrap);
    await renderBarcodePreview(schema, resolved, previewWrap);

  } else if (mode === 'form' && schema.variables && schema.variables.length > 0) {
    // Form mode: one labeled input per variable + live barcode preview
    if (rootElement.parentElement) {
      rootElement.parentElement.style.outline = '';
    }

    const fieldsWrap = document.createElement('div');
    Object.assign(fieldsWrap.style, {
      width: '100%',
      padding: '4px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    } as CSS.Properties);

    const previewWrap = document.createElement('div');
    Object.assign(previewWrap.style, {
      width: '100%',
      flex: '1',
      minHeight: '40px',
    } as CSS.Properties);

    const refreshPreview = () => {
      const r = substituteVariables(schema.text || '', variables, pageContext);
      void renderBarcodePreview(schema, r, previewWrap);
    };

    for (const varName of schema.variables) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '4px' } as CSS.Properties);

      const label = document.createElement('label');
      label.textContent = varName + ':';
      Object.assign(label.style, { fontSize: '10px', whiteSpace: 'nowrap', color: theme.colorText } as CSS.Properties);

      const input = document.createElement('input');
      input.type = 'text';
      input.value = variables[varName] ?? '';
      Object.assign(input.style, {
        flex: '1',
        fontSize: '10px',
        border: `1px dashed ${theme.colorPrimary}`,
        borderRadius: '2px',
        padding: '1px 4px',
        outline: 'none',
      } as CSS.Properties);

      input.addEventListener('input', (e) => {
        variables[varName] = (e.target as HTMLInputElement).value;
        if (onChange) onChange({ key: 'content', value: JSON.stringify(variables) });
        refreshPreview();
      });

      row.appendChild(label);
      row.appendChild(input);
      fieldsWrap.appendChild(row);
    }

    container.appendChild(fieldsWrap);
    container.appendChild(previewWrap);
    await renderBarcodePreview(schema, resolved, previewWrap);

  } else {
    // Viewer mode (or form with no variables): show resolved barcode
    await renderBarcodePreview(schema, resolved, container);
  }
};
