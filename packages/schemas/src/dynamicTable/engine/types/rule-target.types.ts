/**
 * Rule target/selector types — identifies which cells a rule applies to.
 * Discriminated union by scope type.
 */

export type RuleScope = 'table' | 'region' | 'column' | 'row' | 'cell' | 'selection';

/**
 * TableTarget — rule applies to every cell in every region.
 * No additional selector needed.
 */
export interface TableTarget {
  scope: 'table';
}

/**
 * RegionTarget — rule applies to all cells in a named region.
 * Region: 'theader' | 'lheader' | 'rheader' | 'footer' | 'body'
 */
export interface RegionTarget {
  scope: 'region';
  region: 'theader' | 'lheader' | 'rheader' | 'footer' | 'body';
}

/**
 * ColumnTarget — rule applies to all body cells in one column.
 * Identified by headerName (preferred, semantic) or colIndex (raw, fragile).
 *
 * headerName: the theader leaf cell's rawValue (user-friendly for canvas)
 *   → engine resolves to colIndex via StructureStore.getBodyIndexForHeaderLeafCell()
 *
 * colIndex: 0-based absolute column index (fallback, used by programmatic rules)
 *
 * includeHeader: if true, also apply to the theader leaf cell itself (default false)
 */
export type ColumnTarget =
  | {
      scope: 'column';
      headerName: string;
      includeHeader?: boolean;
    }
  | {
      scope: 'column';
      colIndex: number;
      includeHeader?: boolean;
    };

/**
 * RowTarget — rule applies to all cells in one body row (or header depth).
 *
 * region: default 'body'; for 'theader', rowIndex means tree depth level (0 = root)
 *
 * rowIndex: 0-based within that region
 */
export interface RowTarget {
  scope: 'row';
  rowIndex: number;
  region?: 'theader' | 'body';
}

/**
 * CellTarget — rule applies to exactly one cell.
 *
 * cellId (preferred): stable reference (UUID), works for header + body cells
 *   → canvas click → engine returns cellId → rule stores cellId
 *
 * address: [rowIndex, colIndex] for body cells only; used by programmatic rules
 */
export type CellTarget =
  | {
      scope: 'cell';
      cellId: string;
    }
  | {
      scope: 'cell';
      address: {
        rowIndex: number;
        colIndex: number;
      };
    };

/**
 * SelectionTarget — rule applies to a rectangular selection of body cells.
 *
 * All bounds are 0-based body indices; endRow/endCol are inclusive.
 */
export interface SelectionTarget {
  scope: 'selection';
  rect: {
    rowStart: number;
    colStart: number;
    rowEnd: number;
    colEnd: number;
  };
}

/**
 * RuleTarget — discriminated union of all rule scope types.
 * Identifies which cells a rule applies to.
 */
export type RuleTarget = TableTarget | RegionTarget | ColumnTarget | RowTarget | CellTarget | SelectionTarget;
