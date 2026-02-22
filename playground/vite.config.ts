import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // lucide's ESM entry is broken in some versions — point to CJS instead
      lucide: resolve(__dirname, 'node_modules/lucide/dist/cjs/lucide.js'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true // Enable source maps for production builds
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});