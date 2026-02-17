import type { PropPanel } from '@pdfme/common';
import type { NestedTableSchema, NestedHeaderNode } from './types.js';
import { getFallbackFontName, DEFAULT_FONT_NAME } from '@pdfme/common';
import {
  getDefaultCellStyles,
  getCellPropPanelSchema,
  getColumnStylesPropPanelSchema,
} from '../tables/helper.js';
import { HEX_COLOR_PATTERN } from '../constants.js';
import {
  addChildToNode,
  removeNode,
  renameNode,
  generateNodeId,
  getLeafNodes,
} from './treeUtils.js';

export const propPanel: PropPanel<NestedTableSchema> = {
  schema: ({ activeSchema, options, i18n }) => {
    // @ts-expect-error Type casting is necessary here as the activeSchema type is generic
    const nestedTableSchema = activeSchema as NestedTableSchema;
    const showHead = nestedTableSchema.showHead || false;
    const font = options.font || { [DEFAULT_FONT_NAME]: { data: '', fallback: true } };
    const fontNames = Object.keys(font);
    const fallbackFontName = getFallbackFontName(font);
    const leafLabels = getLeafNodes(nestedTableSchema.headerTree || []).map(l => l.label);

    return {
      showHead: {
        title: i18n('schemas.table.showHead'),
        type: 'boolean',
        widget: 'checkbox',
        span: 12,
      },
      repeatHead: {
        title: i18n('schemas.table.repeatHead'),
        type: 'boolean',
        widget: 'checkbox',
        span: 12,
      },
      '-------': { type: 'void', widget: 'Divider' },
      tableStyles: {
        title: i18n('schemas.table.tableStyle'),
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: {
          borderWidth: {
            title: i18n('schemas.borderWidth'),
            type: 'number',
            widget: 'inputNumber',
            props: { min: 0, step: 0.1 },
          },
          borderColor: {
            title: i18n('schemas.borderColor'),
            type: 'string',
            widget: 'color',
            props: {
              disabledAlpha: true,
            },
            rules: [{ pattern: HEX_COLOR_PATTERN, message: i18n('validation.hexColor') }],
          },
        },
      },
      headStyles: {
        hidden: !showHead,
        title: i18n('schemas.table.headStyle'),
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: getCellPropPanelSchema({ i18n, fallbackFontName, fontNames }),
      },
      bodyStyles: {
        title: i18n('schemas.table.bodyStyle'),
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: getCellPropPanelSchema({ i18n, fallbackFontName, fontNames, isBody: true }),
      },
      columnStyles: {
        title: i18n('schemas.table.columnStyle'),
        type: 'object',
        widget: 'Card',
        span: 24,
        properties: getColumnStylesPropPanelSchema({ head: leafLabels, i18n }),
      },
      headerTree: {
        title: 'Header Structure',
        type: 'object',
        widget: 'NestedHeaderTreeEditor',
        span: 24,
      },
    };
  },
  defaultSchema: {
    name: '',
    type: 'nestedTable',
    position: { x: 0, y: 0 },
    width: 150,
    height: 40,
    content: JSON.stringify([
      ['Mathematics', '45', '80'],
      ['Physics', '70', '85'],
    ]),
    headerTree: [
      {
        id: 'col_course',
        label: 'Course Name',
        children: [],
        width: 40,
      },
      {
        id: 'col_marks',
        label: 'Marks',
        children: [
          {
            id: 'col_mid',
            label: 'Mid Sem',
            children: [],
            width: 30,
          },
          {
            id: 'col_end',
            label: 'End Sem',
            children: [],
            width: 30,
          },
        ],
      },
    ],
    showHead: true,
    repeatHead: false,
    tableStyles: {
      borderColor: '#000000',
      borderWidth: 0.3,
    },
    headStyles: Object.assign(getDefaultCellStyles(), {
      fontColor: '#ffffff',
      backgroundColor: '#2980ba',
      borderColor: '',
      borderWidth: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
    bodyStyles: Object.assign(getDefaultCellStyles(), {
      alternateBackgroundColor: '#f5f5f5',
    }),
    columnStyles: {},
  },
  widgets: {
    NestedHeaderTreeEditor: ({ rootElement, changeSchemas, activeSchema }) => {
      const schema = activeSchema as unknown as NestedTableSchema;

      rootElement.innerHTML = '';

      const container = document.createElement('div');
      container.style.padding = '12px';
      rootElement.appendChild(container);

      const renderNode = (node: NestedHeaderNode, depth: number) => {
        const nodeDiv = document.createElement('div');
        nodeDiv.style.marginLeft = `${depth * 16}px`;
        nodeDiv.style.marginBottom = '8px';
        nodeDiv.style.display = 'flex';
        nodeDiv.style.gap = '8px';
        nodeDiv.style.alignItems = 'center';

        const label = document.createElement('input');
        label.type = 'text';
        label.value = node.label;
        label.style.flex = '1';
        label.style.padding = '4px 8px';
        label.style.border = '1px solid #ccc';
        label.style.borderRadius = '4px';

        label.addEventListener('change', () => {
          const newTree = renameNode(schema.headerTree, node.id, label.value);
          changeSchemas([{ key: 'headerTree', value: newTree, schemaId: activeSchema.id }]);
        });

        nodeDiv.appendChild(label);

        const addSubBtn = document.createElement('button');
        addSubBtn.innerText = '[+sub]';
        addSubBtn.style.padding = '4px 8px';
        addSubBtn.style.fontSize = '12px';
        addSubBtn.addEventListener('click', () => {
          const newChild: NestedHeaderNode = {
            id: generateNodeId(),
            label: 'New Column',
            children: [],
            width: 20,
          };

          let newTree = addChildToNode(schema.headerTree || [], node.id, newChild);

          // Add new empty column to body
          const body = JSON.parse(schema.content || '[]');
          const newBody = body.map((row: string[]) => [...row, '']);

          changeSchemas([
            { key: 'headerTree', value: newTree, schemaId: activeSchema.id },
            { key: 'content', value: JSON.stringify(newBody), schemaId: activeSchema.id },
          ]);
        });

        nodeDiv.appendChild(addSubBtn);

        const leaves = getLeafNodes(schema.headerTree || []);
        if ((node.children || []).length === 0 && leaves.length > 1) {
          const removeBtn = document.createElement('button');
          removeBtn.innerText = '[-]';
          removeBtn.style.padding = '4px 8px';
          removeBtn.style.fontSize = '12px';
          removeBtn.addEventListener('click', () => {
            const newTree = removeNode(schema.headerTree, node.id);

            // Remove column from body
            const body = JSON.parse(schema.content || '[]');
            const leafIndex = leaves.findIndex((l) => l.id === node.id);
            const newBody = body.map((row: string[]) => {
              const newRow = [...row];
              if (leafIndex >= 0 && leafIndex < newRow.length) {
                newRow.splice(leafIndex, 1);
              }
              return newRow;
            });

            changeSchemas([
              { key: 'headerTree', value: newTree, schemaId: activeSchema.id },
              { key: 'content', value: JSON.stringify(newBody), schemaId: activeSchema.id },
            ]);
          });

          nodeDiv.appendChild(removeBtn);
        }

        container.appendChild(nodeDiv);

        if ((node.children || []).length > 0) {
          (node.children || []).forEach((child: NestedHeaderNode) => renderNode(child, depth + 1));
        }
      };

      (schema.headerTree || []).forEach((node: NestedHeaderNode) => renderNode(node, 0));

      const addColBtn = document.createElement('button');
      addColBtn.innerText = '[+ Add Column]';
      addColBtn.style.padding = '8px 12px';
      addColBtn.style.marginTop = '8px';
      addColBtn.style.backgroundColor = '#2980ba';
      addColBtn.style.color = '#fff';
      addColBtn.style.border = 'none';
      addColBtn.style.borderRadius = '4px';
      addColBtn.style.cursor = 'pointer';

      addColBtn.addEventListener('click', () => {
        const newNode: NestedHeaderNode = {
          id: generateNodeId(),
          label: 'New Column',
          children: [],
          width: 100 / (getLeafNodes(schema.headerTree || []).length + 1),
        };

        const newTree = [...(schema.headerTree || []), newNode];
        const body = JSON.parse(schema.content || '[]');
        const newBody = body.map((row: string[]) => [...row, '']);

        changeSchemas([
          { key: 'headerTree', value: newTree, schemaId: activeSchema.id },
          { key: 'content', value: JSON.stringify(newBody), schemaId: activeSchema.id },
        ]);
      });

      container.appendChild(addColBtn);
    },
  },
};
