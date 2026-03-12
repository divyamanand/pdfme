import React, { useContext, useState } from 'react';
import { Size, isBlankPdf, BasePdf } from '@pdfme/common';
// Import icons from lucide-react
// Note: In tests, these will be mocked by the mock file in __mocks__/lucide-react.js
import { Plus, Minus, ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';

import type { MenuProps } from 'antd';
import { theme, Typography, Button, Dropdown, InputNumber, Select } from 'antd';
import { I18nContext } from '../contexts.js';
import { useMaxZoom } from '../helper.js';
import { UI_CLASSNAME } from '../constants.js';

const { Text } = Typography;

type TextStyle = { color: string; fontSize: number; margin: number };
type ZoomProps = {
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  style: { textStyle: TextStyle };
};

const Zoom = ({ zoomLevel, setZoomLevel, style }: ZoomProps) => {
  const zoomStep = 0.25;
  const maxZoom = useMaxZoom();
  const minZoom = 0.25;

  const nextZoomOut = zoomLevel - zoomStep;
  const nextZoomIn = zoomLevel + zoomStep;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Button
        className={UI_CLASSNAME + 'zoom-out'}
        type="text"
        disabled={minZoom >= nextZoomOut}
        onClick={() => setZoomLevel(nextZoomOut)}
        icon={<Minus size={16} color={style.textStyle.color} />}
      />
      <Text strong style={style.textStyle}>
        {Math.round(zoomLevel * 100)}%
      </Text>
      <Button
        className={UI_CLASSNAME + 'zoom-in'}
        type="text"
        disabled={maxZoom < nextZoomIn}
        onClick={() => setZoomLevel(nextZoomIn)}
        icon={<Plus size={16} color={style.textStyle.color} />}
      />
    </div>
  );
};

type PagerProps = {
  pageCursor: number;
  pageNum: number;
  setPageCursor: (page: number) => void;
  style: { textStyle: TextStyle };
};

const Pager = ({ pageCursor, pageNum, setPageCursor, style }: PagerProps) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Button className={UI_CLASSNAME + 'page-prev'} type="text" disabled={pageCursor <= 0} onClick={() => setPageCursor(pageCursor - 1)}>
        <ChevronLeft size={16} color={style.textStyle.color} />
      </Button>
      <Text strong style={style.textStyle}>
        {pageCursor + 1}/{pageNum}
      </Text>
      <Button
        className={UI_CLASSNAME + 'page-next'}
        type="text"
        disabled={pageCursor + 1 >= pageNum}
        onClick={() => setPageCursor(pageCursor + 1)}
      >
        <ChevronRight size={16} color={style.textStyle.color} />
      </Button>
    </div>
  );
};

type ContextMenuProps = {
  items: MenuProps['items'];
  style: { textStyle: TextStyle };
};
const ContextMenu = ({ items, style }: ContextMenuProps) => (
  <Dropdown menu={{ items }} placement="top" arrow trigger={['click']}>
    <Button className={UI_CLASSNAME + 'context-menu'} type="text">
      <Ellipsis size={16} color={style.textStyle.color} />
    </Button>
  </Dropdown>
);

type CtlBarProps = {
  size: Size;
  pageCursor: number;
  pageNum: number;
  setPageCursor: (page: number) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  addPageAfter?: () => void;
  removePage?: () => void;
  clonePageAfter?: () => void;
  basePdf?: BasePdf;
  onChangePageSize?: (w: number, h: number) => void;
  onChangePadding?: (padding: [number, number, number, number]) => void;
};

const PAGE_PRESETS = [
  { label: 'A4 Portrait', w: 210, h: 297 },
  { label: 'A4 Landscape', w: 297, h: 210 },
  { label: 'A3 Portrait', w: 297, h: 420 },
  { label: 'A3 Landscape', w: 420, h: 297 },
  { label: 'Letter Portrait', w: 215.9, h: 279.4 },
  { label: 'Letter Landscape', w: 279.4, h: 215.9 },
];

