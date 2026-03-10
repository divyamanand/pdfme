/**
 * Variable Catalog — hardcoded Var definitions that the engine understands.
 * Maps dot-path vars (e.g., "cell.value") to resolver functions.
 *
 * Canvas uses the catalog to show autocomplete / pick-list.
 * Engine uses resolvers to evaluate Var nodes at runtime.
 */

import type { EvalContext } from '../types/evaluation.types';
import { TextMeasurer } from './text-measurer';

export interface VarDef {
  /** Dot-path for this var (e.g., "cell.value") */
  path: string;
  /** Human-readable description */
  description: string;
  /** Return type (for operator compatibility checking) */
  returnType: 'string' | 'number' | 'boolean';
  /** Resolver function: given context, returns the value */
  resolve: (ctx: EvalContext) => string | number | boolean | null | undefined;
}

/**
 * Catalog of all variables the engine understands.
 * Exported so canvas UI can display these as options.
 */
export const VAR_CATALOG: Record<string, VarDef> = {
  // ============ Cell-scoped variables ============

  'cell.value': {
    path: 'cell.value',
    description: 'Display value of the cell',
    returnType: 'string',
    resolve: (ctx) => ctx.cell?.rawValue ?? '',
  },

  'cell.numericValue': {
    path: 'cell.numericValue',
    description: 'Numeric value (parseFloat or 0)',
    returnType: 'number',
    resolve: (ctx) => {
      const val = ctx.cell?.rawValue;
      if (typeof val === 'number') return val;
      const parsed = parseFloat(String(val ?? 0));
      return isNaN(parsed) ? 0 : parsed;
    },
  },

  'cell.rowIndex': {
    path: 'cell.rowIndex',
    description: 'Body row index of this cell (0-based)',
    returnType: 'number',
    resolve: (ctx) => ctx.rowIndex ?? ctx.cell?.layout?.row ?? -1,
  },

  'cell.colIndex': {
    path: 'cell.colIndex',
    description: 'Column index of this cell (0-based)',
    returnType: 'number',
    resolve: (ctx) => ctx.colIndex ?? ctx.cell?.layout?.col ?? -1,
  },

  'cell.width': {
    path: 'cell.width',
    description: 'Cell layout width in mm',
    returnType: 'number',
    resolve: (ctx) => ctx.cell?.layout?.width ?? 0,
  },

  'cell.height': {
    path: 'cell.height',
    description: 'Cell layout height in mm',
    returnType: 'number',
    resolve: (ctx) => ctx.cell?.layout?.height ?? 0,
  },

  'cell.fontSize': {
    path: 'cell.fontSize',
    description: 'Current font size',
    returnType: 'number',
    resolve: (ctx) => ctx.cell?.styleOverrides.fontSize ?? 13,
  },

  'cell.fontName': {
    path: 'cell.fontName',
    description: 'Current font name',
    returnType: 'string',
    resolve: (ctx) => ctx.cell?.styleOverrides.fontName ?? '',
  },

  'cell.fontColor': {
    path: 'cell.fontColor',
    description: 'Current font color (hex)',
    returnType: 'string',
    resolve: (ctx) => ctx.cell?.styleOverrides.fontColor ?? '#000000',
  },

  'cell.backgroundColor': {
    path: 'cell.backgroundColor',
    description: 'Current background color (hex)',
    returnType: 'string',
    resolve: (ctx) => ctx.cell?.styleOverrides.backgroundColor ?? '',
  },

  'cell.bold': {
    path: 'cell.bold',
    description: 'Whether cell is bold',
    returnType: 'boolean',
    resolve: (ctx) => ctx.cell?.styleOverrides.bold ?? false,
  },

  'cell.italic': {
    path: 'cell.italic',
    description: 'Whether cell is italic',
    returnType: 'boolean',
    resolve: (ctx) => ctx.cell?.styleOverrides.italic ?? false,
  },

  'cell.alignment': {
    path: 'cell.alignment',
    description: 'Text alignment (left/center/right/justify)',
    returnType: 'string',
    resolve: (ctx) => ctx.cell?.styleOverrides.alignment ?? 'left',
  },

  'cell.overflows': {
    path: 'cell.overflows',
    description: 'Whether text overflows cell bounds',
    returnType: 'boolean',
    resolve: (ctx) => {
      if (!ctx.cell || !ctx.cell.layout) return false;
      try {
        return TextMeasurer.cellOverflows(ctx.cell);
      } catch {
        return false;
      }
    },
  },

  // ============ Table-scoped variables ============

  'table.rowCount': {
    path: 'table.rowCount',
    description: 'Total number of body rows',
    returnType: 'number',
    resolve: (ctx) => {
      try {
        return ctx.structureStore.countTotalRows();
      } catch {
        return 0;
      }
    },
  },

  'table.colCount': {
    path: 'table.colCount',
    description: 'Total number of columns',
    returnType: 'number',
    resolve: (ctx) => {
      try {
        // Column count = number of theader leaf cells
        return ctx.structureStore.getLeafCount('theader');
      } catch {
        return 0;
      }
    },
  },
};

/**
 * Resolve a dot-path var against the given context.
 * @param path - dot-path like "cell.value" or "table.rowCount"
 * @param ctx - evaluation context
 * @returns the resolved value, or null if var not found
 */
export function resolveVar(path: string, ctx: EvalContext): string | number | boolean | null | undefined {
  const varDef = VAR_CATALOG[path];
  if (!varDef) {
    return null; // Unknown var
  }
  return varDef.resolve(ctx);
}

/**
 * Get the list of all available var paths (for canvas UI).
 */
export function getAvailableVars(): VarDef[] {
  return Object.values(VAR_CATALOG);
}
