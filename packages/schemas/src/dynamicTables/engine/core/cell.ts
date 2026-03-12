import { CellLayout, Region, CellStyle, OverflowMode } from "../types/index";
import { ICell } from "../interfaces";

export class Cell implements ICell {
    private readonly _cellID: string;
    public inRegion: Region;
    public rawValue: string | number;
    public styleOverrides: Partial<CellStyle>;
    public overflow?: OverflowMode;
    public isDynamic: boolean;
    public computedValue?: string | number;

    private _layout?: CellLayout;

    constructor(
        cellID: string,
        inRegion: Region,
        rawValue: string | number,
        isDynamic: boolean = false,
        styleOverrides: Partial<CellStyle> = {},
        computedValue?: string | number,
        overflow?: OverflowMode,
    ) {
        this._cellID = cellID;
        this.inRegion = inRegion;
        this.rawValue = rawValue;
        this.isDynamic = isDynamic;
        this.styleOverrides = styleOverrides;
        this.computedValue = computedValue;
        this.overflow = overflow;
    }

    public get cellID(): string {
        return this._cellID;
    }

    public get layout(): CellLayout | undefined {
        return this._layout;
    }

    public clearLayout(): void {
    this._layout = undefined;
}

    public _setLayout(layout: CellLayout): void {
        this._layout = layout;
    }
}
