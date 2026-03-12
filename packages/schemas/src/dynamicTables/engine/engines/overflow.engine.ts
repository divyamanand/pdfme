/**
 * OverflowEngine — enforces cell-level overflow settings.
 *
 * Called after LayoutEngine.rebuild() (cells have geometry) and before
 * RuleEngine.evaluateAll() (rules operate on corrected geometry).
 *
 * Modes:
 *   - wrap:            shrink font size to fit text in cell; clip at fontSize=1
 *   - increase-height: grow row heights so text fits (per-row max across all cells)
 *   - increase-width:  grow column widths so text fits (per-col max across all cells)
 *
 * increase-height/width only grow dimensions — never shrink.
 * wrap produces style patches (fontSize) stored externally, not on cell.styleOverrides.
 */

import type { ICellRegistry } from '../interfaces/stores/cell-registry.interface'
import type { IStructureStore } from '../interfaces/stores/structure-store.interface'
import type { ILayoutEngine } from '../interfaces/engines/layout-engine.interface'
import type { ICell } from '../interfaces/core/cell.interface'
import type { CellStyle, OverflowMode, Region, RegionStyleMap } from '../types'
import { resolveStyle } from '../styles/resolve'
import { TextMeasurer } from '../rules/expression/text-measurer'

const HEADER_REGIONS: readonly Region[] = ['theader', 'lheader', 'rheader', 'footer']

export class OverflowEngine {
    private patches: Map<string, Partial<CellStyle>> = new Map()

    constructor(
        private cellRegistry: ICellRegistry,
        private structureStore: IStructureStore,
        private layoutEngine: ILayoutEngine,
    ) {}

    /**
     * Run all overflow modes. Each cell uses its own overflow mode if set,
     * otherwise falls back to the provided global mode.
     * We must run all three strategies in a single pass over cells.
     */
    getStylePatch(cellId: string): Partial<CellStyle> | undefined {
        return this.patches.get(cellId)
    }

    applyAll(
        globalMode: OverflowMode,
        regionStyles: RegionStyleMap,
    ): void {
        this.patches.clear()
        // Collect per-mode cell lists
        const wrapCells: ICell[] = []
        const increaseHeightRows: Map<number, { cell: ICell; style: CellStyle }[]> = new Map()
        const increaseWidthCols: Map<number, { cell: ICell; style: CellStyle }[]> = new Map()

        this.walkAllCells((cell) => {
            const layout = cell.layout
            if (!layout || layout.rowSpan === 0 || layout.colSpan === 0) return

            const text = String(cell.computedValue ?? cell.rawValue ?? '')
            if (!text) return

            const mode = cell.overflow ?? globalMode

            const style = resolveStyle(
                regionStyles[cell.inRegion as keyof RegionStyleMap],
                cell.styleOverrides,
            )

            if (mode === 'wrap') {
                wrapCells.push(cell)
            } else if (mode === 'increase-height') {
                for (let r = layout.row; r < layout.row + layout.rowSpan; r++) {
                    if (!increaseHeightRows.has(r)) increaseHeightRows.set(r, [])
                    increaseHeightRows.get(r)!.push({ cell, style })
                }
            } else if (mode === 'increase-width') {
                for (let c = layout.col; c < layout.col + layout.colSpan; c++) {
                    if (!increaseWidthCols.has(c)) increaseWidthCols.set(c, [])
                    increaseWidthCols.get(c)!.push({ cell, style })
                }
            }
        })

        // 1. Wrap — shrink font size
        for (const cell of wrapCells) {
            const layout = cell.layout!
            const text = String(cell.computedValue ?? cell.rawValue ?? '')
            const style = resolveStyle(
                regionStyles[cell.inRegion as keyof RegionStyleMap],
                cell.styleOverrides,
            )
            const availWidth = layout.width - style.padding.left - style.padding.right
            const availHeight = layout.height - style.padding.top - style.padding.bottom
            if (availWidth <= 0 || availHeight <= 0) continue

            const requiredHeight = TextMeasurer.measureRequiredHeight(text, availWidth, style)
            if (requiredHeight <= availHeight) continue

            const fittingSize = TextMeasurer.findFittingFontSize(
                text,
                { fontSize: style.fontSize },
                availWidth,
                availHeight,
                1,
            )
            if (fittingSize < style.fontSize) {
                this.patches.set(cell.cellID, { fontSize: fittingSize })
            }
        }

        // 2. Increase height
        if (increaseHeightRows.size > 0) {
            this.applyIncreaseHeightForCells(regionStyles, increaseHeightRows)
        }

        // 3. Increase width
        if (increaseWidthCols.size > 0) {
            this.applyIncreaseWidthForCells(regionStyles, increaseWidthCols)
        }
    }

    // ------------------------------------------------------------------
    // increase-height: grow row heights to fit wrapped text
    // ------------------------------------------------------------------

