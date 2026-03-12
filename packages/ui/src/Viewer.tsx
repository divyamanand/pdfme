import React from 'react';
import ReactDOM from 'react-dom/client';
import { PreviewProps } from '@pdfme/common';
import { PreviewUI } from './class.js';
import { DESTROYED_ERR_MSG } from './constants.js';
import Preview from './components/Preview.js';
import AppContextProvider from './components/AppContextProvider.js';

class Viewer extends PreviewUI {
  private root?: ReactDOM.Root;
  private onPageChangeCallback?: (pageInfo: { currentPage: number; totalPages: number }) => void;
  private pageCursor: number = 0;

  constructor(props: PreviewProps) {
    super(props);
    console.warn(
      '[@pdfme/ui] Viewer component is deprecated and will be removed in a future version.',
    );
  }

  public onPageChange(cb: (pageInfo: { currentPage: number; totalPages: number }) => void) {
    this.onPageChangeCallback = cb;
  }

  public getPageCursor() {
    return this.pageCursor;
  }

  public getTotalPages() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    return this.template.schemas.length;
  }

  public destroy() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    if (this.root) {
      this.root.unmount();
    }
    this.resizeObserver.unobserve(this.domContainer);
    this.domContainer = null;
  }

  protected render() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    if (!this.root) {
      this.root = ReactDOM.createRoot(this.domContainer);
    }
    this.root.render(
      <AppContextProvider
        lang={this.getLang()}
        font={this.getFont()}
        plugins={this.getPluginsRegistry()}
        options={this.getOptions()}
      >
        <Preview
          template={this.template}
          size={this.size}
          inputs={this.inputs}
          onPageChange={(pageInfo) => {
            this.pageCursor = pageInfo.currentPage;
            if (this.onPageChangeCallback) {
              this.onPageChangeCallback(pageInfo);
            }
          }}
        />
      </AppContextProvider>,
    );
  }
}

export default Viewer;
