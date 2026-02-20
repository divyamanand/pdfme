import type { Font } from './types.js';

/**
 * Font registry entry with metadata and variant mappings.
 * Used to define all available fonts and their bold/italic variants.
 */
export interface FontRegistryEntry {
  fallback: boolean;
  subset?: boolean;
  label: string;
  category: 'sans-serif' | 'serif' | 'handwriting' | 'monospace';
  variants?: { bold?: string; italic?: string; boldItalic?: string };
}

/**
 * Complete font registry.
 * Maps font names to their metadata and variant names.
 * Bold/italic variants are resolved by name lookup when bold/italic flags are used.
 */
export const FONT_REGISTRY: Record<string, FontRegistryEntry> = {
  'Roboto': {
    fallback: true,
    category: 'sans-serif',
    label: 'Roboto',
    variants: { bold: 'Roboto', italic: 'Roboto' },
  },
  'OpenSans-Regular': {
    fallback: false,
    category: 'sans-serif',
    label: 'Open Sans',
    variants: {
      bold: 'OpenSans-Bold',
      italic: 'OpenSans-Italic',
      boldItalic: 'OpenSans-BoldItalic',
    },
  },
  'OpenSans-Bold': {
    fallback: false,
    category: 'sans-serif',
    label: 'Open Sans Bold',
  },
  'OpenSans-Italic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Open Sans Italic',
  },
  'OpenSans-BoldItalic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Open Sans Bold Italic',
  },
  'Lato-Regular': {
    fallback: false,
    category: 'sans-serif',
    label: 'Lato',
    variants: {
      bold: 'Lato-Bold',
      italic: 'Lato-Italic',
      boldItalic: 'Lato-BoldItalic',
    },
  },
  'Lato-Bold': {
    fallback: false,
    category: 'sans-serif',
    label: 'Lato Bold',
  },
  'Lato-Italic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Lato Italic',
  },
  'Lato-BoldItalic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Lato Bold Italic',
  },
  'Montserrat-Regular': {
    fallback: false,
    category: 'sans-serif',
    label: 'Montserrat',
    variants: {
      bold: 'Montserrat-Bold',
      italic: 'Montserrat-Italic',
      boldItalic: 'Montserrat-BoldItalic',
    },
  },
  'Montserrat-Bold': {
    fallback: false,
    category: 'sans-serif',
    label: 'Montserrat Bold',
  },
  'Montserrat-Italic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Montserrat Italic',
  },
  'Montserrat-BoldItalic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Montserrat Bold Italic',
  },
  'SourceSansPro-Regular': {
    fallback: false,
    category: 'sans-serif',
    label: 'Source Sans Pro',
    variants: {
      bold: 'SourceSansPro-Bold',
      italic: 'SourceSansPro-Italic',
      boldItalic: 'SourceSansPro-BoldItalic',
    },
  },
  'SourceSansPro-Bold': {
    fallback: false,
    category: 'sans-serif',
    label: 'Source Sans Pro Bold',
  },
  'SourceSansPro-Italic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Source Sans Pro Italic',
  },
  'SourceSansPro-BoldItalic': {
    fallback: false,
    category: 'sans-serif',
    label: 'Source Sans Pro Bold Italic',
  },
  'PinyonScript-Regular': {
    fallback: false,
    category: 'handwriting',
    label: 'Pinyon Script',
  },
  'DancingScript-Regular': {
    fallback: false,
    category: 'handwriting',
    label: 'Dancing Script',
    variants: { bold: 'DancingScript-Bold' },
  },
  'DancingScript-Bold': {
    fallback: false,
    category: 'handwriting',
    label: 'Dancing Script Bold',
  },
  'GreatVibes-Regular': {
    fallback: false,
    category: 'handwriting',
    label: 'Great Vibes',
  },
};

/**
 * Get list of all available font names
 */
export const getAvailableFontNames = (): string[] => Object.keys(FONT_REGISTRY);

/**
 * Resolve a font name with bold/italic flags to the appropriate font variant.
 * For example: resolveFontVariant('OpenSans-Regular', true, false, fontMap)
 * returns 'OpenSans-Bold' if available, otherwise 'OpenSans-Regular'.
 *
 * @param fontName - Base font name
 * @param bold - Whether bold is requested
 * @param italic - Whether italic is requested
 * @param availableFonts - Font map (keys are available font names)
 * @returns The resolved font name (variant or fallback to original)
 */
export const resolveFontVariant = (
  fontName: string,
  bold: boolean,
  italic: boolean,
  availableFonts: Record<string, unknown>,
): string => {
  if (!bold && !italic) return fontName;

  const entry = FONT_REGISTRY[fontName];
  if (!entry?.variants) return fontName;

  const { variants } = entry;

  // Try bold+italic first, then bold, then italic
  if (bold && italic && variants.boldItalic && availableFonts[variants.boldItalic]) {
    return variants.boldItalic;
  }
  if (bold && variants.bold && availableFonts[variants.bold]) {
    return variants.bold;
  }
  if (italic && variants.italic && availableFonts[variants.italic]) {
    return variants.italic;
  }

  return fontName; // fallback to original
};

/**
 * Google Fonts CDN URLs for all supported fonts.
 * Map font names to their Google Fonts CDN URLs.
 */
