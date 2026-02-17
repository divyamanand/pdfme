import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      lucide: resolve(__dirname, 'node_modules/lucide/dist/cjs/lucide.js'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true // Enable source maps for production builds
  },
  plugins: [react()],
});