import React from 'react';
import { theme } from 'antd';
import type { SidebarProps } from '../../../types.js';
import { RIGHT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../../constants.js';
import DetailView from './DetailView/index.js';

const Sidebar = (props: SidebarProps) => {
  const { activeElements, schemas } = props;

  const { token } = theme.useToken();
  const getActiveSchemas = () =>
    schemas.filter((s) => activeElements.map((ae) => ae.id).includes(s.id));
  const getLastActiveSchema = () => {
    const activeSchemas = getActiveSchemas();
    return activeSchemas[activeSchemas.length - 1];
  };

  const hasActiveSchemas = getActiveSchemas().length > 0;

  return (
    <div
      className={DESIGNER_CLASSNAME + 'right-sidebar'}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1,
        height: '100%',
        width: RIGHT_SIDEBAR_WIDTH,
      }}
    >
      <div
        style={{
          width: RIGHT_SIDEBAR_WIDTH,
          height: '100%',
          display: 'flex',
          top: 0,
          right: 0,
          position: 'absolute',
          fontFamily: "'Open Sans', sans-serif",
          boxSizing: 'border-box',
          background: token.colorBgContainer,
          borderLeft: `1px solid ${token.colorSplit}`,
        }}
      >
        {hasActiveSchemas ? (
          <DetailView {...props} activeSchema={getLastActiveSchema()} />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              color: token.colorTextQuaternary,
              fontSize: token.fontSize,
              padding: 24,
              textAlign: 'center',
            }}
          >
            Select a field to edit its properties
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
