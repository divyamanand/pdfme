import type { CellStyle, RegionStyle, Spacing } from '../types'
import { defaultCellStyle } from './defaults'

/**
 * Deep-merge a Spacing object: only override individual sides that are defined.
 */
function mergeSpacing(base: Spacing, override?: Partial<Spacing>): Spacing {
    if (!override) return base
    return {
        top: override.top ?? base.top,
        right: override.right ?? base.right,
        bottom: override.bottom ?? base.bottom,
        left: override.left ?? base.left,
    }
}

/**
 * Merge a partial CellStyle override onto a complete CellStyle base.
 * Handles nested Spacing objects (borderWidth, padding) with per-side granularity.
 */
function mergeStyleLayer(base: CellStyle, override?: Partial<CellStyle>): CellStyle {
    if (!override) return base

    return {
        fontName: override.fontName !== undefined ? override.fontName : base.fontName,
        bold: override.bold ?? base.bold,
        italic: override.italic ?? base.italic,
        alignment: override.alignment ?? base.alignment,
        verticalAlignment: override.verticalAlignment ?? base.verticalAlignment,
        fontSize: override.fontSize ?? base.fontSize,
        lineHeight: override.lineHeight ?? base.lineHeight,
        characterSpacing: override.characterSpacing ?? base.characterSpacing,
        fontColor: override.fontColor ?? base.fontColor,
        backgroundColor: override.backgroundColor ?? base.backgroundColor,
        borderColor: override.borderColor ?? base.borderColor,
        borderWidth: mergeSpacing(base.borderWidth, override.borderWidth as Partial<Spacing> | undefined),
        padding: mergeSpacing(base.padding, override.padding as Partial<Spacing> | undefined),
    }
}

/**
 * Resolve a cell's final CellStyle through the three-level cascade:
 *
 *   1. defaultCellStyle        (hardcoded baseline)
 *   2. regionStyle             (partial override from region)
 *   3. cellOverrides           (partial override from cell)
 *   4. rulePatches             (partial overrides from rules, applied in order)
 *
 * Returns a complete CellStyle with every property defined.
 */
export function resolveStyle(
    regionStyle?: RegionStyle,
    cellOverrides?: Partial<CellStyle>,
    ...rulePatches: (Partial<CellStyle> | undefined)[]
): CellStyle {
    let resolved = mergeStyleLayer(defaultCellStyle, regionStyle)
    resolved = mergeStyleLayer(resolved, cellOverrides)

    for (const patch of rulePatches) {
        if (patch) {
            resolved = mergeStyleLayer(resolved, patch)
        }
    }

    return resolved
}
