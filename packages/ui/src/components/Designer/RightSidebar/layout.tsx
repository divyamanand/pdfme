import React from 'react';
import { Divider } from 'antd';

export const SIDEBAR_H_PADDING_PX = 16;
export const SIDEBAR_V_PADDING_PX = 12;
export const SIDEBAR_HEADER_HEIGHT = 56;

type SectionProps = {
  children: React.ReactNode;
};
type SidebarFrameProps = SectionProps & {
  className?: string;
};

export const SidebarFrame = ({ children, className }: SidebarFrameProps) => (
  <div
    className={className}
    style={{
      height: '100%',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      backgroundColor: '#ffffff',
    }}
  >
    {children}
  </div>
);

export const SidebarHeader = ({ children }: SectionProps) => (
  <div
    style={{
      position: 'relative',
      minHeight: SIDEBAR_HEADER_HEIGHT,
      display: 'flex',
      flexShrink: 0,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: `${SIDEBAR_V_PADDING_PX}px ${SIDEBAR_H_PADDING_PX}px 0`,
      backgroundColor: '#ffffff',
    }}
  >
    <div style={{ minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
    <Divider style={{ marginTop: `${SIDEBAR_V_PADDING_PX}px`, marginBottom: 0, marginLeft: `-${SIDEBAR_H_PADDING_PX}px`, marginRight: `-${SIDEBAR_H_PADDING_PX}px`, backgroundColor: '#E0E0E0' }} />
  </div>
);

export const SidebarBody = ({ children }: SectionProps) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: `${SIDEBAR_V_PADDING_PX}px ${SIDEBAR_H_PADDING_PX}px`,
      backgroundColor: '#ffffff',
    }}
  >
    {children}
  </div>
);

export const SidebarFooter = ({ children }: SectionProps) => (
  <div
    style={{
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: `${SIDEBAR_V_PADDING_PX}px`,
      padding: `${SIDEBAR_H_PADDING_PX}px`,
      backgroundColor: '#ffffff',
      borderTop: '1px solid #E0E0E0',
    }}
  >
    {children}
  </div>
);
