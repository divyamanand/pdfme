import { CellLayout, Region, CellStyle } from "../types/index";
import { ICell } from "../interfaces";

export class Cell implements ICell {
    private readonly _cellID: string;
    public inRegion: Region;
    public rawValue: string | number;
    public styleOverrides: Partial<CellStyle>;
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
    ) {
        this._cellID = cellID;
        this.inRegion = inRegion;
        this.rawValue = rawValue;
        this.isDynamic = isDynamic;
        this.styleOverrides = styleOverrides;
        this.computedValue = computedValue;
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