export const GOOGLE_FONTS_URLS: Record<string, string> = {
  'OpenSans-Regular': 'https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4nY1U2xQ.ttf',
  'OpenSans-Bold': 'https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1y4nY1U2xQ.ttf',
  'OpenSans-Italic': 'https://fonts.gstatic.com/s/opensans/v44/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0Rk8ZkaVcUx6EQ.ttf',
  'OpenSans-BoldItalic': 'https://fonts.gstatic.com/s/opensans/v44/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0RkyFjaVcUx6EQ.ttf',
  'Lato-Regular': 'https://fonts.gstatic.com/s/lato/v25/S6uyw4BMUTPHvxk6WQev.ttf',
  'Lato-Bold': 'https://fonts.gstatic.com/s/lato/v25/S6u9w4BMUTPHh6UVew-FHi_o.ttf',
  'Lato-Italic': 'https://fonts.gstatic.com/s/lato/v25/S6u8w4BMUTPHjxswWyWtFCc.ttf',
  'Lato-BoldItalic': 'https://fonts.gstatic.com/s/lato/v25/S6u_w4BMUTPHjxsI5wqPHA3q5d0.ttf',
  'Montserrat-Regular': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-Y31cow.ttf',
  'Montserrat-Bold': 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-Y31cow.ttf',
  'Montserrat-Italic': 'https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R9aX9-obK4.ttf',
  'Montserrat-BoldItalic': 'https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq0N6aX9-obK4.ttf',
  'SourceSansPro-Regular': 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky461EN_iw6nw.ttf',
  'SourceSansPro-Bold': 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Kxf7FEN_iw6nw.ttf',
  'SourceSansPro-Italic': 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlO9C4YnYfA.ttf',
  'SourceSansPro-BoldItalic': 'https://fonts.gstatic.com/s/sourcesans3/v19/nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqF5J9C4YnYfA.ttf',
  'PinyonScript-Regular': 'https://fonts.gstatic.com/s/pinyonscript/v24/6xKpdSJbL9-e9LuoeQiDRQR8aOLQPYbg.ttf',
  'DancingScript-Regular': 'https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTeB7ptE.ttf',
  'DancingScript-Bold': 'https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7B1i0HTeB7ptE.ttf',
  'GreatVibes-Regular': 'https://fonts.gstatic.com/s/greatvibes/v21/RWmMoKWR9v4ksMfaWd_JN-XCg6MKDA.ttf',
};

/**
 * Build a Font object for offline browser use with local static file loading.
 * Each non-Roboto font is loaded from a local URL path.
 *
 * @param baseUrl - Base URL path for fonts (e.g., '/fonts')
 * @param robotoData - Binary data for the Roboto fallback font
 * @returns Font object ready for use in Designer/Form/Viewer
 */
export const buildBrowserFontConfig = (baseUrl: string, robotoData: Uint8Array): Font => {
  const result: Font = {
    Roboto: { data: robotoData, fallback: true },
  } as Font;

  for (const [name, entry] of Object.entries(FONT_REGISTRY)) {
    if (name === 'Roboto') continue;
    result[name] = {
      data: `${baseUrl}/${name}.ttf`,
      fallback: entry.fallback,
      subset: entry.subset ?? true,
    };
  }

  return result;
};

/**
 * Build a Font object for online browser use with Google Fonts CDN.
 * Each non-Roboto font is loaded from the Google Fonts CDN.
 *
 * @param robotoData - Binary data for the Roboto fallback font
 * @returns Font object ready for use in Designer/Form/Viewer
 */
export const buildGoogleFontConfig = (robotoData: Uint8Array): Font => {
  const result: Font = {
    Roboto: { data: robotoData, fallback: true },
  } as Font;

  for (const [name, entry] of Object.entries(FONT_REGISTRY)) {
    if (name === 'Roboto') continue;
    const url = GOOGLE_FONTS_URLS[name];
    result[name] = {
      data: url || `https://fonts.gstatic.com/s/${name.toLowerCase()}.ttf`,
      fallback: entry.fallback,
      subset: entry.subset ?? true,
    };
  }

  return result;
};

/**
 * Build a hybrid Font object that combines both offline and online fonts.
 * Offline fonts (local files) are preferred, with online fallback (Google Fonts).
 *
 * @param baseUrl - Base URL path for offline fonts (e.g., '/fonts')
 * @param robotoData - Binary data for the Roboto fallback font
 * @param preferOnline - If true, prefer Google Fonts URLs over local files
 * @returns Font object ready for use in Designer/Form/Viewer
 */
export const buildHybridFontConfig = (
  baseUrl: string,
  robotoData: Uint8Array,
  preferOnline = false
): Font => {
  const result: Font = {
    Roboto: { data: robotoData, fallback: true },
  } as Font;

  for (const [name, entry] of Object.entries(FONT_REGISTRY)) {
    if (name === 'Roboto') continue;

    let fontData: string;
    if (preferOnline) {
      // Prefer Google Fonts, fallback to local
      fontData = GOOGLE_FONTS_URLS[name] || `${baseUrl}/${name}.ttf`;
    } else {
      // Prefer local files, fallback to Google Fonts
      fontData = `${baseUrl}/${name}.ttf`;
    }

    result[name] = {
      data: fontData,
      fallback: entry.fallback,
      subset: entry.subset ?? true,
    };
  }

  return result;
};
