import * as acorn from 'acorn';
import type { Node as AcornNode, Identifier, Property } from 'estree';
import type { SchemaPageArray } from './types.js';
import type { TableConditionalFormatting, ConditionalRule, VisualRule, CFStyleOverrides, CFEvaluationResult, TableCFEvaluationResult } from './conditionalFormatting.js';
import {
  buildCellAddressMap,
  resolveRulesForCell,
  compileCondition,
  resolveValueType,
} from './conditionalFormatting.js';

const expressionCache = new Map<string, (context: Record<string, unknown>) => unknown>();

/** Safely convert an evaluated value to a display string.
 *  Objects/arrays are JSON-stringified; primitives use String(). */
const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const parseDataCache = new Map<string, Record<string, unknown>>();

const parseData = (data: Record<string, unknown>): Record<string, unknown> => {
  const key = JSON.stringify(data);
  if (parseDataCache.has(key)) {
    return parseDataCache.get(key)!;
  }

  const parsed = Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (typeof value === 'string') {
        try {
          const parsedValue = JSON.parse(value) as unknown;
          return [key, parsedValue];
        } catch {
          return [key, value];
        }
      }
      return [key, value];
    }),
  );

  parseDataCache.set(key, parsed);
  return parsed;
};

const padZero = (num: number): string => String(num).padStart(2, '0');

const formatDate = (date: Date): string =>
  `${date.getFullYear()}/${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}`;

