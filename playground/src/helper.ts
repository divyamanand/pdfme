import {
  Template,
  Font,
  checkTemplate,
  getInputFromTemplate,
  getDefaultFont,
  buildBrowserFontConfig,
  buildGoogleFontConfig,
  buildHybridFontConfig,
} from '@pdfme/common';
import { Form, Viewer, Designer } from '@pdfme/ui';
import { generate } from '@pdfme/generator';
import { toast } from 'react-toastify';
import { getPlugins } from './plugins';

/**
 * Font loading mode configuration:
 * - 'offline': Load fonts from local static files (/fonts/*.ttf)
 * - 'online': Load fonts from Google Fonts CDN (requires internet)
 * - 'hybrid': Try local first, fallback to Google Fonts
 * - 'hybrid-online': Prefer Google Fonts, fallback to local
 */
type FontLoadMode = 'offline' | 'online' | 'hybrid' | 'hybrid-online';

const FONT_LOAD_MODE: FontLoadMode = (
  import.meta.env.VITE_FONT_MODE || 'offline'
) as FontLoadMode;

export function fromKebabCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get fonts configuration based on the selected mode.
 * Supports both online (Google Fonts) and offline (local files) loading.
 *
 * @param mode - Font loading mode ('offline', 'online', 'hybrid', 'hybrid-online')
 * @returns Font configuration object
 */
export const getFontsData = (mode: FontLoadMode = FONT_LOAD_MODE): Font => {
  const defaultFont = getDefaultFont();
  const robotoData = defaultFont['Roboto'].data as Uint8Array;

  switch (mode) {
    case 'online':
      // Load all fonts from Google Fonts CDN
      console.log('📡 Loading fonts from Google Fonts CDN (online mode)');
      return buildGoogleFontConfig(robotoData);

    case 'hybrid':
      // Prefer local files, fallback to Google Fonts
      console.log('🔄 Loading fonts in hybrid mode (local-first)');
      return buildHybridFontConfig('/fonts', robotoData, false);

    case 'hybrid-online':
      // Prefer Google Fonts, fallback to local files
      console.log('🔄 Loading fonts in hybrid mode (online-first)');
      return buildHybridFontConfig('/fonts', robotoData, true);

    case 'offline':
    default:
      // Load fonts from local static files only
      console.log('💾 Loading fonts from local files (offline mode)');
      return buildBrowserFontConfig('/fonts', robotoData);
  }
};

export const readFile = (file: File | null, type: 'text' | 'dataURL' | 'arrayBuffer') => {
  return new Promise<string | ArrayBuffer>((r) => {
    const fileReader = new FileReader();
    fileReader.addEventListener('load', (e) => {
      if (e && e.target && e.target.result && file !== null) {
        r(e.target.result);
      }
    });
    if (file !== null) {
      if (type === 'text') {
        fileReader.readAsText(file);
      } else if (type === 'dataURL') {
        fileReader.readAsDataURL(file);
      } else if (type === 'arrayBuffer') {
        fileReader.readAsArrayBuffer(file);
      }
    }
  });
};

const getTemplateFromJsonFile = (file: File) => {
  return readFile(file, 'text').then((jsonStr) => {
    const template: Template = JSON.parse(jsonStr as string);
    checkTemplate(template);
    return template;
  });
};

export const downloadJsonFile = (json: unknown, title: string) => {
  if (typeof window !== 'undefined') {
    const blob = new Blob([JSON.stringify(json)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
};

export const handleLoadTemplate = (
  e: React.ChangeEvent<HTMLInputElement>,
  currentRef: Designer | Form | Viewer | null
) => {
  if (e.target && e.target.files && e.target.files[0]) {
    getTemplateFromJsonFile(e.target.files[0])
      .then((t) => {
        if (!currentRef) return;
        currentRef.updateTemplate(t);
      })
      .catch((e) => {
        toast.error(`Invalid template file: ${e}`);
      });
  }
};

export const translations: { label: string; value: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'th', label: 'Thai' },
  { value: 'pl', label: 'Polish' },
  { value: 'it', label: 'Italian' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
];

export const generatePDF = async (currentRef: Designer | Form | Viewer | null) => {
  if (!currentRef) return;
  const template = currentRef.getTemplate();
  const options = currentRef.getOptions();
  const inputs =
    typeof (currentRef as Viewer | Form).getInputs === 'function'
      ? (currentRef as Viewer | Form).getInputs()
      : getInputFromTemplate(template);
  const font = getFontsData();

  try {
    const pdf = await generate({
      template,
      inputs,
      options: {
        font,
        lang: options.lang,
        title: 'pdfme',
      },
      plugins: getPlugins(),
    });

    const blob = new Blob([pdf.buffer], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob));
  } catch (e) {
    toast.error(`${e}\n\nCheck the console for full stack trace`);
    throw e;
  }
};

export const isJsonString = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export const getBlankTemplate = () =>
  ({
    schemas: [{}],
    basePdf: {
      width: 210,
      height: 297,
      padding: [20, 10, 20, 10],
    },
  } as Template);

export const getTemplateById = async (templateId: string): Promise<Template> => {
  const template = await fetch(`/template-assets/${templateId}/template.json`).then((res) =>
    res.json()
  );
  checkTemplate(template);
  return template as Template;
};
