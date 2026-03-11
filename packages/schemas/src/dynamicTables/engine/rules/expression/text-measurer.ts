/**
 * TextMeasurer — pure engine-side text measurement.
 * No renderer involved; uses font metric approximation.
 *
 * Font metric approximation:
 *   charHeight = fontSize × 0.353 mm  (based on 72 DPI standard)
 *   charWidth  = charHeight × 0.6     (monospace-ish approximation)
 *
 * This allows overflow detection and font size fitting without a renderer.
 */

import type { ICell } from '../../interfaces/core/cell.interface';

export interface TextMetrics {
  width: number; // mm
  height: number; // mm
}

export interface FontStyle {
  fontName?: string;
  fontSize: number; // pt or similar unit
}

/**
 * TextMeasurer — estimates text dimensions based on font metrics.
 */
export class TextMeasurer {
  /**
   * Measure text dimensions (width and height).
   * @param text - text to measure
   * @param style - font size and family
   * @returns width and height in mm
   */
  public static measureText(text: string, style: FontStyle): TextMetrics {
    const fontSize = style.fontSize || 12; // default 12pt
    const charHeight = fontSize * 0.353; // mm per pt
    const charWidth = charHeight * 0.6; // rough monospace approximation

    // Split into lines (newlines)
    const lines = text.split('\n');
    let maxLineWidth = 0;
    let totalHeight = 0;

    for (const line of lines) {
      const lineWidth = line.length * charWidth;
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
      totalHeight += charHeight;
    }

    return {
      width: maxLineWidth,
      height: totalHeight,
    };
  }

  /**
   * Check if text overflows a cell.
   * @param cell - the cell to check
   * @returns true if text overflows bounds
   */
  public static cellOverflows(cell: ICell): boolean {
    if (!cell.layout) return false;

    const text = String(cell.rawValue ?? '');
    const fontSize = cell.styleOverrides?.fontSize || 12;
    const metrics = this.measureText(text, { fontSize });

    // Subtract padding from available dimensions
    const padding = cell.styleOverrides?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const availWidth = cell.layout.width - padding.left - padding.right;
    const availHeight = cell.layout.height - padding.top - padding.bottom;

    // Check both width and height with small margin
    return metrics.width > availWidth * 0.98 || metrics.height > availHeight * 0.98;
  }

  /**
   * Find the largest font size that fits content in a cell.
   * Iterates downward from current size until content fits or hits floor.
   *
   * @param text - text to fit
   * @param style - current font style
   * @param cellWidth - available width in mm
   * @param cellHeight - available height in mm
   * @param minFontSize - minimum acceptable font size (default 6)
   * @returns font size that fits, or minFontSize if nothing fits
   */
  public static findFittingFontSize(
    text: string,
    style: FontStyle,
    cellWidth: number,
    cellHeight: number,
    minFontSize: number = 6,
  ): number {
    let fontSize = style.fontSize || 12;
    const step = 0.5; // decrease by 0.5pt each iteration

    // Try decreasing font size until wrapped text fits within cell height
    while (fontSize >= minFontSize) {
      const requiredHeight = this.measureRequiredHeight(text, cellWidth, { fontSize });
      if (requiredHeight <= cellHeight) {
        return fontSize;
      }
      fontSize -= step;
    }

    return minFontSize;
  }

  /**
   * Wrap text to fit within a width, calculating resulting height.
   * Simple word-wrap approximation (splits on spaces).
   *
   * @param text - text to wrap
   * @param width - target width in mm
   * @param fontSize - font size in pt
   * @returns wrapped text and its height
   */
  /**
   * Measure the required height for text wrapped within a given width.
   * Accounts for lineHeight and characterSpacing from the cell style.
   *
   * @param text - text to measure
   * @param availableWidth - available width in mm (after padding)
   * @param style - fontSize (pt), lineHeight (multiplier), characterSpacing (pt)
   * @returns required height in mm
   */
  public static measureRequiredHeight(
    text: string,
    availableWidth: number,
    style: { fontSize: number; lineHeight?: number; characterSpacing?: number },
  ): number {
    if (!text) return 0;

    const fontSize = style.fontSize || 12;
    const charHeightMm = fontSize * 0.353;
    const charWidthMm = charHeightMm * 0.6 + (style.characterSpacing ?? 0) * 0.353;
    const lineHeightMm = charHeightMm * (style.lineHeight ?? 1);

    const charsPerLine = Math.max(1, Math.floor(availableWidth / charWidthMm));

    const explicitLines = text.split('\n');
    let totalVisualLines = 0;

    for (const line of explicitLines) {
      if (line.length === 0) {
        totalVisualLines += 1; // empty line still takes one visual line
      } else {
        totalVisualLines += Math.ceil(line.length / charsPerLine);
      }
    }

    return totalVisualLines * lineHeightMm;
  }

  /**
   * Measure the required width for text as a single line (no wrapping).
   * Finds the widest line among newline-split lines.
   *
   * @param text - text to measure
   * @param style - fontSize (pt), characterSpacing (pt)
   * @returns required width in mm
   */
  public static measureRequiredWidth(
    text: string,
    style: { fontSize: number; characterSpacing?: number },
  ): number {
    if (!text) return 0;

    const fontSize = style.fontSize || 12;
    const charHeightMm = fontSize * 0.353;
    const charWidthMm = charHeightMm * 0.6 + (style.characterSpacing ?? 0) * 0.353;

    const lines = text.split('\n');
    let maxLen = 0;
    for (const line of lines) {
      if (line.length > maxLen) maxLen = line.length;
    }

    return maxLen * charWidthMm;
  }

  public static wrapText(text: string, width: number, fontSize: number): { text: string; height: number } {
    const charHeight = fontSize * 0.353;
    const charWidth = charHeight * 0.6;
    const charsPerLine = Math.floor(width / charWidth);

    if (charsPerLine <= 0) {
      // Width too small, return original
      return { text, height: charHeight };
    }

    const lines: string[] = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).length <= charsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    const wrappedText = lines.join('\n');
    const height = lines.length * charHeight;

    return { text: wrappedText, height };
  }
}
