import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const commonFontsDir = path.resolve(__dirname, '../packages/common/assets/fonts');

const serveCommonFonts = () => ({
  name: 'serve-common-fonts',
  configureServer(server) {
    server.middlewares.use('/fonts', (req, res, next) => {
      const filePath = path.join(commonFontsDir, decodeURIComponent(req.url || ''));
      try {
        if (fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/octet-stream');
          res.end(fs.readFileSync(filePath));
          return;
        }
      } catch {}
      next();
    });
  },
  writeBundle(options) {
    const destFontsDir = path.resolve(options.dir || 'dist', 'fonts');
    fs.cpSync(commonFontsDir, destFontsDir, { recursive: true });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'esnext',
    sourcemap: true // Enable source maps for production builds
  },
  plugins: [react(), serveCommonFonts(), sentryVitePlugin({
    org: "hand-dot",
    project: "playground-pdfme"
  })],
});