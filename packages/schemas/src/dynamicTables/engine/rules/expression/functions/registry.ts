/**
 * Function Registry — hardcoded FnCall definitions that the engine understands.
 * Maps function names to implementations.
 *
 * Canvas uses the catalog to show autocomplete / pick-list.
 * Engine uses implementations to evaluate FnCall nodes at runtime.
 */

import type { EvalContext } from '../../types/evaluation.types';
import { TextMeasurer } from '../text-measurer';

export interface FnDef {
  /** Function name */
  name: string;
  /** Human-readable signature (e.g., "SUM(range)") */
  signature: string;
  /** Description */
  description: string;
  /** Return type */
  returnType: 'string' | 'number' | 'boolean';
  /** Implementation: (resolvedArgs, context) => result */
  fn: (args: any[], ctx: EvalContext) => string | number | boolean | null | undefined;
}

/**
 * Registry of all hardcoded functions.
 * Map: functionName → FnDef
 */
const FUNCTION_DEFS: Record<string, FnDef> = {
  SUM: {
    name: 'SUM',
    signature: 'SUM(range)',
    description: 'Sum of numeric values in range',
    returnType: 'number',
    fn: (args) => {
      const cells = args[0];
      if (!Array.isArray(cells)) return 0;
      let sum = 0;
      for (const cell of cells) {
        const val = typeof cell === 'object' ? cell.rawValue : cell;
        const num = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
        if (!isNaN(num)) sum += num;
      }
      return sum;
    },
  },

  AVG: {
    name: 'AVG',
    signature: 'AVG(range)',
    description: 'Average of numeric values in range',
    returnType: 'number',
    fn: (args) => {
      const cells = args[0];
      if (!Array.isArray(cells) || cells.length === 0) return 0;
      let sum = 0;
      let count = 0;
      for (const cell of cells) {
        const val = typeof cell === 'object' ? cell.rawValue : cell;
        const num = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
        if (!isNaN(num)) {
          sum += num;
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    },
  },

  COUNT: {
    name: 'COUNT',
    signature: 'COUNT(range)',
    description: 'Count of non-empty cells in range',
    returnType: 'number',
    fn: (args) => {
      const cells = args[0];
      if (!Array.isArray(cells)) return 0;
      let count = 0;
      for (const cell of cells) {
        const val = typeof cell === 'object' ? cell.rawValue : cell;
        if (val !== null && val !== undefined && val !== '') count++;
      }
      return count;
    },
  },

  MAX: {
    name: 'MAX',
    signature: 'MAX(range)',
    description: 'Maximum numeric value in range',
    returnType: 'number',
    fn: (args) => {
      const cells = args[0];
      if (!Array.isArray(cells)) return 0;
      let max = -Infinity;
      for (const cell of cells) {
        const val = typeof cell === 'object' ? cell.rawValue : cell;
        const num = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
        if (!isNaN(num) && num > max) max = num;
      }
      return max === -Infinity ? 0 : max;
    },
  },

  MIN: {
    name: 'MIN',
    signature: 'MIN(range)',
    description: 'Minimum numeric value in range',
    returnType: 'number',
    fn: (args) => {
      const cells = args[0];
      if (!Array.isArray(cells)) return 0;
      let min = Infinity;
      for (const cell of cells) {
        const val = typeof cell === 'object' ? cell.rawValue : cell;
        const num = typeof val === 'number' ? val : parseFloat(String(val ?? 0));
        if (!isNaN(num) && num < min) min = num;
      }
      return min === Infinity ? 0 : min;
    },
  },

  TEXT_HEIGHT: {
    name: 'TEXT_HEIGHT',
    signature: 'TEXT_HEIGHT(text, fontSize)',
    description: 'Estimated height of text in mm',
    returnType: 'number',
    fn: (args) => {
      const text = String(args[0] ?? '');
      const fontSize = typeof args[1] === 'number' ? args[1] : 12;
      try {
        const result = TextMeasurer.measureText(text, { fontSize, fontName: 'Arial' });
        return result.height;
      } catch {
        return 0;
      }
    },
  },

  TEXT_WIDTH: {
    name: 'TEXT_WIDTH',
    signature: 'TEXT_WIDTH(text, fontSize)',
    description: 'Estimated width of text in mm',
    returnType: 'number',
    fn: (args) => {
      const text = String(args[0] ?? '');
      const fontSize = typeof args[1] === 'number' ? args[1] : 12;
      try {
        const result = TextMeasurer.measureText(text, { fontSize, fontName: 'Arial' });
        return result.width;
      } catch {
        return 0;
      }
    },
  },

  CELL: {
    name: 'CELL',
    signature: 'CELL(rowIndex, colIndex)',
    description: 'Get value from a specific cell',
    returnType: 'string',
    fn: (args, ctx) => {
      const rowIndex = typeof args[0] === 'number' ? args[0] : parseInt(String(args[0] ?? 0));
      const colIndex = typeof args[1] === 'number' ? args[1] : parseInt(String(args[1] ?? 0));
      try {
        const cellId = ctx.structureStore.getBodyCell(rowIndex, colIndex);
        if (!cellId) return '';
        const cell = ctx.cellRegistry.getCellById(cellId);
        return cell?.rawValue ?? '';
      } catch {
        return '';
      }
    },
  },

  COLUMN: {
    name: 'COLUMN',
    signature: 'COLUMN(headerName)',
    description: 'Get column index by header name',
    returnType: 'number',
    fn: (args, ctx) => {
      const headerName = String(args[0] ?? '');
      try {
        // Find theader leaf cell with this rawValue
        const roots = ctx.structureStore.getRoots('theader');
        if (!roots) return -1;

        // Simplified: assume flat header (no tree depth)
        for (let i = 0; i < roots.length; i++) {
          const cellId = roots[i];
          const cell = ctx.cellRegistry.getCellById(cellId);
          if (cell?.rawValue === headerName) return i;
        }
        return -1;
      } catch {
        return -1;
      }
    },
  },
};

/**
 * FunctionRegistry — manages custom function registration.
 */
export class FunctionRegistry {
  private customFunctions: Map<string, FnDef> = new Map();

  constructor() {
    // Initialize with hardcoded functions
    for (const [name, def] of Object.entries(FUNCTION_DEFS)) {
      this.customFunctions.set(name, def);
    }
  }

  /**
   * Register a custom function.
   */
  public register(def: FnDef): void {
    this.customFunctions.set(def.name, def);
  }

  /**
   * Get a function by name.
   */
  public getFunction(name: string): FnDef | undefined {
    return this.customFunctions.get(name);
  }

  /**
   * Call a function with resolved arguments.
   */
  public call(name: string, args: any[], ctx: EvalContext): any {
    const fnDef = this.getFunction(name);
    if (!fnDef) throw new Error(`Unknown function: ${name}`);
    return fnDef.fn(args, ctx);
  }

  /**
   * Get list of all available functions (for canvas UI).
   */
  public getAvailableFunctions(): FnDef[] {
    return Array.from(this.customFunctions.values());
  }
}

/**
 * Global singleton function registry.
 */
export const functionRegistry = new FunctionRegistry();
