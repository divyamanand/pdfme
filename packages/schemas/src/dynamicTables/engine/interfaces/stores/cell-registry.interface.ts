import {CellPayload, CellStyle, Region } from "../../types";
import { ICell } from "../core";

export interface ICellRegistry {
    //keep them private in class
    // cellsById: Map<string, ICell>
    // cellsByAddress: Map<string, ICell>

    //add new cell in a region, just create an random id and store the cell
    createCell(region: Region, rawValue?: string, style?: Partial<CellStyle>, isDynamic?: boolean): string
    // Restore a cell with a specific ID (used during deserialization to preserve references)
    createCellWithId(cellId: string, region: Region, rawValue?: string, style?: Partial<CellStyle>, isDynamic?: boolean, computedValue?: string | number): string
    getCellById(cellId: string): ICell | undefined
    getCellByAddress(address: string): ICell | undefined
    updateCell(cellId: string, payload: CellPayload): void
    deleteCell(cellId: string): void
    setCellAddress(cellId: string, row: number, col: number): void
    clearCellAddress(cellId: string): void
}