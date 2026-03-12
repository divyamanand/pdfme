import React from 'react';
import { theme, Button } from 'antd';
import type { SidebarProps } from '../../../types.js';
import { RIGHT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../../constants.js';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import DetailView from './DetailView/index.js';

const Sidebar = (props: SidebarProps) => {
  const { sidebarOpen, setSidebarOpen, activeElements, schemas } = props;

  const { token } = theme.useToken();
  const getActiveSchemas = () =>
    schemas.filter((s) => activeElements.map((ae) => ae.id).includes(s.id));
  const getLastActiveSchema = () => {
    const activeSchemas = getActiveSchemas();
    return activeSchemas[activeSchemas.length - 1];
  };

  const iconProps = { strokeWidth: 1.5, size: 20 };
  const hasActiveSchemas = getActiveSchemas().length > 0;

  return (
    <div
      className={DESIGNER_CLASSNAME + 'right-sidebar'}
      style={{
        position: 'absolute',
        right: 0,
        zIndex: 1,
        height: '100%',
        width: sidebarOpen && hasActiveSchemas ? RIGHT_SIDEBAR_WIDTH : 0,
      }}
    >
      {hasActiveSchemas && (
        <Button
          className={DESIGNER_CLASSNAME + 'sidebar-toggle'}
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            top: '14px',
            right: '16px',
            paddingTop: '2px',
            zIndex: 100,
          }}
          icon={sidebarOpen ? <ArrowRight {...iconProps} /> : <ArrowLeft {...iconProps} />}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        />
      )}
      <div
        style={{
          width: RIGHT_SIDEBAR_WIDTH,
          height: '100%',
          display: sidebarOpen && hasActiveSchemas ? 'flex' : 'none',
          top: 0,
          right: 0,
          position: 'absolute',
          fontFamily: "'Open Sans', sans-serif",
          boxSizing: 'border-box',
          background: token.colorBgLayout,
          borderLeft: `1px solid ${token.colorSplit}`,
        }}
      >
        {hasActiveSchemas && (
          <DetailView {...props} activeSchema={getLastActiveSchema()} />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
