import React, { useContext } from 'react';
import { Size } from '@pdfme/common';
// Import icons from lucide-react
// Note: In tests, these will be mocked by the mock file in __mocks__/lucide-react.js
import { Plus, Minus, Ellipsis, TableProperties } from 'lucide-react';

import type { MenuProps } from 'antd';
import { theme, Typography, Button, Dropdown } from 'antd';
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
  const options = Array.from({ length: pageNum }, (_, i) => i);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <select
        className={UI_CLASSNAME + 'page-select'}
        value={pageCursor}
        onChange={(e) => setPageCursor(Number(e.target.value))}
        style={{
          background: 'transparent',
          color: style.textStyle.color,
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: style.textStyle.fontSize,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {options.map((i) => (
          <option key={i} value={i} style={{ color: '#000' }}>
            Page {i + 1}
          </option>
        ))}
      </select>
      <Text strong style={style.textStyle}>
        / {pageNum}
      </Text>
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
  clonePageAfter?: () => void;
  removePage?: () => void;
  onCFClick?: () => void;
  hasTables?: boolean;
};

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
    clonePageAfter,
    removePage,
    onCFClick,
    hasTables,
  } = props;

  const contextMenuItems: MenuProps['items'] = [];
  if (addPageAfter) {
    contextMenuItems.push({
      key: '1',
      label: <div onClick={addPageAfter}>{i18n('addPageAfter')}</div>,
    });
  }
  if (clonePageAfter) {
    contextMenuItems.push({
      key: '3',
      label: <div onClick={clonePageAfter}>{i18n('clonePage')}</div>,
    });
  }
  if (removePage && pageNum > 1 && pageCursor !== 0) {
    contextMenuItems.push({
      key: '2',
      label: <div onClick={removePage}>{i18n('removePage')}</div>,
    });
  }

  const barWidth = 300;
  const contextMenuWidth = contextMenuItems.length > 0 ? 50 : 0;
  const cfButtonWidth = hasTables && onCFClick ? 40 : 0;
  const width = (pageNum > 1 ? barWidth : barWidth / 2) + contextMenuWidth + cfButtonWidth;

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
        {hasTables && onCFClick && (
          <Button
            className={UI_CLASSNAME + 'cf-conditions'}
            type="text"
            title="Cell Conditions"
            onClick={onCFClick}
            icon={<TableProperties size={16} color={textStyle.color} />}
          />
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
