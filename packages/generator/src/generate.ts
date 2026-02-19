import * as pdfLib from '@pdfme/pdf-lib';
import type { GenerateProps, Schema, PDFRenderProps, Template } from '@pdfme/common';
import {
  checkGenerateProps,
  getDynamicTemplate,
  isBlankPdf,
  replacePlaceholders,
  evaluateExpressions,
  evaluateTableCellExpressions,
  evaluateSchemaConditionalFormatting,
  buildTableCellContext,
  pt2mm,
  cloneDeep,
} from '@pdfme/common';
import { getDynamicHeightsForTable, getDynamicHeightsForNestedTable } from '@pdfme/schemas';
import {
  insertPage,
  preprocessing,
  postProcessing,
  getEmbedPdfPages,
  validateRequiredFields,
} from './helper.js';

/**
 * Normalizes table input data by stringifying arrays
 * Converts array format to JSON string for table/nestedTable fields
 */
const normalizeTableInput = (value: unknown, schemaType?: string): string => {
  // For table/nestedTable types, always stringify array inputs
  if ((schemaType === 'table' || schemaType === 'nestedTable') && Array.isArray(value)) {
    return JSON.stringify(value);
  }

  // For other object types, stringify
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  // Otherwise return as string
  return (value !== null && value !== '' ? String(value) : '') as string;
};