    private applyIncreaseHeightForCells(
        regionStyles: RegionStyleMap,
        _cellsByRow: Map<number, { cell: ICell; style: CellStyle }[]>,
    ): void {
        const rowHeights = this.layoutEngine.getRowHeights()
        const required = [...rowHeights]

        this.walkAllCells((cell) => {
            const layout = cell.layout
            if (!layout || layout.rowSpan === 0 || layout.colSpan === 0) return
            // Only process cells whose effective mode is increase-height
            // We already filtered above, but for merged cells spanning multiple rows
            // we need to check per-cell
            const mode = cell.overflow
            if (mode !== undefined && mode !== 'increase-height') return
            // If no per-cell mode, this cell will only be here if global mode is increase-height
            // But we walk all cells, so skip cells not in the collected set
            let found = false
            for (let r = layout.row; r < layout.row + layout.rowSpan; r++) {
                if (_cellsByRow.has(r)) { found = true; break }
            }
            if (!found) return

            const text = String(cell.computedValue ?? cell.rawValue ?? '')
            if (!text) return

            const style = resolveStyle(
                regionStyles[cell.inRegion as keyof RegionStyleMap],
                cell.styleOverrides,
            )
            const availWidth = layout.width - style.padding.left - style.padding.right
            if (availWidth <= 0) return

            const textHeight = TextMeasurer.measureRequiredHeight(text, availWidth, style)
            const neededHeight = textHeight + style.padding.top + style.padding.bottom

            if (layout.rowSpan === 1) {
                if (neededHeight > required[layout.row]) {
                    required[layout.row] = neededHeight
                }
            } else {
                let spannedSum = 0
                for (let r = layout.row; r < layout.row + layout.rowSpan; r++) {
                    spannedSum += required[r]
                }
                if (neededHeight > spannedSum) {
                    const lastRow = layout.row + layout.rowSpan - 1
                    required[lastRow] += neededHeight - spannedSum
                }
            }
        })

        let changed = false
        for (let i = 0; i < required.length; i++) {
            if (required[i] > rowHeights[i]) {
                this.layoutEngine.setRowHeight(i, required[i])
                changed = true
            }
        }
        if (changed) {
            this.layoutEngine.rebuildGeometry()
        }
    }

    // ------------------------------------------------------------------
    // increase-width: grow column widths to fit single-line text
    // ------------------------------------------------------------------

    private applyIncreaseWidthForCells(
        regionStyles: RegionStyleMap,
        _cellsByCol: Map<number, { cell: ICell; style: CellStyle }[]>,
    ): void {
        const colWidths = this.layoutEngine.getColumnWidths()
        const required = [...colWidths]

        this.walkAllCells((cell) => {
            const layout = cell.layout
            if (!layout || layout.rowSpan === 0 || layout.colSpan === 0) return
            const mode = cell.overflow
            if (mode !== undefined && mode !== 'increase-width') return
            let found = false
            for (let c = layout.col; c < layout.col + layout.colSpan; c++) {
                if (_cellsByCol.has(c)) { found = true; break }
            }
            if (!found) return

            const text = String(cell.computedValue ?? cell.rawValue ?? '')
            if (!text) return

            const style = resolveStyle(
                regionStyles[cell.inRegion as keyof RegionStyleMap],
                cell.styleOverrides,
            )
            const textWidth = TextMeasurer.measureRequiredWidth(text, style)
            const neededWidth = textWidth + style.padding.left + style.padding.right

            if (layout.colSpan === 1) {
                if (neededWidth > required[layout.col]) {
                    required[layout.col] = neededWidth
                }
            } else {
                let spannedSum = 0
                for (let c = layout.col; c < layout.col + layout.colSpan; c++) {
                    spannedSum += required[c]
                }
                if (neededWidth > spannedSum) {
                    const lastCol = layout.col + layout.colSpan - 1
                    required[lastCol] += neededWidth - spannedSum
                }
            }
        })

        let changed = false
        for (let i = 0; i < required.length; i++) {
            if (required[i] > colWidths[i]) {
                this.layoutEngine.setColumnWidth(i, required[i])
                changed = true
            }
        }
        if (changed) {
            this.layoutEngine.rebuildGeometry()
        }
    }

    // ------------------------------------------------------------------
    // Walk all cells across header trees and body grid
    // ------------------------------------------------------------------

    private walkAllCells(callback: (cell: ICell) => void): void {
        for (const region of HEADER_REGIONS) {
            const roots = this.structureStore.getRoots(region)
            if (roots) {
                for (const rootId of roots) {
                    this.walkTree(rootId, callback)
                }
            }
        }

        for (const row of this.structureStore.getBody()) {
            for (const cellId of row) {
                const cell = this.cellRegistry.getCellById(cellId)
                if (cell) callback(cell)
            }
        }
    }

    private walkTree(cellId: string, callback: (cell: ICell) => void): void {
        const cell = this.cellRegistry.getCellById(cellId)
        if (cell) callback(cell)
        const children = this.structureStore.getChildren(cellId)
        if (children) {
            for (const childId of children) {
                this.walkTree(childId, callback)
            }
        }
    }
}
