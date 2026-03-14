import React from 'react';
import type { SidebarProps } from '../../../types.js';
import { RIGHT_SIDEBAR_WIDTH, DESIGNER_CLASSNAME } from '../../../constants.js';
import DetailView from './DetailView/index.js';

const Sidebar = (props: SidebarProps) => {
  const { activeElements, schemas } = props;

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
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #E0E0E0',
        display: 'flex',
        flexDirection: 'column',
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
            color: '#999999',
            fontSize: '14px',
            padding: '24px',
            textAlign: 'center',
            fontFamily: "'Open Sans', sans-serif",
          }}
        >
          Select a field to edit its properties
        </div>
      )}
    </div>
  );
};

export default Sidebar;
