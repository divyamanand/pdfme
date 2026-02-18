/**
 * Extracts variable names from JavaScript expressions used in Expression Fields
 * Used for Template Tester to show required input fields
 */

import * as acorn from 'acorn';
import type { Node as AcornNode, Identifier } from 'estree';

// Built-in variables and globals that don't need to be shown as inputs
const BUILT_IN_VARIABLES = new Set([
  // Date/time variables provided by generator
  'date',
  'dateTime',
  'currentPage',
  'totalPages',
  // Global objects
  'Math',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'Date',
  'JSON',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
]);

/**
 * Recursively walks an AST and collects all variable identifiers
 */
const extractIdentifiersFromAST = (
  node: AcornNode,
  identifiers: Set<string>
): void => {
  switch (node.type) {
    case 'Identifier': {
      const idNode = node as Identifier;
      // Only add if it's not a built-in
      if (!BUILT_IN_VARIABLES.has(idNode.name)) {
        identifiers.add(idNode.name);
      }
      break;
    }
    case 'Literal':
      // Literals don't contain variables
      break;

    case 'BinaryExpression':
    case 'LogicalExpression': {
      const binaryNode = node as any;
      extractIdentifiersFromAST(binaryNode.left, identifiers);
      extractIdentifiersFromAST(binaryNode.right, identifiers);
      break;
    }

    case 'UnaryExpression': {
      const unaryNode = node as any;
      extractIdentifiersFromAST(unaryNode.argument, identifiers);
      break;
    }

    case 'ConditionalExpression': {
      const condNode = node as any;
      extractIdentifiersFromAST(condNode.test, identifiers);
      extractIdentifiersFromAST(condNode.consequent, identifiers);
      extractIdentifiersFromAST(condNode.alternate, identifiers);
      break;
    }

    case 'MemberExpression': {
      const memberNode = node as any;
      extractIdentifiersFromAST(memberNode.object, identifiers);
      if (memberNode.computed) {
        extractIdentifiersFromAST(memberNode.property, identifiers);
      }
      break;
    }

    case 'CallExpression': {
      const callNode = node as any;
      extractIdentifiersFromAST(callNode.callee, identifiers);
      callNode.arguments.forEach((arg: AcornNode) => {
        extractIdentifiersFromAST(arg, identifiers);
      });
      break;
    }

    case 'ArrayExpression': {
      const arrayNode = node as any;
      arrayNode.elements.forEach((elem: AcornNode | null) => {
        if (elem) extractIdentifiersFromAST(elem, identifiers);
      });
      break;
    }

    case 'ObjectExpression': {
      const objectNode = node as any;
      objectNode.properties.forEach((prop: any) => {
        extractIdentifiersFromAST(prop.key, identifiers);
        extractIdentifiersFromAST(prop.value, identifiers);
      });
      break;
    }

    case 'ArrowFunctionExpression':
    case 'FunctionExpression': {
      const funcNode = node as any;
      // Skip parameter names as they're local to the function
      // Only extract from body
      if (funcNode.body.type === 'BlockStatement') {
        // For block bodies, we'd need deeper analysis
        // For now, skip function bodies
      } else {
        // For expression bodies (arrow functions)
        extractIdentifiersFromAST(funcNode.body, identifiers);
      }
      break;
    }

    default:
      // For other node types, try to recursively process common properties
      for (const key in node) {
        const value = (node as any)[key];
        if (value && typeof value === 'object' && value.type) {
          extractIdentifiersFromAST(value as AcornNode, identifiers);
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item && typeof item === 'object' && item.type) {
              extractIdentifiersFromAST(item, identifiers);
            }
          });
        }
      }
  }
};

/**
 * Extracts variable names from a JavaScript expression string
 * Example: "Number(price) * quantity" → ["price", "quantity"]
 * Returns empty array if expression is invalid
 */
export const extractVariablesFromExpression = (
  expressionString: string
): string[] => {
  if (!expressionString) {
    return [];
  }

  try {
    // Remove the surrounding braces if present
    const cleanedExpression = expressionString
      .replace(/^{/, '')
      .replace(/}$/, '')
      .trim();

    if (!cleanedExpression) {
      return [];
    }

    // Parse the expression using acorn
    const ast = acorn.parseExpressionAt(cleanedExpression, 0, {
      ecmaVersion: 2021,
    });

    // Extract identifiers
    const identifiers = new Set<string>();
    extractIdentifiersFromAST(ast, identifiers);

    // Return sorted array for consistent output
    return Array.from(identifiers).sort();
  } catch (error) {
    // If parsing fails, return empty array
    // This handles invalid expressions gracefully
    console.debug('Failed to parse expression:', expressionString, error);
    return [];
  }
};

/**
 * Gets all variables used across multiple expression fields
 */
export const extractAllExpressionVariables = (
  schemas: Array<{ type?: string; content?: string }>
): string[] => {
  const allVariables = new Set<string>();

  schemas.forEach((schema) => {
    if (schema.type === 'expressionField' && schema.content) {
      const vars = extractVariablesFromExpression(schema.content);
      vars.forEach((v) => allVariables.add(v));
    }
  });

  return Array.from(allVariables).sort();
};

/**
 * Gets all available field names that can provide values for expressions
 * Includes input fields but excludes readOnly, static, and expression fields
 */
export const getAvailableFieldNames = (
  schemas: Array<{ type?: string; name?: string; readOnly?: boolean }>
): Set<string> => {
  const STATIC_TYPES = new Set(['line', 'rectangle', 'ellipse', 'table', 'nestedTable']);
  const fieldNames = new Set<string>();

  schemas.forEach((schema) => {
    // Skip non-input fields
    if (schema.readOnly) return;
    if (schema.type === 'expressionField') return; // Expression fields don't provide values
    if (STATIC_TYPES.has(schema.type || '')) return;

    // Add field name if available
    if (schema.name) {
      fieldNames.add(schema.name);
    }
  });

  return fieldNames;
};

/**
 * Checks if a variable is already provided by another field in the template
 */
export const isVariableProvidedByField = (
  variableName: string,
  availableFieldNames: Set<string>
): boolean => {
  return availableFieldNames.has(variableName);
};

/**
 * Categorizes required variables into provided and missing
 */
export const categorizeVariables = (
  requiredVariables: string[],
  availableFieldNames: Set<string>
): { provided: string[]; missing: string[] } => {
  const provided = requiredVariables.filter((v) =>
    isVariableProvidedByField(v, availableFieldNames)
  );
  const missing = requiredVariables.filter(
    (v) => !isVariableProvidedByField(v, availableFieldNames)
  );

  return { provided, missing };
};
