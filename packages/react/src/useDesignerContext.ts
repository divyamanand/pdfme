import { useContext } from 'react';
import { DesignerContext } from './PdfmeProvider.js';

export const useDesignerContext = () => {
  const context = useContext(DesignerContext);
  if (!context) {
    throw new Error('useDesignerContext must be used within a <PdfmeProvider>');
  }
  return context;
};
