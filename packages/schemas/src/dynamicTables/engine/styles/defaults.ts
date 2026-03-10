import type { CellStyle, TableStyle, RegionStyleMap } from '../types'

/** Hardcoded baseline — every CellStyle property has a value */
export const defaultCellStyle: CellStyle = {
    fontName: undefined,
    bold: false,
    italic: false,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    borderColor: '#888888',
    borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
    padding: { top: 5, right: 5, bottom: 5, left: 5 },
}

/** Default table-level visual frame */
export const defaultTableStyle: TableStyle = {
    borderColor: '#888888',
    borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
}

/** Default region styles (empty — all regions fall through to defaultCellStyle) */
export const defaultRegionStyles: RegionStyleMap = {}