const formatDateTime = (date: Date): string =>
  `${formatDate(date)} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;

// Safe assign function that prevents prototype pollution
const safeAssign = (
  target: Record<string, unknown>,
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> => {
  if (target == null) {
    throw new TypeError('Cannot convert undefined or null to object');
  }
  
  const to = { ...target };
  
  for (const source of sources) {
    if (source != null) {
      for (const key in source) {
        // Skip prototype pollution keys
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        // Only copy own properties
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          to[key] = source[key];
        }
      }
    }
  }
  
  return to;
};

// Create a safe copy of Object with dangerous methods excluded
const safeObject = {
  keys: Object.keys,
  values: Object.values,
  entries: Object.entries,
  fromEntries: Object.fromEntries,
  is: Object.is,
  hasOwnProperty: Object.hasOwnProperty,
  assign: safeAssign, // Safe version of Object.assign
  // The following methods are excluded due to security concerns:
  // - Side effects: create, freeze, seal (can still be used for attacks)
  // - Prototype access: getOwnPropertyDescriptor, getPrototypeOf, setPrototypeOf,
  //   defineProperty, defineProperties, getOwnPropertyNames, getOwnPropertySymbols
};

const allowedGlobals: Record<string, unknown> = {
  Math,
  String,
  Number,
  Boolean,
  Array,
  Object: safeObject,
  Date,
  JSON,
  isNaN,
  parseFloat,
  parseInt,
  decodeURI,
  decodeURIComponent,
  encodeURI,
  encodeURIComponent,
};

const validateAST = (node: AcornNode): void => {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
      break;
    case 'BinaryExpression':
    case 'LogicalExpression': {
      const binaryNode = node;
      validateAST(binaryNode.left);
      validateAST(binaryNode.right);
      break;
    }
    case 'UnaryExpression': {
      const unaryNode = node;
      validateAST(unaryNode.argument);
      break;
    }
    case 'ConditionalExpression': {
      const condNode = node;
      validateAST(condNode.test);
      validateAST(condNode.consequent);
      validateAST(condNode.alternate);
      break;
    }
    case 'MemberExpression': {
      const memberNode = node;
      validateAST(memberNode.object);
      if (memberNode.computed) {
        validateAST(memberNode.property);
      } else {
        const propName = (memberNode.property as Identifier).name;
        if (['constructor', '__proto__', 'prototype'].includes(propName)) {
          throw new Error('Access to prohibited property');
        }
        // Block prototype pollution methods
        if (['__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'].includes(propName)) {
          throw new Error(`Access to prohibited method: ${propName}`);
        }
        const prohibitedMethods = ['toLocaleString', 'valueOf'];
        if (typeof propName === 'string' && prohibitedMethods.includes(propName)) {
          throw new Error(`Access to prohibited method: ${propName}`);
        }
      }
      break;
    }
    case 'CallExpression': {
      const callNode = node;
      validateAST(callNode.callee);
      callNode.arguments.forEach(validateAST);
      break;
    }
    case 'ArrayExpression': {
      const arrayNode = node;
      arrayNode.elements.forEach((elem) => {
        if (elem) validateAST(elem);
      });
      break;
    }
    case 'ObjectExpression': {
      const objectNode = node;
      objectNode.properties.forEach((prop) => {
        const propNode = prop as Property;
        validateAST(propNode.key);
        validateAST(propNode.value);
      });
      break;
    }
    case 'ArrowFunctionExpression': {
      const arrowFuncNode = node;
      arrowFuncNode.params.forEach((param) => {
        if (param.type !== 'Identifier') {
          throw new Error('Only identifier parameters are supported in arrow functions');
        }
        validateAST(param);
      });
      validateAST(arrowFuncNode.body);
      break;
    }
    default:
      throw new Error(`Unsupported syntax in placeholder: ${node.type}`);
  }
};

const evaluateAST = (node: AcornNode, context: Record<string, unknown>): unknown => {
  switch (node.type) {
    case 'Literal': {
      const literalNode = node;
      return literalNode.value;
    }
    case 'Identifier': {
      const idNode = node;
      if (Object.prototype.hasOwnProperty.call(context, idNode.name)) {
        return context[idNode.name];
      } else if (Object.prototype.hasOwnProperty.call(allowedGlobals, idNode.name)) {
        return allowedGlobals[idNode.name];
      } else {
        throw new Error(`Undefined variable: ${idNode.name}`);
      }
    }
    case 'BinaryExpression': {
      const binaryNode = node;
      const left = evaluateAST(binaryNode.left, context) as number;
      const right = evaluateAST(binaryNode.right, context) as number;
      switch (binaryNode.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '**':
          return left ** right;
        case '==':
          return left == right;
        case '!=':
          return left != right;
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case '<':
          return left < right;
        case '>':
          return left > right;
        case '<=':
          return left <= right;
        case '>=':
          return left >= right;
        default:
          throw new Error(`Unsupported operator: ${binaryNode.operator}`);
      }
    }
    case 'LogicalExpression': {
      const logicalNode = node;
      const leftLogical = evaluateAST(logicalNode.left, context);
      const rightLogical = evaluateAST(logicalNode.right, context);
      switch (logicalNode.operator) {
        case '&&':
          return leftLogical && rightLogical;
        case '||':
          return leftLogical || rightLogical;
        default:
          throw new Error(`Unsupported operator: ${logicalNode.operator}`);
      }
    }
    case 'UnaryExpression': {
      const unaryNode = node;
      const arg = evaluateAST(unaryNode.argument, context) as number;
      switch (unaryNode.operator) {
        case '+':
          return +arg;
        case '-':
          return -arg;
        case '!':
          return !arg;
        default:
          throw new Error(`Unsupported operator: ${unaryNode.operator}`);
      }
    }
    case 'ConditionalExpression': {
      const condNode = node;
      const test = evaluateAST(condNode.test, context);
      return test
        ? evaluateAST(condNode.consequent, context)
        : evaluateAST(condNode.alternate, context);
    }
    case 'MemberExpression': {
      const memberNode = node;
      const obj = evaluateAST(memberNode.object, context) as Record<string, unknown>;
      let prop: string | number;
      if (memberNode.computed) {
        prop = evaluateAST(memberNode.property, context) as string | number;
      } else {
        prop = (memberNode.property as Identifier).name;
      }
      if (typeof prop === 'string' || typeof prop === 'number') {
        if (typeof prop === 'string' && ['constructor', '__proto__', 'prototype'].includes(prop)) {
          throw new Error('Access to prohibited property');
        }
        // Block prototype pollution methods
        if (typeof prop === 'string' && ['__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'].includes(prop)) {
          throw new Error(`Access to prohibited method: ${prop}`);
        }
        return obj[prop];
      } else {
        throw new Error('Invalid property access');
      }
    }
    case 'CallExpression': {
      const callNode = node;
      const callee = evaluateAST(callNode.callee, context);
      const args = callNode.arguments.map((argNode) => evaluateAST(argNode, context));
      if (typeof callee === 'function') {
        if (callNode.callee.type === 'MemberExpression') {
          const memberExpr = callNode.callee;
          const obj = evaluateAST(memberExpr.object, context);
          if (
            obj !== null &&
            (typeof obj === 'object' ||
              typeof obj === 'number' ||
              typeof obj === 'string' ||
              typeof obj === 'boolean')
          ) {
            return callee.call(obj, ...args);
          } else {
            throw new Error('Invalid object in member function call');
          }
        } else {
          // Use a type assertion to tell TypeScript this is a safe function call
          return (callee as (...args: unknown[]) => unknown)(...args);
        }
      } else {
        throw new Error('Attempted to call a non-function');
      }
    }
    case 'ArrowFunctionExpression': {
      const arrowFuncNode = node;
      const params = arrowFuncNode.params.map((param) => (param as Identifier).name);
      const body = arrowFuncNode.body;

      return (...args: unknown[]) => {
        const newContext = { ...context };
        params.forEach((param, index) => {
          newContext[param] = args[index];
        });
        return evaluateAST(body, newContext);
      };
    }
    case 'ArrayExpression': {
      const arrayNode = node;
      return arrayNode.elements.map((elem) => (elem ? evaluateAST(elem, context) : null));
    }
    case 'ObjectExpression': {
      const objectNode = node;
      const objResult: Record<string, unknown> = {};
      objectNode.properties.forEach((prop) => {
        const propNode = prop as Property;
        let key: string;
        if (propNode.key.type === 'Identifier') {
          key = propNode.key.name;
        } else {
          const evaluatedKey = evaluateAST(propNode.key, context);
          if (typeof evaluatedKey !== 'string' && typeof evaluatedKey !== 'number') {
            throw new Error('Object property keys must be strings or numbers');
          }
          key = String(evaluatedKey);
        }
        const value = evaluateAST(propNode.value, context);
        objResult[key] = value;
      });
      return objResult;
    }
    default:
      throw new Error(`Unsupported syntax in placeholder: ${node.type}`);
  }
};

const evaluatePlaceholders = (arg: {
  content: string;
  context: Record<string, unknown>;
}): string => {
  const { content, context } = arg;

  let resultContent = '';
  let index = 0;

  while (index < content.length) {
    const startIndex = content.indexOf('{', index);
    if (startIndex === -1) {
      resultContent += content.slice(index);
      break;
    }

    // Skip double-brace {{ sequences — leave them for evaluateExpressions
    if (startIndex + 1 < content.length && content[startIndex + 1] === '{') {
      // Find matching }} by counting braces
      let depth = 2;
      let scan = startIndex + 2;
      while (scan < content.length && depth > 0) {
        if (content[scan] === '{') depth++;
        else if (content[scan] === '}') depth--;
        scan++;
      }
      // Pass through the entire {{...}} block unchanged
      resultContent += content.slice(index, scan);
      index = scan;
      continue;
    }

    resultContent += content.slice(index, startIndex);
    let braceCount = 1;
    let endIndex = startIndex + 1;

    while (endIndex < content.length && braceCount > 0) {
      if (content[endIndex] === '{') {
        braceCount++;
      } else if (content[endIndex] === '}') {
        braceCount--;
      }
      endIndex++;
    }

    if (braceCount === 0) {
      const code = content.slice(startIndex + 1, endIndex - 1).trim();

      if (expressionCache.has(code)) {
        const evalFunc = expressionCache.get(code)!;
        try {
          const value = evalFunc(context);
          resultContent += stringifyValue(value);
        } catch {
          resultContent += content.slice(startIndex, endIndex);
        }
      } else {
        try {
          const ast = acorn.parseExpressionAt(code, 0, { ecmaVersion: 'latest' }) as AcornNode;
          validateAST(ast);
          const evalFunc = (ctx: Record<string, unknown>) => evaluateAST(ast, ctx);
          expressionCache.set(code, evalFunc);
          const value = evalFunc(context);
          resultContent += stringifyValue(value);
        } catch {
          resultContent += content.slice(startIndex, endIndex);
        }
      }

      index = endIndex;
    } else {
      throw new Error('Invalid placeholder');
    }
  }

  return resultContent;
};

/**
 * Build a map of table cell values keyed by schema name.
 * Enables cross-plugin access: {{myTable.A1}}, {{invoiceTable.B3}}, etc.
 *
 * For each table/nestedTable schema, parses its value (from input or content)
 * and creates: { schemaName: { A1: "val", B2: "val", ... } }
 */
export const buildTableCellContext = (
  schemas: SchemaPageArray,
  input: Record<string, unknown>,
): Record<string, Record<string, string>> => {
  const result: Record<string, Record<string, string>> = {};

  for (const page of schemas) {
    for (const schema of page) {
      if (schema.type !== 'table' && schema.type !== 'nestedTable') continue;
      const rawInput = input[schema.name];
      let tableValue: string;
      if (typeof rawInput === 'string') {
        tableValue = rawInput;
      } else if (typeof rawInput === 'object' && rawInput !== null) {
        tableValue = JSON.stringify(rawInput);
      } else {
        tableValue = (schema as any).content || '';
      }
      try {
        const rows = JSON.parse(tableValue) as string[][];
        if (Array.isArray(rows)) {
          result[schema.name] = buildCellAddressMap(rows);
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  return result;
};

/**
 * CF-aware version of buildTableCellContext.
 * Evaluates each table schema's cells through its CF rules first,
 * then builds the cell address map from the CF-evaluated output.
 * This ensures {{tableName.A1}} returns the CF-transformed value, not raw input.
 */
export const buildCFAwareCellContext = (
  schemas: SchemaPageArray,
  input: Record<string, unknown>,
): Record<string, Record<string, string>> => {
  const rawContext = buildTableCellContext(schemas, input);
  const result: Record<string, Record<string, string>> = {};

  for (const page of schemas) {
    for (const schema of page) {
      if (schema.type !== 'table' && schema.type !== 'nestedTable') continue;

      const rawInput = input[schema.name];
      let tableValue: string;
      if (typeof rawInput === 'string') {
        tableValue = rawInput;
      } else if (typeof rawInput === 'object' && rawInput !== null) {
        tableValue = JSON.stringify(rawInput);
      } else {
        tableValue = (schema as any).content || '';
      }

      const cfResult = evaluateTableCellExpressions({
        value: tableValue,
        variables: { ...input, ...rawContext },
        schemas,
        conditionalFormatting: (schema as any).conditionalFormatting,
      });

      try {
        const evaluatedRows = JSON.parse(cfResult.value) as string[][];
        if (Array.isArray(evaluatedRows)) {
          result[schema.name] = buildCellAddressMap(evaluatedRows);
        }
      } catch {
        result[schema.name] = rawContext[schema.name] || {};
      }
    }
  }

  return result;
};

/**
 * Aggregate functions injected into every expression evaluation context.
 * Work with individual cell values: sum(A1, A2, A3), avg(B1, B2), etc.
 */
export const aggFunctions: Record<string, (...args: unknown[]) => number> = {
  sum: (...args) => args.reduce<number>((acc, v) => acc + (Number(v) || 0), 0),
  min: (...args) => {
    const nums = args.map(Number).filter(isFinite);
    return nums.length ? Math.min(...nums) : 0;
  },
  max: (...args) => {
    const nums = args.map(Number).filter(isFinite);
    return nums.length ? Math.max(...nums) : 0;
  },
  avg: (...args) => {
    const nums = args.map(Number).filter(isFinite);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },
  product: (...args) => args.reduce<number>((acc, v) => acc * (Number(v) || 0), 1),
  count: (...args) => args.filter((v) => v !== '' && v !== null && v !== undefined).length,
};

// Helper to build evaluation context shared by both replacePlaceholders and evaluateExpressions
const buildEvalContext = (
  variables: Record<string, unknown>,
  schemas: SchemaPageArray,
): Record<string, unknown> => {
  const date = new Date();
  const formattedDate = formatDate(date);
  const formattedDateTime = formatDateTime(date);

  const data = {
    ...Object.fromEntries(
      schemas.flat().map((schema) => [schema.name, schema.readOnly ? schema.content || '' : '']),
    ),
    ...variables,
  };
  const parsedInput = parseData(data);

  const context: Record<string, unknown> = {
    date: formattedDate,
    dateTime: formattedDateTime,
    ...parsedInput,
    ...aggFunctions,
  };

  Object.entries(context).forEach(([key, value]) => {
    if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
      context[key] = evaluatePlaceholders({ content: value, context });
    }
  });

  return context;
};

/**
 * Helper: evaluate a single compiled expression string against a context.
 * Used by conditional formatting to evaluate rule expressions.
 * Reuses the expression cache and evaluation pipeline.
 */
const evaluateCompiledExpression = (code: string, context: Record<string, unknown>): unknown => {
  if (expressionCache.has(code)) {
    const evalFunc = expressionCache.get(code)!;
    return evalFunc(context);
  }

  try {
    const ast = acorn.parseExpressionAt(code, 0, { ecmaVersion: 'latest' }) as AcornNode;
    validateAST(ast);
    const evalFunc = (ctx: Record<string, unknown>) => evaluateAST(ast, ctx);
    expressionCache.set(code, evalFunc);
    return evalFunc(context);
  } catch {
    throw new Error(`Failed to evaluate expression: ${code}`);
  }
};

export const replacePlaceholders = (arg: {
  content: string;
  variables: Record<string, unknown>;
  schemas: SchemaPageArray;
}): string => {
  const { content, variables, schemas } = arg;
  if (!content || typeof content !== 'string' || !content.includes('{') || !content.includes('}')) {
    return content;
  }

  const context = buildEvalContext(variables, schemas);
  return evaluatePlaceholders({ content, context });
};

/**
 * Evaluates {{...}} double-brace expressions in content.
 * Similar to replacePlaceholders but uses {{expr}} syntax instead of {expr}.
 * Useful for making all plugins expression-aware without the readOnly restriction.
 */
export const evaluateExpressions = (arg: {
  content: string;
  variables: Record<string, unknown>;
  schemas: SchemaPageArray;
}): string => {
  const { content, variables, schemas } = arg;

  // Fast exit: no double-brace markers
  if (!content || typeof content !== 'string' || !content.includes('{{') || !content.includes('}}')) {
    return content;
  }

  const context = buildEvalContext(variables, schemas);

  let resultContent = '';
  let i = 0;

  while (i < content.length) {
    // Look for opening {{
    const startIndex = content.indexOf('{{', i);
    if (startIndex === -1) {
      // No more expressions, append the rest
      resultContent += content.slice(i);
      break;
    }

    // Append content before the expression
    resultContent += content.slice(i, startIndex);

    // Find matching }}
    let braceCount = 2; // two opening braces
    let endIndex = startIndex + 2;

    while (endIndex < content.length && braceCount > 0) {
      if (content[endIndex] === '{') {
        braceCount++;
      } else if (content[endIndex] === '}') {
        braceCount--;
      }
      endIndex++;
    }

    if (braceCount === 0) {
      // Found matching closing braces
      const code = content.slice(startIndex + 2, endIndex - 2).trim();

      if (expressionCache.has(code)) {
        const evalFunc = expressionCache.get(code)!;
        try {
          const value = evalFunc(context);
          resultContent += stringifyValue(value);
        } catch {
          // On error, keep the raw expression block
          resultContent += content.slice(startIndex, endIndex);
        }
      } else {
        try {
          const ast = acorn.parseExpressionAt(code, 0, { ecmaVersion: 'latest' }) as AcornNode;
          validateAST(ast);
          const evalFunc = (ctx: Record<string, unknown>) => evaluateAST(ast, ctx);
          expressionCache.set(code, evalFunc);
          const value = evalFunc(context);
          resultContent += stringifyValue(value);
        } catch {
          // On error, keep the raw expression block
          resultContent += content.slice(startIndex, endIndex);
        }
      }

      i = endIndex;
    } else {
      // Unmatched braces, keep as-is and continue
      resultContent += content[startIndex];
      i = startIndex + 1;
    }
  }

  return resultContent;
};

/**
 * Evaluates {{...}} expressions in table cell values.
 * Parses a JSON string[][] (table), evaluates each cell independently, and returns stringified result.
 *
 * If conditionalFormatting rules are provided, a matching rule replaces the entire cell value.
 * Otherwise, existing inline {{...}} evaluation proceeds unchanged (backward compatible).
 */
/**
 * Evaluate a VisualRule by checking branches individually.
 * Returns the matched branch's value (with prefix/suffix) and styles.
 * This is needed instead of using the compiled ternary so we can identify
 * WHICH branch matched and pick up that branch's styles/prefix/suffix.
 */
const evaluateVisualRule = (
  rule: VisualRule,
  context: Record<string, unknown>,
): CFEvaluationResult => {
  for (const branch of rule.branches) {
    const condExpr = compileCondition(branch);
    try {
      if (evaluateCompiledExpression(condExpr, context)) {
        const resultType = resolveValueType(branch.result, branch.resultIsVariable, branch.resultType);
        const valueExpr = (resultType === 'variable' || resultType === 'field')
          ? branch.result
          : JSON.stringify(branch.result);
        const rawValue = String(evaluateCompiledExpression(valueExpr, context) ?? '');
        const value = (branch.prefix || '') + rawValue + (branch.suffix || '');
        return { value, styles: branch.styles };
      }
    } catch {
      continue;
    }
  }
  // No branch matched, use default (ELSE)
  const defaultType = resolveValueType(rule.defaultResult, rule.defaultResultIsVariable, rule.defaultResultType);
  const defExpr = (defaultType === 'variable' || defaultType === 'field')
    ? rule.defaultResult
    : JSON.stringify(rule.defaultResult);
  const rawValue = String(evaluateCompiledExpression(defExpr, context) ?? '');
  const value = (rule.defaultPrefix || '') + rawValue + (rule.defaultSuffix || '');
  return { value, styles: rule.defaultStyles };
};

export const evaluateTableCellExpressions = (arg: {
  value: string;
  variables: Record<string, unknown>;
  schemas: SchemaPageArray;
  conditionalFormatting?: TableConditionalFormatting;
}): TableCFEvaluationResult => {
  const { value, variables, schemas, conditionalFormatting } = arg;

  // Fast exit: no expressions and no conditional formatting
  if (!value || typeof value !== 'string') {
    return { value };
  }
  if (!value.includes('{{') && !conditionalFormatting) {
    return { value };
  }

  try {
    const rows = JSON.parse(value) as string[][];

    // Build cell address map from raw values (for cross-cell references like A1, B2)
    const cellAddressMap = buildCellAddressMap(rows);
    const augmentedVariables = { ...variables, ...cellAddressMap };

    const cellStyles: Record<string, CFStyleOverrides> = {};

    const evaluatedRows = rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (typeof cell !== 'string') {
          return cell;
        }

        // Resolve CF rule: checks cell-specific, column-wildcard (*:col), row-wildcard (row:*) keys
        const rule = conditionalFormatting
          ? resolveRulesForCell(conditionalFormatting, rowIndex, colIndex)
          : undefined;

        if (rule) {
          // CF replaces entire cell value
          try {
            const evalContext = buildEvalContext(augmentedVariables, schemas);

            if (rule.mode === 'visual' && rule.visualRule) {
              const result = evaluateVisualRule(rule.visualRule, evalContext);
              if (result.styles) cellStyles[`${rowIndex}:${colIndex}`] = result.styles;
              return result.value;
            }

            // Code mode
            const result = evaluateCompiledExpression(rule.compiledExpression, evalContext);
            if (rule.codeStyles) cellStyles[`${rowIndex}:${colIndex}`] = rule.codeStyles;
            return String(result ?? '');
          } catch {
            return cell; // fail-safe: keep original cell value
          }
        }

        // No CF: evaluate {{expr}} tokens normally
        return evaluateExpressions({
          content: cell,
          variables: augmentedVariables,
          schemas,
        });
      }),
    );

    return {
      value: JSON.stringify(evaluatedRows),
      cellStyles: Object.keys(cellStyles).length > 0 ? cellStyles : undefined,
    };
  } catch {
    // Not valid JSON or parse error, return as-is
    return { value };
  }
};

/**
 * Evaluates a conditional formatting rule for a non-table schema.
 * Returns the evaluated result with optional style overrides, or null if evaluation fails.
 */
export const evaluateSchemaConditionalFormatting = (arg: {
  rule: ConditionalRule;
  variables: Record<string, unknown>;
  schemas: SchemaPageArray;
}): CFEvaluationResult | null => {
  try {
    const context = buildEvalContext(arg.variables, arg.schemas);

    if (arg.rule.mode === 'visual' && arg.rule.visualRule) {
      return evaluateVisualRule(arg.rule.visualRule, context);
    }

    // Code mode
    const result = evaluateCompiledExpression(arg.rule.compiledExpression, context);
    return { value: String(result ?? ''), styles: arg.rule.codeStyles };
  } catch {
    return null;
  }
};