const generate = async (props: GenerateProps): Promise<Uint8Array<ArrayBuffer>> => {
  checkGenerateProps(props);
  const { inputs, template: _template, options = {}, plugins: userPlugins = {} } = props;
  const template = cloneDeep(_template);

  const basePdf = template.basePdf;

  if (inputs.length === 0) {
    throw new Error(
      '[@pdfme/generator] inputs should not be empty, pass at least an empty object in the array',
    );
  }

  validateRequiredFields(template, inputs);

  const { pdfDoc, renderObj } = await preprocessing({ template, userPlugins });

  const _cache = new Map<string, unknown>();

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];

    // Get the dynamic template with proper typing
    const dynamicTemplate: Template = await getDynamicTemplate({
      template,
      input,
      options,
      _cache,
      getDynamicHeights: (value, args) => {
        switch (args.schema.type) {
          case 'table':
            return getDynamicHeightsForTable(value, args);
          case 'nestedTable':
            return getDynamicHeightsForNestedTable(value, args);
          default:
            return Promise.resolve([args.schema.height]);
        }
      },
    });
    const { basePages, embedPdfBoxes } = await getEmbedPdfPages({
      template: dynamicTemplate,
      pdfDoc,
    });

    // Add proper type assertion for dynamicTemplate.schemas
    const schemas = dynamicTemplate.schemas as Schema[][];
    // Create a type-safe array of schema names without using Set spread which requires downlevelIteration
    const schemaNameSet = new Set<string>();
    schemas.forEach((page: Schema[]) => {
      page.forEach((schema: Schema) => {
        if (schema.name) {
          schemaNameSet.add(schema.name);
        }
      });
    });
    const schemaNames = Array.from(schemaNameSet);

    for (let j = 0; j < basePages.length; j += 1) {
      const basePage = basePages[j];
      const embedPdfBox = embedPdfBoxes[j];

      const boundingBoxLeft =
        basePage instanceof pdfLib.PDFEmbeddedPage ? pt2mm(embedPdfBox.mediaBox.x) : 0;
      const boundingBoxBottom =
        basePage instanceof pdfLib.PDFEmbeddedPage ? pt2mm(embedPdfBox.mediaBox.y) : 0;

      const page = insertPage({ basePage, embedPdfBox, pdfDoc });

      // Build table cell context so other plugins can reference table cells as fieldName.A1
      const tableCellContext = buildTableCellContext(schemas as any, input);

      if (isBlankPdf(basePdf) && basePdf.staticSchema) {
        for (let k = 0; k < basePdf.staticSchema.length; k += 1) {
          const staticSchema = basePdf.staticSchema[k];
          const render = renderObj[staticSchema.type];
          if (!render) {
            continue;
          }
          const rawInput = input[staticSchema.name];
          let value: string;
          const varsContext = { ...input, ...tableCellContext, totalPages: basePages.length, currentPage: j + 1 };
          if (staticSchema.readOnly) {
            value = replacePlaceholders({
              content: staticSchema.content || '',
              variables: varsContext,
              schemas: schemas, // Use the properly typed schemas variable
            });
          } else if (
            rawInput == null &&
            Array.isArray((staticSchema as any).variables) &&
            ((staticSchema as any).variables as string[]).length > 0 &&
            ((staticSchema as any).variables as string[]).some((v) => v in input)
          ) {
            // Flat input: collect declared variables from top-level input keys
            const collected: Record<string, string> = {};
            ((staticSchema as any).variables as string[]).forEach((v) => {
              collected[v] = String(input[v] ?? '');
            });
            value = JSON.stringify(collected);
          } else if (rawInput !== null && rawInput !== undefined) {
            value = normalizeTableInput(rawInput, staticSchema.type);
          } else {
            value = (staticSchema.content || '') as string;
          }

          // Evaluate {{...}} expressions for non-readOnly schemas
          if (!staticSchema.readOnly && value) {
            if (staticSchema.type === 'table' || staticSchema.type === 'nestedTable') {
              const tableSchema = staticSchema as any;
              value = evaluateTableCellExpressions({
                value,
                variables: varsContext,
                schemas,
                conditionalFormatting: tableSchema.conditionalFormatting,
              });
            } else if (staticSchema.type !== 'image' && staticSchema.type !== 'signature') {
              const schemaCF = (staticSchema as any).conditionalFormatting;
              if (schemaCF) {
                const cfResult = evaluateSchemaConditionalFormatting({
                  rule: schemaCF,
                  variables: varsContext,
                  schemas,
                });
                if (cfResult !== null) value = cfResult;
                else value = evaluateExpressions({ content: value, variables: varsContext, schemas });
              } else {
                value = evaluateExpressions({ content: value, variables: varsContext, schemas });
              }
            }
          }

          staticSchema.position = {
            x: staticSchema.position.x + boundingBoxLeft,
            y: staticSchema.position.y - boundingBoxBottom,
          };

          // Create properly typed render props for static schema
          const staticRenderProps: PDFRenderProps<Schema> = {
            value,
            schema: staticSchema,
            basePdf,
            pdfLib,
            pdfDoc,
            page,
            options,
            _cache,
          };
          await render(staticRenderProps);
        }
      }

      for (let l = 0; l < schemaNames.length; l += 1) {
        const name = schemaNames[l];
        const schemaPage = schemas[j] || [];
        const schema = schemaPage.find((s: Schema) => s.name == name);
        if (!schema) {
          continue;
        }

        const render = renderObj[schema.type];
        if (!render) {
          continue;
        }
        const rawInput = input[name];
        let value: string;
        const varsContext = { ...input, ...tableCellContext, totalPages: basePages.length, currentPage: j + 1 };
        if (schema.readOnly) {
          value = replacePlaceholders({
            content: schema.content || '',
            variables: varsContext,
            schemas: schemas, // Use the properly typed schemas variable
          });
        } else if (
          rawInput == null &&
          Array.isArray((schema as any).variables) &&
          ((schema as any).variables as string[]).length > 0 &&
          ((schema as any).variables as string[]).some((v) => v in input)
        ) {
          // Flat input: collect declared variables from top-level input keys
          const collected: Record<string, string> = {};
          ((schema as any).variables as string[]).forEach((v) => {
            collected[v] = String(input[v] ?? '');
          });
          value = JSON.stringify(collected);
        } else if (rawInput !== null && rawInput !== undefined) {
          value = normalizeTableInput(rawInput, schema.type);
        } else {
          // Use schema.content for expression evaluation
          value = (schema.content || '') as string;
        }

        // Evaluate {{...}} expressions for non-readOnly schemas
        if (!schema.readOnly && value) {
          if (schema.type === 'table' || schema.type === 'nestedTable') {
            const tableSchema = schema as any;
            value = evaluateTableCellExpressions({
              value,
              variables: varsContext,
              schemas,
              conditionalFormatting: tableSchema.conditionalFormatting,
            });
          } else if (schema.type !== 'image' && schema.type !== 'signature') {
            const schemaCF = (schema as any).conditionalFormatting;
            if (schemaCF) {
              const cfResult = evaluateSchemaConditionalFormatting({
                rule: schemaCF,
                variables: varsContext,
                schemas,
              });
              if (cfResult !== null) value = cfResult;
              else value = evaluateExpressions({ content: value, variables: varsContext, schemas });
            } else {
              value = evaluateExpressions({ content: value, variables: varsContext, schemas });
            }
          }
        }

        schema.position = {
          x: schema.position.x + boundingBoxLeft,
          y: schema.position.y - boundingBoxBottom,
        };

        // Create properly typed render props
        const renderProps: PDFRenderProps<Schema> = {
          value,
          schema,
          basePdf,
          pdfLib,
          pdfDoc,
          page,
          options,
          _cache,
        };
        await render(renderProps);
      }
    }
  }

  postProcessing({ pdfDoc, options });

  return pdfDoc.save();
};

export default generate;