const CtlBar = (props: CtlBarProps) => {
  const { token } = theme.useToken();
  const i18n = useContext(I18nContext);

  const {
    size,
    pageCursor,
    pageNum,
    setPageCursor,
    zoomLevel,
    setZoomLevel,
    addPageAfter,
    removePage,
    clonePageAfter,
    basePdf,
    onChangePageSize,
    onChangePadding,
  } = props;

  const isBlank = basePdf ? isBlankPdf(basePdf) : false;
  const curW = isBlank ? (basePdf as any).width : 0;
  const curH = isBlank ? (basePdf as any).height : 0;
  const curPad: [number, number, number, number] = isBlank
    ? (basePdf as any).padding ?? [0, 0, 0, 0]
    : [0, 0, 0, 0];

  const contextMenuItems: MenuProps['items'] = [];

  // Page size submenu (only for blank PDFs)
  if (isBlank && onChangePageSize) {
    const presetMatch = PAGE_PRESETS.find((p) => p.w === curW && p.h === curH);
    contextMenuItems.push({
      key: 'pageSize',
      label: (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ minWidth: 260, padding: '4px 0' }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>
            {i18n('pageSize')}
          </div>
          <Select
            size="small"
            style={{ width: '100%', marginBottom: 4 }}
            value={presetMatch?.label ?? 'custom'}
            onChange={(value) => {
              const p = PAGE_PRESETS.find((pr) => pr.label === value);
              if (p) onChangePageSize(p.w, p.h);
            }}
            options={[
              ...PAGE_PRESETS.map((p) => ({ label: p.label, value: p.label })),
              { label: 'Custom', value: 'custom' },
            ]}
          />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#888' }}>W</span>
            <InputNumber
              size="small"
              style={{ width: 70 }}
              value={curW}
              min={10}
              onChange={(v) => v && onChangePageSize(v, curH)}
            />
            <span style={{ fontSize: 11, color: '#888' }}>H</span>
            <InputNumber
              size="small"
              style={{ width: 70 }}
              value={curH}
              min={10}
              onChange={(v) => v && onChangePageSize(curW, v)}
            />
          </div>
          {onChangePadding && (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {['T', 'R', 'B', 'L'].map((lbl, idx) => (
                <React.Fragment key={lbl}>
                  <span style={{ fontSize: 10, color: '#888' }}>{lbl}</span>
                  <InputNumber
                    size="small"
                    style={{ width: 48 }}
                    value={curPad[idx]}
                    min={0}
                    onChange={(v) => {
                      const newPad = [...curPad] as [number, number, number, number];
                      newPad[idx] = v ?? 0;
                      onChangePadding(newPad);
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      ),
    });
    contextMenuItems.push({ type: 'divider', key: 'div-pagesize' });
  }

  if (addPageAfter) {
    contextMenuItems.push({
      key: 'addPageAfter',
      label: <div onClick={addPageAfter}>{i18n('addPageAfter')}</div>,
    });
  }
  if (clonePageAfter) {
    contextMenuItems.push({
      key: 'clonePage',
      label: <div onClick={clonePageAfter}>{i18n('clonePage')}</div>,
    });
  }
  if (removePage && pageNum > 1 && pageCursor !== 0) {
    contextMenuItems.push({
      key: 'removePage',
      label: <div onClick={removePage}>{i18n('removePage')}</div>,
    });
  }

  const barWidth = 300;
  const contextMenuWidth = contextMenuItems.length > 0 ? 50 : 0;
  const width = (pageNum > 1 ? barWidth : barWidth / 2) + contextMenuWidth;

  const textStyle = {
    color: token.colorWhite,
    fontSize: token.fontSize,
    margin: token.marginXS,
  };

  return (
    <div style={{ position: 'absolute', top: 'auto', bottom: '6%', width: size.width }}>
      <div
        className={UI_CLASSNAME + 'control-bar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          position: 'relative',
          zIndex: 1,
          left: `calc(50% - ${width / 2}px)`,
          width,
          height: 40,
          boxSizing: 'border-box',
          padding: token.paddingSM,
          borderRadius: token.borderRadius,
          backgroundColor: token.colorBgMask,
        }}
      >
        {pageNum > 1 && (
          <div className={UI_CLASSNAME + 'pager'}>
            <Pager
              style={{ textStyle }}
              pageCursor={pageCursor}
              pageNum={pageNum}
              setPageCursor={setPageCursor}
            />
          </div>
        )}
        <div className={UI_CLASSNAME + 'zoom'}>
          <Zoom style={{ textStyle }} zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />
        </div>
        {contextMenuItems.length > 0 && (
          <ContextMenu items={contextMenuItems} style={{ textStyle }} />
        )}
      </div>
    </div>
  );
};

export default CtlBar;
