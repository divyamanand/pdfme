import { replacePlaceholders } from '@pdfme/common';
import { MultiVariableTextSchema } from './types.js';

export const substituteVariables = (
  text: string,
  variablesIn: string | Record<string, string>,
  extraContext?: Record<string, unknown>,
): string => {
  if (!text) {
    return '';
  }

  let variables: Record<string, string>;
  try {
    variables =
      typeof variablesIn === 'string'
        ? (JSON.parse(variablesIn || '{}') as Record<string, string>)
        : variablesIn;
  } catch {
    throw new SyntaxError(`[@pdfme/schemas] MVT: invalid JSON string '${variablesIn as string}'`);
  }

  // Merge extra context (e.g. currentPage, totalPages) with user variables
  // System context takes precedence over user variables
  const merged = extraContext ? { ...variables, ...extraContext } : variables;

  // Use the full JS expression evaluator — supports {varName}, {expr * 2}, {str.toUpperCase()}, etc.
  const result = replacePlaceholders({ content: text, variables: merged, schemas: [] });
  // Strip any remaining unresolved {placeholders} for clean output
  return result.replace(/\{[^{}]+\}/g, '');
};

export const validateVariables = (value: string, schema: MultiVariableTextSchema): boolean => {
  if (!schema.variables || schema.variables.length === 0) {
    return true;
  }

  let values;
  try {
    values = value ? (JSON.parse(value) as Record<string, string>) : {};
  } catch {
    throw new SyntaxError(
      `[@pdfme/generator] invalid JSON string '${value}' for variables in field ${schema.name}`,
    );
  }

  for (const variable of schema.variables) {
    if (!values[variable]) {
      if (schema.required) {
        throw new Error(
          `[@pdfme/generator] variable ${variable} is missing for field ${schema.name}`,
        );
      }
      return false;
    }
  }

  return true;
};
