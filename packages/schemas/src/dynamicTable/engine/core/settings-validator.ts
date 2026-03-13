import type { TableSettings } from '../types'

/**
 * Validates TableSettings patches and computes effective constraint values.
 * Extracted from Table facade to keep pure validation logic separate.
 */
export class SettingsValidator {
    static validate(
        patch: Partial<TableSettings>,
        merged: TableSettings,
    ): string | null {
        // Row constraints
        const { minRows, maxRows } = merged
        if (minRows !== undefined && maxRows !== undefined && minRows > maxRows) {
            if (patch.minRows !== undefined) {
                return `Min Rows (${minRows}) cannot exceed Max Rows (${maxRows})`
            }
            if (patch.maxRows !== undefined) {
                return `Max Rows (${maxRows}) cannot be less than Min Rows (${minRows})`
            }
        }
        // Col constraints
        const { minCols, maxCols } = merged
        if (minCols !== undefined && maxCols !== undefined && minCols > maxCols) {
            if (patch.minCols !== undefined) {
                return `Min Cols (${minCols}) cannot exceed Max Cols (${maxCols})`
            }
            if (patch.maxCols !== undefined) {
                return `Max Cols (${maxCols}) cannot be less than Min Cols (${minCols})`
            }
        }
        return null
    }

    static getEffectiveMaxRows(settings: TableSettings): number | undefined {
        const { maxRows, minRows } = settings
        if (maxRows === undefined) return undefined
        if (minRows === undefined) return maxRows
        return Math.max(maxRows, minRows)
    }

    static getEffectiveMaxCols(settings: TableSettings): number | undefined {
        const { maxCols, minCols } = settings
        if (maxCols === undefined) return undefined
        if (minCols === undefined) return maxCols
        return Math.max(maxCols, minCols)
    }
}
