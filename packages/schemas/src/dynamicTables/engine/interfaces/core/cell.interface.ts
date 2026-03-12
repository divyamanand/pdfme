import { CellLayout, Region, CellStyle, OverflowMode } from "../../types/index";

export interface ICell {
    cellID: string;
    readonly layout?: CellLayout;
    inRegion: Region;
    rawValue: string | number;
    /** Per-cell style overrides (partial). Resolved to full CellStyle at render time via cascade. */
    styleOverrides: Partial<CellStyle>;
    /** Per-cell overflow mode override. When set, takes priority over the table-level setting. */
    overflow?: OverflowMode;
    isDynamic: boolean;
    computedValue?: string | number;

    // _setLayout(layout: CellLayout): void; create this method in concrete class as private
}
