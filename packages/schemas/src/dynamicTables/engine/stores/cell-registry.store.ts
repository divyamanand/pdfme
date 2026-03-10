import { Cell } from "../core";
import { ICell, ICellRegistry } from "../interfaces";
import { CellPayload, CellStyle, Region } from "../types";
import {v1 as uuid} from "uuid"

/** @deprecated Import from '../styles' instead */
export { defaultCellStyle } from "../styles/defaults"

/** @deprecated Use defaultCellStyle from '../styles' instead */
export { defaultCellStyle as defaultStyle } from "../styles/defaults"

export class CellRegistry implements ICellRegistry {

    private cellsById: Map<string, ICell>
    private cellsByAddress: Map<string, ICell>
    private cellIdToAddress: Map<string, string> = new Map()

    constructor(
    ){
        this.cellsById  = new Map()
        this.cellsByAddress = new Map()
    }

    private toAddressKey(row: number, col: number): string {
        return `${row},${col}`
    }

    setCellAddress(cellId: string, row: number, col: number): void {
        const key = this.toAddressKey(row, col)
        const cell = this.cellsById.get(cellId)
        if (cell) {
            // Clear the old address if this cellId already has one
            this.clearCellAddress(cellId)
            this.cellsByAddress.set(key, cell)
            this.cellIdToAddress.set(cellId, key)
        }
    }

    clearCellAddress(cellId: string): void {
        const key = this.cellIdToAddress.get(cellId)
        if (key) {
            this.cellsByAddress.delete(key)
            this.cellIdToAddress.delete(cellId)
        }
    }

    createCell(region: Region, rawValue?: string, style?: Partial<CellStyle>, isDynamic?: boolean): string {
        const randomId = uuid()
        const newCell = new Cell(randomId, region, rawValue ?? "Cell", isDynamic ?? false, style)
        this.cellsById.set(randomId, newCell)
        return randomId
    }

    createCellWithId(cellId: string, region: Region, rawValue?: string, style?: Partial<CellStyle>, isDynamic?: boolean, computedValue?: string | number): string {
        const newCell = new Cell(cellId, region, rawValue ?? "Cell", isDynamic ?? false, style, computedValue)
        this.cellsById.set(cellId, newCell)
        return cellId
    }

    deleteCell(cellId: string): void {
        this.clearCellAddress(cellId)
        this.cellsById.delete(cellId)
    }
    getCellByAddress(address: string): ICell | undefined {
        return this.cellsByAddress.get(address)
    }
    getCellById(cellId: string): ICell | undefined {
        return this.cellsById.get(cellId)
    }
    updateCell(cellId: string, payload: CellPayload): void {
        const cell = this.cellsById.get(cellId)
        if (cell) {
            const {inRegion, rawValue, computedValue, style} = payload

            if (inRegion) {
                cell.inRegion = inRegion
            }

            if (rawValue !== undefined) {
                cell.rawValue = rawValue
            }

            if ('computedValue' in payload) {
                cell.computedValue = computedValue
            }

            if (style) {
                cell.styleOverrides = { ...cell.styleOverrides, ...style }
            }
        }
    }
}
