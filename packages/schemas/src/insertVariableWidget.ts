import type { PropPanelWidgetProps } from '@pdfme/common';

/**
 * Factory function that creates an "Insert Variable" widget for a specific schema field.
 * The widget renders a dropdown of available variables and appends {varName} to the field value.
 *
 * @param targetKey - The schema field key to insert variables into (e.g., 'text', 'content')
 * @returns A PropPanelWidgetProps function that renders the variable picker
 */
export const createInsertVariableWidget = (targetKey: string) => {
  return (props: PropPanelWidgetProps) => {
    const { rootElement, changeSchemas, activeSchema, options } = props;
    const variables = (options as any).variables?.textVariables ?? [];

    console.log('[insertVariableWidget] targetKey:', targetKey)
    console.log('[insertVariableWidget] options:', options)
    console.log('[insertVariableWidget] options.variables:', (options as any).variables)
    console.log('[insertVariableWidget] variables:', variables)
    console.log('[insertVariableWidget] variables.length:', variables.length)

    if (variables.length === 0) {
      console.log('[insertVariableWidget] NO VARIABLES - returning early')
      return;
    }

    console.log('[insertVariableWidget] Creating widget UI...')

    const container = document.createElement('div');
    container.style.cssText =
      'display:flex; gap:6px; align-items:center; margin-bottom:10px; z-index:9999; position:relative;';

    console.log('[insertVariableWidget] rootElement:', rootElement)
    console.log('[insertVariableWidget] rootElement.parentElement:', rootElement.parentElement)
    console.log('[insertVariableWidget] rootElement computed style:', window.getComputedStyle(rootElement))

    const label = document.createElement('span');
    label.textContent = 'Insert Variable:';
    label.style.cssText = 'font-size:12px; color:#666; white-space:nowrap;';

    const select = document.createElement('select');
    select.style.cssText =
      'flex:1; height:30px; border:1px solid #E0E0E0; border-radius:4px; padding:0 8px; font-size:13px; background:#fff; cursor:pointer; z-index:9999;';

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— pick variable —';
    select.appendChild(blank);

    for (const v of variables) {
      const opt = document.createElement('option');
      opt.value = v.value;
      opt.textContent = v.label;
      select.appendChild(opt);
    }

    select.onchange = (e) => {
      const varName = (e.target as HTMLSelectElement).value;
      if (!varName) return;
      const current = String((activeSchema as Record<string, unknown>)[targetKey] ?? '');
      changeSchemas([{ key: targetKey, value: current + `{${varName}}`, schemaId: activeSchema.id }]);
      select.value = '';
    };

    container.appendChild(label);
    container.appendChild(select);
    rootElement.appendChild(container);

    console.log('[insertVariableWidget] Successfully created and appended widget')
  };
};
