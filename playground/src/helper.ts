import { Template, Font, checkTemplate, getInputFromTemplate, getDefaultFont } from '@pdfme/common';
import { Designer } from '@pdfme/ui';
import { generate } from '@pdfme/generator';
import { getPlugins } from './plugins';

export function fromKebabCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const getFontsData = (): Font => ({
  ...getDefaultFont(),
  'PinyonScript-Regular': {
    fallback: false,
    data: 'https://fonts.gstatic.com/s/pinyonscript/v22/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf',
  },
  NotoSerifJP: {
    fallback: false,
    data: 'https://fonts.gstatic.com/s/notoserifjp/v30/xn71YHs72GKoTvER4Gn3b5eMRtWGkp6o7MjQ2bwxOubAILO5wBCU.ttf',
  },
  NotoSansJP: {
    fallback: false,
    data: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.ttf',
  }
});

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



export const generatePDF = async (currentRef: Designer | null) => {
  if (!currentRef) return;
  const template = currentRef.getTemplate();
  const options = currentRef.getOptions();
  const inputs = getInputFromTemplate(template);
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
    alert(e + '\n\nCheck the console for full stack trace');
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
