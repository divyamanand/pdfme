import React, { useContext, forwardRef, ReactNode, Ref, useEffect, useRef } from 'react';
import { Size } from '@pdfme/common';
import { FontContext } from '../contexts.js';
import { BACKGROUND_COLOR, DESIGNER_CLASSNAME } from '../constants.js';
import Spinner from './Spinner.js';

type Props = { size: Size; scale: number; children: ReactNode };

const Root = ({ size, scale, children }: Props, ref: Ref<HTMLDivElement>) => {
  const font = useContext(FontContext);
  const loadedFontNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!document || !document.fonts) return;
    const fontEntries = Object.entries(font).filter(([key]) => !loadedFontNamesRef.current.has(key));
    const fontFaces = fontEntries.map(
      ([key, { data }]) =>
        new FontFace(key, typeof data === 'string' ? `url(${data})` : (data as BufferSource), {
          display: 'swap',
        }),
    );

    void Promise.allSettled(fontFaces.map((f) => f.load())).then((loadedFontFaces) => {
      loadedFontFaces.forEach((loadedFontFace, i) => {
        if (loadedFontFace.status === 'fulfilled') {
          document.fonts.add(fontFaces[i]);
          loadedFontNamesRef.current.add(fontFaces[i].family);
        }
      });
    });
  }, [font]);

  return (
    <div className={DESIGNER_CLASSNAME + 'root'} ref={ref} style={{ position: 'relative', background: BACKGROUND_COLOR, ...size }}>
      <div className={DESIGNER_CLASSNAME + 'background'} style={{ margin: '0 auto', ...size }}>{scale === 0 ? <Spinner /> : children}</div>
    </div>
  );
};

export default forwardRef<HTMLDivElement, Props>(Root);
