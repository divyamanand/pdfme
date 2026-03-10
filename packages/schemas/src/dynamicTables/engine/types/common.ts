import type { ICell } from '../interfaces/core/cell.interface';

export interface CellAddress {
    rowNumber: number;
    colNumber: number
}


export interface CellLayout {
    readonly row: number;
    readonly col: number;
    readonly rowSpan: number;
    readonly colSpan: number;
    readonly x: number;       // mm from table left edge
    readonly y: number;       // mm from table top edge
    readonly width: number;   // mm (sum of spanned column widths)
    readonly height: number;  // mm (sum of spanned row heights)
}

export interface TablePosition {
    x: number;    // mm from page left
    y: number;    // mm from page top
}

export type Region = 'theader' | 'lheader' | 'rheader' | 'footer' | 'body'

// ---------------------------------------------------------------------------
// Style types (pdfme-compatible)
// ---------------------------------------------------------------------------

export type Spacing = { top: number; right: number; bottom: number; left: number }

export type Alignment = 'left' | 'center' | 'right' | 'justify'
export type VerticalAlignment = 'top' | 'middle' | 'bottom'

export interface CellStyle {
    fontName?: string;
    bold: boolean;
    italic: boolean;
    alignment: Alignment;
    verticalAlignment: VerticalAlignment;
    fontSize: number;
    lineHeight: number;
    characterSpacing: number;
    fontColor: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: Spacing;
    padding: Spacing;
}

/** @deprecated Use CellStyle instead */
export type Style = CellStyle

// ---------------------------------------------------------------------------
// Table-level style types
// ---------------------------------------------------------------------------

/** Visual frame of the table (outer border, outline, corner radius) */
export interface TableStyle {
    borderColor?: string;
    borderWidth?: Spacing;
    outline?: {
        color?: string;
        width?: number;
        style?: 'solid' | 'dashed' | 'dotted';
    };
    cornerRadius?: {
        topLeft?: number;
        topRight?: number;
        bottomLeft?: number;
        bottomRight?: number;
    };
}

// ---------------------------------------------------------------------------
// Region-level style types
// ---------------------------------------------------------------------------

/** Per-region style defaults — same shape as CellStyle but fully optional */
export type RegionStyle = Partial<CellStyle>

/** Body region gets an extra alternating row color property */
export interface BodyRegionStyle extends RegionStyle {
    alternateBackgroundColor?: string;
}

/** Map of region → style overrides */
export type RegionStyleMap = {
    theader?: RegionStyle;
    lheader?: RegionStyle;
    rheader?: RegionStyle;
    footer?: RegionStyle;
    body?: BodyRegionStyle;
}

// ---------------------------------------------------------------------------
// Deprecated — kept for backward compatibility, will be removed
// ---------------------------------------------------------------------------

/** @deprecated Use TableStyle instead */
export interface TableStyles {
    borderColor: string;
    borderWidth: number;
}

/** @deprecated Use BodyRegionStyle instead */
export interface BodyStyles extends CellStyle {
    alternateBackgroundColor: string;
}

/** @deprecated No longer used — column alignment handled via region styles */
export interface ColumnStyleOverrides {
    alignment?: Record<number, Alignment>;
}

// ---------------------------------------------------------------------------

export type Rect = {
   cellId: string
   startRow: number
   startCol: number
   endRow: number
   endCol: number
   primaryRegion?: Region
}


export type CellPayload = {
    inRegion?: Region;
    rawValue?: string | number;
    style?: Partial<CellStyle>;
    computedValue?: string | number;
}

export type OverflowMode = 'wrap' | 'increase-height' | 'increase-width'

export type FooterPlacement =
    | { mode: 'every-page' }
    | { mode: 'last-page' }
    | { mode: 'custom'; pages: number[] }

export interface PaginationSettings {
    pageSize?: number
    repeatHeaders?: boolean
}

export interface HeaderVisibility {
    theader?: boolean
    lheader?: boolean
    rheader?: boolean
}

export interface TableSettings {
    minRows?: number
    maxRows?: number
    minCols?: number
    maxCols?: number
    overflow?: OverflowMode
    footer?: FooterPlacement
    headerVisibility?: HeaderVisibility
    pagination?: PaginationSettings
}
