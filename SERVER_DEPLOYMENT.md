# PDFme Server Deployment Guide

## Overview

This guide covers deploying PDF generation on a server while keeping schema design in the browser. This architecture separates concerns:

- **Browser**: Interactive template design, schema editing, form filling
- **Server**: PDF generation, font management, bulk operations

```
┌─────────────────────┐         ┌──────────────────────┐
│   Browser/Playground│         │  PDF Generation      │
│                     │         │  Server (Node.js)    │
│  • Designer (UI)    │         │                      │
│  • Schema editing   │ POST    │  • @pdfme/generator  │
│  • Template testing │ /pdf    │  • @pdfme/common     │
│  • Form filling     │────────→│  • @pdfme/schemas    │
│                     │         │  • Custom fonts      │
└─────────────────────┘         │  • Font files (TTF)  │
                                └──────────────────────┘
                                         ↓
                                   Save/Stream PDF
```

---

## Table of Contents

1. [Implementation Steps](#implementation-steps)
2. [Server Setup](#server-setup)
3. [Browser Integration](#browser-integration)
4. [Configuration](#configuration)
5. [Docker Deployment](#docker-deployment)
6. [Production Deployment](#production-deployment)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)

---

## Implementation Steps

### Prerequisites

```bash
# Install server dependencies
npm install express cors @pdfme/generator @pdfme/common @pdfme/schemas
npm install --save-dev typescript @types/express @types/node
```

### Project Structure

```
pdfme/
├── server/
│   ├── src/
│   │   ├── index.ts              # Main server
│   │   ├── pdf-generator.ts      # PDF endpoint
│   │   ├── plugins.ts            # Plugin setup
│   │   └── fonts.ts              # Font configuration
│   ├── fonts/
│   │   ├── Roboto-Regular.ttf
│   │   ├── Roboto-Bold.ttf
│   │   ├── NotoSansJP.ttf
│   │   └── ...
│   ├── dist/                     # Compiled output
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── playground/
│   └── src/
│       └── helper.ts             # Client integration
└── ...
```

---

## Server Setup

### 1. Create Node.js Server Endpoint

**File: `server/src/pdf-generator.ts`**

```typescript
import express, { Router, Request, Response } from 'express';
import { generate } from '@pdfme/generator';
import { checkTemplate } from '@pdfme/common';
import { getPlugins } from './plugins';
import { getFontsData } from './fonts';
import type { Template } from '@pdfme/common';

const router = Router();

interface GeneratePdfRequest {
  template: Template;
  inputs: Array<Record<string, string>>;
  options?: {
    title?: string;
    creator?: string;
    subject?: string;
  };
}

/**
 * POST /api/pdf
 * Generate PDF from template and input data
 *
 * Request body:
 * {
 *   "template": { schemas: [...], basePdf: {...} },
 *   "inputs": [{ fieldName: "value", ... }],
 *   "options": { title: "My PDF", ... }
 * }
 *
 * Response: Binary PDF file
 */
router.post('/pdf', async (req: Request, res: Response) => {
  try {
    const { template, inputs, options } = req.body as GeneratePdfRequest;

    // Validate inputs
    if (!template || !inputs || inputs.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: template and inputs'
      });
    }

    // Validate template structure
    try {
      checkTemplate(template);
    } catch (error) {
      return res.status(400).json({
        error: `Invalid template: ${error instanceof Error ? error.message : 'unknown error'}`
      });
    }

    // Generate PDF with server-side fonts and plugins
    const pdf = await generate({
      template,
      inputs,
      options: {
        font: getFontsData(),
        title: options?.title || 'pdfme-document',
        creator: options?.creator || 'PDFme',
        subject: options?.subject,
      },
      plugins: getPlugins(),
    });

    // Send as binary response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('Content-Length', pdf.byteLength);

    res.send(Buffer.from(pdf));

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'PDF generation failed',
      stack: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
});

/**
 * POST /api/pdf-base64
 * Generate PDF and return as base64 (for download/storage)
 */
router.post('/pdf-base64', async (req: Request, res: Response) => {
  try {
    const { template, inputs, options } = req.body as GeneratePdfRequest;

    if (!template || !inputs || inputs.length === 0) {
      return res.status(400).json({ error: 'Missing template or inputs' });
    }

    checkTemplate(template);

    const pdf = await generate({
      template,
      inputs,
      options: {
        font: getFontsData(),
        title: options?.title || 'pdfme-document',
      },
      plugins: getPlugins(),
    });

    res.json({
      success: true,
      pdf: Buffer.from(pdf).toString('base64'),
      mimeType: 'application/pdf',
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'PDF generation failed'
    });
  }
});

/**
 * POST /api/pdf-batch
 * Generate multiple PDFs (one per input) and return as zip
 */
router.post('/pdf-batch', async (req: Request, res: Response) => {
  try {
    const { template, inputs, options } = req.body as GeneratePdfRequest;

    if (!template || !inputs || inputs.length === 0) {
      return res.status(400).json({ error: 'Missing template or inputs' });
    }

    checkTemplate(template);

    // Generate all PDFs
    const pdfs = await Promise.all(
      inputs.map((input) =>
        generate({
          template,
          inputs: [input],
          options: {
            font: getFontsData(),
            title: options?.title || 'pdfme-document',
          },
          plugins: getPlugins(),
        })
      )
    );

    // Return array of base64 PDFs
    res.json({
      success: true,
      count: pdfs.length,
      pdfs: pdfs.map((pdf) => Buffer.from(pdf).toString('base64')),
    });

  } catch (error) {
    console.error('Batch PDF generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Batch generation failed'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### 2. Server-Side Font Configuration

**File: `server/src/fonts.ts`**

```typescript
import path from 'path';
import fs from 'fs';
import { getDefaultFont } from '@pdfme/common';
import type { Font } from '@pdfme/common';

/**
 * Get fonts data for PDF generation
 * Combines default fonts with custom/local fonts
 */
export function getFontsData(): Font {
  const fontsDir = path.join(__dirname, '../fonts');

  // Ensure fonts directory exists
  if (!fs.existsSync(fontsDir)) {
    console.warn(`Fonts directory not found at ${fontsDir}`);
  }

  return {
    ...getDefaultFont(),

    // ---- Local TTF/OTF files (loaded from disk) ----

    'Roboto-Regular': {
      fallback: true,
      data: loadFontFile(fontsDir, 'Roboto-Regular.ttf'),
    },
    'Roboto-Bold': {
      fallback: false,
      data: loadFontFile(fontsDir, 'Roboto-Bold.ttf'),
    },
    'Roboto-Italic': {
      fallback: false,
      data: loadFontFile(fontsDir, 'Roboto-Italic.ttf'),
    },

    // ---- CJK (Chinese, Japanese, Korean) Fonts ----

    'NotoSansJP': {
      fallback: false,
      data: loadFontFile(fontsDir, 'NotoSansJP.ttf'),
    },
    'NotoSansCJK': {
      fallback: false,
      data: loadFontFile(fontsDir, 'NotoSansCJK.ttf'),
    },

    // ---- Remote fonts (CDN hosted, cached by server) ----

    'PinyonScript-Regular': {
      fallback: false,
      data: 'https://fonts.gstatic.com/s/pinyonscript/v22/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf',
    },
  };
}

/**
 * Load font file from disk and return as Buffer
 * Falls back to error buffer if file not found
 */
function loadFontFile(fontsDir: string, filename: string): Buffer | string {
  try {
    const filepath = path.join(fontsDir, filename);
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath);
    }
    console.warn(`Font file not found: ${filename}`);
    return Buffer.alloc(0); // Return empty buffer as fallback
  } catch (error) {
    console.error(`Error loading font ${filename}:`, error);
    return Buffer.alloc(0);
  }
}

/**
 * Download fonts from Google Fonts or other CDN
 * Run this once to populate the fonts directory
 */
export async function downloadFonts() {
  const https = require('https');
  const fonts = [
    {
      name: 'Roboto-Regular.ttf',
      url: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.ttf',
    },
    {
      name: 'Roboto-Bold.ttf',
      url: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfAw.ttf',
    },
    {
      name: 'NotoSansJP.ttf',
      url: 'https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.ttf',
    },
  ];

  const fontsDir = path.join(__dirname, '../fonts');
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  for (const font of fonts) {
    const filepath = path.join(fontsDir, font.name);
    if (fs.existsSync(filepath)) {
      console.log(`Font already exists: ${font.name}`);
      continue;
    }

    console.log(`Downloading ${font.name}...`);
    await new Promise<void>((resolve, reject) => {
      https.get(font.url, (response: any) => {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Downloaded: ${font.name}`);
          resolve();
        });
      }).on('error', (err: any) => {
        fs.unlink(filepath, () => {}); // Delete the file if error
        reject(err);
      });
    });
  }

  console.log('Font download complete');
}
```

### 3. Server-Side Plugin Setup

**File: `server/src/plugins.ts`**

```typescript
import {
  text,
  multiVariableText,
  image,
  svg,
  table,
  nestedTable,
  barcodes,
  line,
  rectangle,
  ellipse,
  dateTime,
  date,
  time,
  select,
  checkbox,
  radioGroup,
} from '@pdfme/schemas';
import type { Plugins } from '@pdfme/common';

/**
 * Get all available plugins for PDF generation
 * Ensure these match the plugins available in the browser
 */
export function getPlugins(): Plugins {
  return {
    Text: text,
    'Multi-Variable Text': multiVariableText,
    Table: table,
    'Nested Table': nestedTable,
    Line: line,
    Rectangle: rectangle,
    Ellipse: ellipse,
    Image: image,
    SVG: svg,
    QR: barcodes.qrcode,
    DateTime: dateTime,
    Date: date,
    Time: time,
    Select: select,
    Checkbox: checkbox,
    RadioGroup: radioGroup,
    Code128: barcodes.code128,
    // Uncomment additional barcode types as needed:
    // NW7: barcodes.nw7,
    // ITF14: barcodes.itf14,
    // UPCA: barcodes.upca,
    // UPCE: barcodes.upce,
    // GS1DataMatrix: barcodes.gs1datamatrix,
    // PDF417: barcodes.pdf417,
  };
}
```

### 4. Main Server File

**File: `server/src/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import pdfRouter from './pdf-generator';

const app = express();

// ---- Middleware ----

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',      // Local development
    'http://localhost:3000',      // Alternative local
    process.env.ALLOWED_ORIGIN || 'https://yourdomain.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing (increase limit for large base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ---- Routes ----

app.use('/api', pdfRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'PDFme Generator Server',
    version: '1.0.0',
    endpoints: {
      generate: 'POST /api/pdf',
      generateBase64: 'POST /api/pdf-base64',
      generateBatch: 'POST /api/pdf-batch',
      health: 'GET /api/health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ---- Server startup ----

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST as any, () => {
  console.log(`✓ PDFme Generator Server running on http://${HOST}:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});
```

### 5. TypeScript Configuration

**File: `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 6. Package Configuration

**File: `server/package.json`**

```json
{
  "name": "pdfme-generator-server",
  "version": "1.0.0",
  "description": "PDFme PDF generation server",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "download-fonts": "ts-node src/fonts.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@pdfme/generator": "workspace:*",
    "@pdfme/common": "workspace:*",
    "@pdfme/schemas": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1"
  }
}
```

---

## Browser Integration

### 1. Update Helper Functions

**File: `playground/src/helper.ts`** (add these functions)

```typescript
/**
 * Generate PDF using server (streaming to browser)
 * Server returns PDF directly for immediate viewing
 */
export const generatePDFOnServer = async (
  template: Template,
  inputs: Record<string, string>[]
): Promise<void> => {
  const serverUrl = process.env.REACT_APP_PDF_SERVER_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${serverUrl}/api/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template,
        inputs,
        options: {
          title: 'pdfme-document',
          creator: 'PDFme Playground',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'PDF generation failed');
    }

    // Open PDF in new tab
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url);
  } catch (error) {
    toast.error(
      `Server PDF generation failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
};

/**
 * Generate PDF using server and get as base64
 * Useful for download, storage, or embedding
 */
export const generatePDFOnServerAsBase64 = async (
  template: Template,
  inputs: Record<string, string>[]
): Promise<string> => {
  const serverUrl = process.env.REACT_APP_PDF_SERVER_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${serverUrl}/api/pdf-base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, inputs }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'PDF generation failed');
    }

    const data = await response.json();
    return data.pdf; // base64 string
  } catch (error) {
    toast.error(
      `Server PDF generation failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    throw error;
  }
};

/**
 * Download PDF from server directly
 */
export const downloadPDFFromServer = async (
  template: Template,
  inputs: Record<string, string>[],
  filename: string = 'document.pdf'
): Promise<void> => {
  try {
    const base64 = await generatePDFOnServerAsBase64(template, inputs);

    // Convert base64 to Blob
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('PDF downloaded successfully');
  } catch (error) {
    toast.error('Download failed');
  }
};
```

### 2. Update TemplateTester Component

**File: `playground/src/components/TemplateTester.tsx`** (modify handleGenerate)

```typescript
const handleGenerateOnServer = async () => {
  if (!designer.current) return;
  setGenerating(true);
  try {
    const template = designer.current.getTemplate();

    // Use server generation
    const serverUrl = process.env.REACT_APP_PDF_SERVER_URL || 'http://localhost:3001';
    const response = await fetch(`${serverUrl}/api/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template,
        inputs: [inputs],
        options: { title: 'template-test' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Generation failed');
    }

    const blob = await response.blob();
    window.open(URL.createObjectURL(blob));
    toast.success('PDF generated on server');
  } catch (e) {
    toast.error(`Server generation failed: ${e}`);
  } finally {
    setGenerating(false);
  }
};

// In the button:
<button
  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
  onClick={handleGenerateOnServer}
  disabled={generating}
  title="Generate PDF on server"
>
  <Cloud size={14} />
  {generating ? 'Generating on Server...' : 'Generate on Server'}
</button>
```

---

## Configuration

### Environment Variables

**File: `.env.local` (development)**

```bash
# Browser
REACT_APP_PDF_SERVER_URL=http://localhost:3001

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:5173
```

**File: `.env.production` (production)**

```bash
# Browser
REACT_APP_PDF_SERVER_URL=https://api.yourdomain.com

# Server
PORT=3001
NODE_ENV=production
ALLOWED_ORIGIN=https://yourdomain.com
```

### Build Scripts

**Update `package.json` in root:**

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "build:server": "npm run build -w server",
    "build:playground": "npm run build -w playground",
    "dev:server": "npm run dev -w server",
    "dev:playground": "npm run dev -w playground",
    "dev:all": "npm run dev --workspaces"
  }
}
```

---

## Docker Deployment

### Single Container Deployment

**File: `server/Dockerfile`**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy monorepo files
COPY package*.json ./
COPY packages/ ./packages/
COPY server/ ./server/

# Install dependencies
RUN npm install --production

# Build server
RUN npm run build:server

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server/dist/index.js"]
```

**Build and run:**

```bash
# Build image
docker build -t pdfme-generator:latest -f server/Dockerfile .

# Run container
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  pdfme-generator:latest

# Run with custom origin
docker run -p 3001:3001 \
  -e ALLOWED_ORIGIN=https://yourdomain.com \
  -e PORT=3001 \
  pdfme-generator:latest
```

### Docker Compose for Full Stack

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  playground:
    build:
      context: .
      dockerfile: playground/Dockerfile
    ports:
      - "5173:5173"
    environment:
      REACT_APP_PDF_SERVER_URL: http://generator:3001
    depends_on:
      - generator
    networks:
      - pdfme

  generator:
    build:
      context: .
      dockerfile: server/Dockerfile
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      ALLOWED_ORIGIN: http://localhost:5173
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    networks:
      - pdfme

networks:
  pdfme:
    driver: bridge
```

**Run full stack:**

```bash
docker-compose up --build
```

---

## Production Deployment

### Option 1: AWS Lambda

**File: `server/src/lambda.ts`** (handler for AWS Lambda)

```typescript
import { generate } from '@pdfme/generator';
import { checkTemplate } from '@pdfme/common';
import { getPlugins } from './plugins';
import { getFontsData } from './fonts';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Template } from '@pdfme/common';

interface GeneratePdfRequest {
  template: Template;
  inputs: Array<Record<string, string>>;
  options?: { title?: string };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const { template, inputs, options } = JSON.parse(event.body) as GeneratePdfRequest;

    if (!template || !inputs || inputs.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing template or inputs' }),
      };
    }

    checkTemplate(template);

    const pdf = await generate({
      template,
      inputs,
      options: {
        font: getFontsData(),
        title: options?.title || 'pdfme-document',
      },
      plugins: getPlugins(),
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
      body: Buffer.from(pdf).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Generation failed',
      }),
    };
  }
};
```

### Option 2: Heroku

**File: `server/Procfile`**

```
web: node dist/index.js
```

**Deploy:**

```bash
# Login to Heroku
heroku login

# Create app
heroku create my-pdfme-generator

# Set environment
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGIN=https://my-app.com

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option 3: Self-Hosted (DigitalOcean, Linode, AWS EC2)

**File: `server/ecosystem.config.js`** (PM2 configuration)

```javascript
module.exports = {
  apps: [
    {
      name: 'pdfme-generator',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_memory_restart: '1G',
    },
  ],
};
```

**Setup with PM2:**

```bash
# Install PM2 globally
npm install -g pm2

# Build
npm run build:server

# Start with PM2
pm2 start server/ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable startup on system reboot
pm2 startup
```

### Option 4: Kubernetes

**File: `server/k8s-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pdfme-generator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pdfme-generator
  template:
    metadata:
      labels:
        app: pdfme-generator
    spec:
      containers:
      - name: generator
        image: your-registry/pdfme-generator:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        - name: ALLOWED_ORIGIN
          value: "https://yourdomain.com"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: pdfme-generator-service
spec:
  selector:
    app: pdfme-generator
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

**Deploy:**

```bash
kubectl apply -f server/k8s-deployment.yaml
kubectl get pods
kubectl logs -f deployment/pdfme-generator
```

---

## Security Considerations

### 1. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

app.use('/api/pdf', limiter);
```

### 2. Input Validation

```typescript
import { checkTemplate } from '@pdfme/common';

try {
  checkTemplate(template);
} catch (error) {
  return res.status(400).json({
    error: `Invalid template: ${error instanceof Error ? error.message : 'unknown'}`
  });
}
```

### 3. File Size Limits

Already configured in Express:
```typescript
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
```

### 4. CORS Configuration

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
```

### 5. HTTPS/TLS

```typescript
import https from 'https';
import fs from 'fs';

if (process.env.NODE_ENV === 'production') {
  const options = {
    key: fs.readFileSync('/path/to/server.key'),
    cert: fs.readFileSync('/path/to/server.cert'),
  };
  https.createServer(options, app).listen(3001);
} else {
  app.listen(3001);
}
```

### 6. Authentication (Optional)

```typescript
router.use('/pdf', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || token !== process.env.API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 7. Content Security

```typescript
import helmet from 'helmet';

app.use(helmet());
```

---

## Monitoring & Logging

### Winston Logger Setup

**File: `server/src/logger.ts`**

```typescript
import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'pdfme-generator' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join('./logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // All logs
    new winston.transports.File({
      filename: path.join('./logs', 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

// Console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp }) =>
            `${timestamp} [${level}] ${message}`
        )
      ),
    })
  );
}

export default logger;
```

### Prometheus Metrics

```typescript
import promClient from 'prom-client';

const pdfGenerationDuration = new promClient.Histogram({
  name: 'pdf_generation_duration_ms',
  help: 'Duration of PDF generation in milliseconds',
  buckets: [100, 500, 1000, 5000, 10000],
});

const pdfGenerationErrors = new promClient.Counter({
  name: 'pdf_generation_errors_total',
  help: 'Total number of PDF generation errors',
  labelNames: ['error_type'],
});

router.post('/pdf', async (req, res) => {
  const start = Date.now();
  try {
    // ... generation code ...
    pdfGenerationDuration.observe(Date.now() - start);
  } catch (error) {
    pdfGenerationErrors.labels({ error_type: error?.constructor.name }).inc();
  }
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});
```

---

## Troubleshooting

### Issue: "Font not found" error

**Solution:**

1. Check fonts directory exists:
   ```bash
   ls server/fonts/
   ```

2. Download missing fonts:
   ```bash
   npm run download-fonts --workspace=server
   ```

3. Verify font file permissions:
   ```bash
   chmod 644 server/fonts/*.ttf
   ```

### Issue: CORS errors in browser

**Solution:**

1. Check `ALLOWED_ORIGIN` environment variable:
   ```bash
   echo $ALLOWED_ORIGIN
   ```

2. Update `.env.local`:
   ```
   REACT_APP_PDF_SERVER_URL=http://localhost:3001
   ```

3. Clear browser cache and reload

### Issue: "Template validation failed"

**Solution:**

1. Ensure template structure is correct:
   ```typescript
   import { checkTemplate } from '@pdfme/common';
   checkTemplate(template); // Should not throw
   ```

2. Verify all required fields are present:
   - `schemas`: Schema array
   - `basePdf`: Width, height, padding

### Issue: PDF generation timeout

**Solution:**

1. Increase Express timeout:
   ```typescript
   server.setTimeout(60000); // 60 seconds
   ```

2. Check server memory:
   ```bash
   free -h
   ```

3. Increase Node.js heap size:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

### Issue: Server crashes with "out of memory"

**Solution:**

1. Monitor memory usage:
   ```bash
   pm2 monit
   ```

2. Set memory limit in PM2:
   ```javascript
   max_memory_restart: '1G'
   ```

3. Use clustering:
   ```bash
   pm2 start server/dist/index.js -i max
   ```

---

## Examples

### Example 1: Generate PDF from Browser

```typescript
const template: Template = {
  schemas: [[
    {
      name: 'name',
      type: 'text',
      position: { x: 10, y: 10 },
      width: 50,
      height: 10,
    }
  ]],
  basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }
};

const inputs = [{ name: 'John Doe' }];

// Generate on server
const response = await fetch('http://localhost:3001/api/pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ template, inputs }),
});

const pdf = await response.blob();
window.open(URL.createObjectURL(pdf));
```

### Example 2: Batch Generate Multiple PDFs

```typescript
const inputs = [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' },
];

const response = await fetch('http://localhost:3001/api/pdf-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ template, inputs }),
});

const { pdfs } = await response.json();

// Download all PDFs
pdfs.forEach((pdf, index) => {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${pdf}`;
  link.download = `document-${index + 1}.pdf`;
  link.click();
});
```

### Example 3: Save PDFs to Cloud Storage

```typescript
import AWS from 'aws-sdk';

const s3 = new AWS.S3();

const response = await fetch('http://localhost:3001/api/pdf-base64', {
  method: 'POST',
  body: JSON.stringify({ template, inputs }),
});

const { pdf } = await response.json();

await s3.putObject({
  Bucket: 'my-bucket',
  Key: `pdfs/${Date.now()}.pdf`,
  Body: Buffer.from(pdf, 'base64'),
  ContentType: 'application/pdf',
}).promise();
```

---

## Summary

✅ **Separation of Concerns**: Browser handles design, server handles generation
✅ **Scalability**: Server can be horizontally scaled with load balancing
✅ **Font Management**: Centralized font control on server
✅ **Offline Capability**: Server can work offline with local fonts
✅ **Security**: Input validation, rate limiting, CORS
✅ **Monitoring**: Comprehensive logging and metrics
✅ **Deployment**: Multiple deployment options (Docker, Lambda, Heroku, self-hosted)

For questions or issues, refer to the [PDFme documentation](https://pdfme.com) or create an issue in the repository.
