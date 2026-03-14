import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig(({ mode }) => {
  return {
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    plugins: [react(), tsconfigPaths({ root: '.' }), cssInjectedByJsPlugin()],
    build: {
      lib: {
        entry: 'src/index.ts',
        name: '@pdfme/react',
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external: ['react', 'react-dom', '@pdfme/common', '@pdfme/schemas'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            '@pdfme/common': 'pdfmeCommon',
            '@pdfme/schemas': 'pdfmeSchemas',
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'antd'],
      exclude: ['@pdfme/common', '@pdfme/schemas', '@pdfme/converter'],
    },
  };
});
