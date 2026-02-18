# Custom Plugin Deployment Guide

## Overview

This guide explains how to create, test, and deploy custom plugins across a browser-server architecture. Custom plugins allow you to extend PDFme with domain-specific functionality (QR codes, specialized fields, custom rendering logic, etc.).

### Architecture Challenge

When deploying PDF generation on a server, custom plugins must be available in **both environments**:

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│      Browser/Playground      │         │   PDF Generation Server      │
│                              │         │                              │
│  • Designer UI               │         │  • Generator                 │
│  • Custom Plugin UI          │         │  • Custom Plugin PDF render  │
│  • Template editing          │  POST   │  • Same plugins as browser   │
│  • Form filling              │────────→│  • Fonts + plugins must sync │
│                              │         │                              │
└──────────────────────────────┘         └──────────────────────────────┘
         ↓                                          ↓
    Browser renders                         Server renders
    interactive UI                          PDF (binary)
```

**Critical requirement**: Custom plugins must be **identical code** in both places.

---

## Table of Contents

1. [Plugin Architecture](#plugin-architecture)
2. [Creating a Custom Plugin](#creating-a-custom-plugin)
3. [Monorepo Structure for Custom Plugins](#monorepo-structure-for-custom-plugins)
4. [Browser Registration](#browser-registration)
5. [Server Registration](#server-registration)
6. [Build and Distribution](#build-and-distribution)
7. [Complex Example: Custom Barcode Plugin](#complex-example-custom-barcode-plugin)
8. [Testing](#testing)
9. [Deployment Checklist](#deployment-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Plugin Architecture

### Plugin Interface

Every plugin must implement the `Plugin<T>` interface from `@pdfme/common`:

```typescript
import type { Plugin, Schema, PDFRenderProps, UIRenderProps, PropPanel } from '@pdfme/common';

export interface Plugin<T extends Schema = Schema> {
  // Required: PDF rendering function
  pdf: (arg: PDFRenderProps<T>) => Promise<void> | void;

  // Required: Interactive UI rendering (Designer, Form, Viewer)
  ui: (arg: UIRenderProps<T>) => Promise<void> | void;

  // Required: Property panel configuration for Designer
  propPanel: PropPanel<T>;

  // Optional: SVG icon (24x24)
  icon?: string;

  // Optional: Disable interruption during form editing
  uninterruptedEditMode?: boolean;
}
```

### Three Components of a Plugin

| Component | Purpose | Where Runs |
|-----------|---------|-----------|
| **`pdf`** | Renders content to PDF using pdf-lib | Server + Browser |
| **`ui`** | Renders interactive UI (canvas, form, etc.) | Browser only |
| **`propPanel`** | Designer property panel for configuration | Browser only |

---

## Creating a Custom Plugin

### Step 1: Define the Schema

First, define the data structure and configuration for your custom field type.

**File: `packages/custom-plugins/src/signature-pad/types.ts`**

```typescript
import type { Schema } from '@pdfme/common';

/**
 * SignaturePad Schema
 * Stores a signature as a Base64-encoded PNG image
 */
export interface SignaturePadSchema extends Schema {
  // Field-specific properties
  borderColor: string;
  borderWidth: number;
  backgroundColor: string;

  // Display options
  showPlaceholder: boolean;
  placeholderText?: string;

  // Signature-specific
  penColor: string;
  penWidth: number;
}

/**
 * Type definition for the plugin itself
 */
export type SignaturePadPlugin = Plugin<SignaturePadSchema>;
```

### Step 2: Implement PDF Rendering

The PDF render function creates the actual PDF output. It runs on **both server and browser**.

**File: `packages/custom-plugins/src/signature-pad/pdfRender.ts`**

```typescript
import type { PDFRenderProps } from '@pdfme/common';
import { rectanglePdfRender } from '@pdfme/schemas'; // Reuse built-in shapes
import type { SignaturePadSchema } from './types';

/**
 * Render signature (Base64 PNG) to PDF
 * Input: Base64 PNG data URL
 * Output: Embedded image in PDF
 */
export const pdfRender = async (arg: PDFRenderProps<SignaturePadSchema>) => {
  const { value, schema, pdfLib, pdfDoc, page, options } = arg;

  // Draw background rectangle
  await rectanglePdfRender({
    ...arg,
    schema: {
      name: '',
      type: 'rectangle',
      position: schema.position,
      width: schema.width,
      height: schema.height,
      color: schema.backgroundColor,
      borderColor: schema.borderColor,
      borderWidth: schema.borderWidth,
      readOnly: true,
    },
  });

  // Skip if no signature provided
  if (!value) {
    return;
  }

  try {
    // Extract base64 from data URL: "data:image/png;base64,iVBORw0KG..."
    const base64Data = value.split(',')[1];
    if (!base64Data) {
      console.warn('Invalid signature data format');
      return;
    }

    // Convert base64 to bytes
    const imageBytes = Buffer.from(base64Data, 'base64');

    // Embed image in PDF
    const image = await pdfDoc.embedPng(imageBytes);

    // Calculate aspect ratio
    const imageAspectRatio = image.width / image.height;
    const schemaAspectRatio = schema.width / schema.height;

    let drawWidth = schema.width;
    let drawHeight = schema.height;

    // Fit image to schema while maintaining aspect ratio
    if (imageAspectRatio > schemaAspectRatio) {
      drawHeight = schema.width / imageAspectRatio;
    } else {
      drawWidth = schema.height * imageAspectRatio;
    }

    // Center the image within the schema bounds
    const xOffset = (schema.width - drawWidth) / 2;
    const yOffset = (schema.height - drawHeight) / 2;

    page.drawImage(image, {
      x: schema.position.x + xOffset,
      y: schema.position.y + yOffset,
      width: drawWidth,
      height: drawHeight,
    });

  } catch (error) {
    console.error('Failed to render signature:', error);
  }
};
```

### Step 3: Implement UI Rendering

The UI render function creates interactive components. It runs **browser only**.

**File: `packages/custom-plugins/src/signature-pad/uiRender.ts`**

```typescript
import type { UIRenderProps } from '@pdfme/common';
import type { SignaturePadSchema } from './types';

/**
 * UI rendering for signature pad
 * Modes:
 * - designer: Show design canvas preview
 * - form: Show signature drawing pad
 * - viewer: Show static signature
 */
export const uiRender = async (arg: UIRenderProps<SignaturePadSchema>) => {
  const { value, schema, mode, onChange } = arg;

  // Get or create container
  const container = arg.rootElement as HTMLDivElement;
  container.style.position = 'relative';

  // Clear any existing content
  container.innerHTML = '';

  // Apply schema styles
  Object.assign(container.style, {
    width: '100%',
    height: '100%',
    backgroundColor: schema.backgroundColor,
    border: `${schema.borderWidth}px solid ${schema.borderColor}`,
    borderRadius: '4px',
    overflow: 'hidden',
  });

  if (mode === 'viewer' || !value) {
    // Viewer mode or no signature: show placeholder
    const placeholder = document.createElement('div');
    Object.assign(placeholder.style, {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#999',
      fontSize: '12px',
      textAlign: 'center',
      padding: '10px',
      boxSizing: 'border-box',
    });
    placeholder.textContent = schema.placeholderText || 'Signature';
    container.appendChild(placeholder);

    // If we have a signature, show it
    if (value && mode === 'viewer') {
      const img = document.createElement('img');
      img.src = value;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      container.innerHTML = '';
      container.appendChild(img);
    }

    return;
  }

  if (mode === 'form') {
    // Form mode: editable signature pad
    const canvas = document.createElement('canvas');
    canvas.width = container.offsetWidth * 2; // For retina displays
    canvas.height = container.offsetHeight * 2;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'crosshair';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw existing signature if available
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = value;
    } else {
      // Clear canvas
      ctx.fillStyle = schema.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Signature drawing logic
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const event = 'touches' in e ? e.touches[0] : e;
      lastX = (event.clientX - rect.left) * 2;
      lastY = (event.clientY - rect.top) * 2;
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      const event = 'touches' in e ? e.touches[0] : e;
      const x = (event.clientX - rect.left) * 2;
      const y = (event.clientY - rect.top) * 2;

      ctx.strokeStyle = schema.penColor;
      ctx.lineWidth = schema.penWidth * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      isDrawing = false;

      // Convert canvas to base64 PNG and emit change
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
        };
        if (blob) reader.readAsDataURL(blob);
      }, 'image/png');
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, false);
    canvas.addEventListener('touchmove', draw, false);
    canvas.addEventListener('touchend', stopDrawing, false);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      padding: 4px 8px;
      font-size: 11px;
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      z-index: 10;
    `;
    clearBtn.onclick = () => {
      ctx.fillStyle = schema.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      onChange('');
    };

    container.appendChild(canvas);
    container.appendChild(clearBtn);
    return;
  }

  if (mode === 'designer') {
    // Designer mode: show preview
    const preview = document.createElement('div');
    Object.assign(preview.style, {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: '#666',
    });

    if (value) {
      const img = document.createElement('img');
      img.src = value;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      preview.appendChild(img);
    } else {
      preview.textContent = schema.placeholderText || '✎ Signature Preview';
    }

    container.appendChild(preview);
  }
};
```

### Step 4: Implement Property Panel

The property panel configures the schema in the Designer. It runs **browser only**.

**File: `packages/custom-plugins/src/signature-pad/propPanel.ts`**

```typescript
import type { PropPanel } from '@pdfme/common';
import type { SignaturePadSchema } from './types';

export const propPanel: PropPanel<SignaturePadSchema> = {
  // Default schema when creating new field
  defaultSchema: {
    name: 'signature',
    type: 'signaturePad',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    borderColor: '#000000',
    borderWidth: 1,
    backgroundColor: '#ffffff',
    showPlaceholder: true,
    placeholderText: 'Sign here',
    penColor: '#000000',
    penWidth: 2,
  },

  // Schema properties configuration
  schema: [
    {
      name: 'name',
      label: 'Field Name',
      widget: 'text',
    },
    {
      name: 'borderColor',
      label: 'Border Color',
      widget: 'color',
    },
    {
      name: 'borderWidth',
      label: 'Border Width',
      widget: 'number',
    },
    {
      name: 'backgroundColor',
      label: 'Background Color',
      widget: 'color',
    },
    {
      name: 'penColor',
      label: 'Pen Color',
      widget: 'color',
    },
    {
      name: 'penWidth',
      label: 'Pen Width',
      widget: 'number',
      min: 0.5,
      max: 5,
      step: 0.5,
    },
    {
      name: 'placeholderText',
      label: 'Placeholder Text',
      widget: 'text',
    },
  ],

  // UI section in Designer (optional)
  uiSchema: {
    // Organize properties into sections
    'ui:order': [
      'name',
      'borderColor',
      'borderWidth',
      'backgroundColor',
      'penColor',
      'penWidth',
      'placeholderText',
    ],
  },
};
```

### Step 5: Create Plugin Export

**File: `packages/custom-plugins/src/signature-pad/index.ts`**

```typescript
import type { Plugin } from '@pdfme/common';
import { pdfRender } from './pdfRender';
import { uiRender } from './uiRender';
import { propPanel } from './propPanel';
import type { SignaturePadSchema } from './types';

// SVG icon (24x24)
const icon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M5 19c-1-1-1-2-1-4V5c0-1 1-2 2-2h14c1 0 2 1 2 2v10c0 2 0 3-1 4M3 19h18M9 5c1 1 2 2 3 2s2-1 3-2"/>
  </svg>
`;

export const signaturePad: Plugin<SignaturePadSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon,
};

export type { SignaturePadSchema };
export default signaturePad;
```

### Step 6: Create Barrel Export

**File: `packages/custom-plugins/src/index.ts`**

```typescript
// Export all custom plugins and types
export { signaturePad } from './signature-pad/index';
export type { SignaturePadSchema } from './signature-pad/types';

// You can add more plugins here
// export { customQrCode } from './custom-qr/index';
// export type { CustomQrCodeSchema } from './custom-qr/types';
```

---

## Monorepo Structure for Custom Plugins

Organize custom plugins as a separate package in your monorepo:

```
pdfme/
├── packages/
│   ├── common/                 # Core types (already exists)
│   ├── schemas/                # Built-in plugins (already exists)
│   ├── generator/              # PDF generation (already exists)
│   ├── ui/                     # React components (already exists)
│   │
│   └── custom-plugins/         # ← NEW: Custom plugins package
│       ├── src/
│       │   ├── index.ts        # Main export
│       │   ├── signature-pad/
│       │   │   ├── index.ts
│       │   │   ├── types.ts
│       │   │   ├── pdfRender.ts
│       │   │   ├── uiRender.ts
│       │   │   ├── propPanel.ts
│       │   │   └── __tests__/
│       │   │       ├── pdfRender.test.ts
│       │   │       └── uiRender.test.ts
│       │   │
│       │   ├── custom-qr/      # Another custom plugin
│       │   │   ├── index.ts
│       │   │   ├── types.ts
│       │   │   ├── pdfRender.ts
│       │   │   ├── uiRender.ts
│       │   │   └── propPanel.ts
│       │   │
│       │   └── stamp/          # Yet another custom plugin
│       │       ├── index.ts
│       │       ├── types.ts
│       │       ├── pdfRender.ts
│       │       ├── uiRender.ts
│       │       └── propPanel.ts
│       │
│       ├── dist/               # Compiled output
│       ├── tsconfig.json
│       ├── package.json
│       └── README.md
│
├── server/
│   └── src/
│       ├── plugins.ts          # ← IMPORT custom plugins here
│       └── ...
│
└── playground/
    └── src/
        ├── plugins.ts          # ← IMPORT custom plugins here
        └── ...
```

### Package.json for Custom Plugins

**File: `packages/custom-plugins/package.json`**

```json
{
  "name": "@pdfme/custom-plugins",
  "version": "1.0.0",
  "description": "Custom PDFme plugins for extended functionality",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "require": "./dist/cjs/index.js",
      "import": "./dist/esm/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./signature-pad": {
      "require": "./dist/cjs/signature-pad/index.js",
      "import": "./dist/esm/signature-pad/index.js",
      "types": "./dist/types/signature-pad/index.d.ts"
    }
  },
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@pdfme/common": "workspace:*",
    "@pdfme/schemas": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@pdfme/common": "*",
    "@pdfme/schemas": "*"
  }
}
```

---

## Browser Registration

### In Playground

**File: `playground/src/plugins.ts`** (modified)

```typescript
import {
  // Built-in plugins
  text,
  table,
  nestedTable,
  image,
  svg,
  // ... other built-ins
} from '@pdfme/schemas';

// ← Import custom plugins
import {
  signaturePad,
  // customQrCode,
  // stamp,
} from '@pdfme/custom-plugins';

/**
 * Get all available plugins for the Designer
 * Includes both built-in and custom plugins
 */
export const getPlugins = () => {
  return {
    // Built-in plugins
    Text: text,
    Table: table,
    'Nested Table': nestedTable,
    Image: image,
    SVG: svg,
    // ... other built-ins

    // ← Custom plugins
    'Signature Pad': signaturePad,
    // 'Custom QR': customQrCode,
    // 'Stamp': stamp,
  };
};
```

### In Designer Component

**File: `playground/src/routes/Designer.tsx`** (already configured in buildDesigner)

```typescript
designer.current = new Designer({
  domContainer: designerRef.current,
  template,
  options: {
    font: getFontsData(),
    lang: 'en',
    theme: { token: { colorPrimary: "#25c2a0" } },
  },
  plugins: getPlugins(), // ← Will include custom plugins
});
```

---

## Server Registration

### On PDF Generation Server

**File: `server/src/plugins.ts`** (modified)

```typescript
import {
  // Built-in plugins
  text,
  table,
  nestedTable,
  image,
  svg,
  line,
  rectangle,
  // ... other built-ins
} from '@pdfme/schemas';

// ← Import SAME custom plugins as browser
import {
  signaturePad,
  // customQrCode,
  // stamp,
} from '@pdfme/custom-plugins';

import type { Plugins } from '@pdfme/common';

/**
 * Get all available plugins for PDF generation
 * MUST include the SAME custom plugins as browser
 */
export function getPlugins(): Plugins {
  return {
    // Built-in plugins
    Text: text,
    Table: table,
    'Nested Table': nestedTable,
    Image: image,
    SVG: svg,
    Line: line,
    Rectangle: rectangle,
    // ... other built-ins

    // ← SAME custom plugins as browser
    'Signature Pad': signaturePad,
    // 'Custom QR': customQrCode,
    // 'Stamp': stamp,
  };
}
```

### Critical: Plugin Parity

```
┌─────────────────────────────────────────────────────────────┐
│                    CRITICAL REQUIREMENT                     │
├─────────────────────────────────────────────────────────────┤
│  The plugins object returned by getPlugins() MUST be        │
│  IDENTICAL in both browser and server.                      │
│                                                              │
│  ✓ Same plugin names (keys)                                 │
│  ✓ Same plugin instances (values)                           │
│  ✓ Same plugin version                                      │
│                                                              │
│  If a plugin exists in browser but not server:              │
│  → PDF generation will fail with "plugin not found"         │
│                                                              │
│  If a plugin exists in server but not browser:              │
│  → Designer will allow creating templates that can't render │
└─────────────────────────────────────────────────────────────┘
```

---

## Build and Distribution

### Build Steps

```bash
# 1. Build custom plugins package
cd packages/custom-plugins
npm run build

# 2. Build depends on custom plugins (if using monorepo)
cd ../server
npm run build

cd ../playground
npm run build
```

### Automatic Build Chain

**File: `package.json` (root)**

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "build:custom-plugins": "npm run build -w packages/custom-plugins",
    "build:server": "npm run build:custom-plugins && npm run build -w server",
    "build:playground": "npm run build:custom-plugins && npm run build -w playground"
  }
}
```

### Publishing Custom Plugins

#### Option 1: Monorepo (Private/Internal)

Keep custom plugins in the monorepo. The server and playground both reference the same local package.

**server/package.json:**
```json
{
  "dependencies": {
    "@pdfme/custom-plugins": "workspace:*"
  }
}
```

**playground/package.json:**
```json
{
  "dependencies": {
    "@pdfme/custom-plugins": "workspace:*"
  }
}
```

#### Option 2: NPM Registry (Public)

Publish to NPM for external distribution.

```bash
# Build
npm run build -w packages/custom-plugins

# Publish
cd packages/custom-plugins
npm publish
```

Then both browser and server install from NPM:

**server/package.json:**
```json
{
  "dependencies": {
    "@yourorg/pdfme-custom-plugins": "^1.0.0"
  }
}
```

#### Option 3: Docker Shared Volume

Embed in Docker image so server and browser use identical code.

**server/Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy entire monorepo (including custom plugins)
COPY packages/ ./packages/
COPY server/ ./server/

# Build custom plugins first
RUN npm run build:custom-plugins

# Build server (uses custom plugins)
RUN npm run build -w server

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

---

## Complex Example: Custom Barcode Plugin

Here's a complete example of a more complex custom plugin.

### Signature: Custom QR Code Plugin

**File: `packages/custom-plugins/src/custom-qr/types.ts`**

```typescript
import type { Schema } from '@pdfme/common';

export interface CustomQrCodeSchema extends Schema {
  // QR code specific
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  version: number; // 1-40, auto if 0

  // Display
  backgroundColor: string;
  foregroundColor: string;

  // Sizing
  moduleCount?: number; // Pixels per module
}
```

**File: `packages/custom-plugins/src/custom-qr/pdfRender.ts`**

```typescript
import type { PDFRenderProps } from '@pdfme/common';
import QRCode from 'qrcode';
import type { CustomQrCodeSchema } from './types';

export const pdfRender = async (arg: PDFRenderProps<CustomQrCodeSchema>) => {
  const { value, schema, pdfDoc, page } = arg;

  if (!value) {
    return; // Skip rendering if no value
  }

  try {
    // Generate QR code as PNG data URL
    const qrDataUrl = await QRCode.toDataURL(value, {
      errorCorrectionLevel: schema.errorCorrectionLevel,
      version: schema.version === 0 ? undefined : schema.version,
      width: 200, // Temporary, will be resized
      color: {
        dark: schema.foregroundColor,
        light: schema.backgroundColor,
      },
    });

    // Extract base64
    const base64 = qrDataUrl.split(',')[1];
    const imageBytes = Buffer.from(base64, 'base64');

    // Embed in PDF
    const image = await pdfDoc.embedPng(imageBytes);

    // QR codes are square, so use schema width/height as-is
    page.drawImage(image, {
      x: schema.position.x,
      y: schema.position.y,
      width: schema.width,
      height: schema.height,
    });

  } catch (error) {
    console.error('Failed to generate QR code:', error);
  }
};
```

**File: `packages/custom-plugins/src/custom-qr/uiRender.ts`**

```typescript
import type { UIRenderProps } from '@pdfme/common';
import QRCode from 'qrcode';
import type { CustomQrCodeSchema } from './types';

export const uiRender = async (arg: UIRenderProps<CustomQrCodeSchema>) => {
  const { value, schema, mode } = arg;

  const container = arg.rootElement as HTMLDivElement;
  container.style.position = 'relative';
  container.innerHTML = '';

  if (!value) {
    // Show placeholder
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${schema.backgroundColor};
      color: #999;
      font-size: 12px;
    `;
    placeholder.textContent = 'QR Code';
    container.appendChild(placeholder);
    return;
  }

  try {
    // Generate QR code as image element
    const qrDataUrl = await QRCode.toDataURL(value, {
      errorCorrectionLevel: schema.errorCorrectionLevel,
      version: schema.version === 0 ? undefined : schema.version,
      width: 200,
      color: {
        dark: schema.foregroundColor,
        light: schema.backgroundColor,
      },
    });

    const img = document.createElement('img');
    img.src = qrDataUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    container.appendChild(img);

  } catch (error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.textContent = 'Invalid QR data';
    container.appendChild(errorDiv);
  }
};
```

**File: `packages/custom-plugins/src/custom-qr/propPanel.ts`**

```typescript
import type { PropPanel } from '@pdfme/common';
import type { CustomQrCodeSchema } from './types';

export const propPanel: PropPanel<CustomQrCodeSchema> = {
  defaultSchema: {
    name: 'qrCode',
    type: 'customQr',
    position: { x: 0, y: 0 },
    width: 50,
    height: 50,
    errorCorrectionLevel: 'M',
    version: 0, // Auto
    backgroundColor: '#ffffff',
    foregroundColor: '#000000',
  },

  schema: [
    {
      name: 'name',
      label: 'Field Name',
      widget: 'text',
    },
    {
      name: 'errorCorrectionLevel',
      label: 'Error Correction',
      widget: 'select',
      options: [
        { label: 'L (7%)', value: 'L' },
        { label: 'M (15%)', value: 'M' },
        { label: 'Q (25%)', value: 'Q' },
        { label: 'H (30%)', value: 'H' },
      ],
    },
    {
      name: 'version',
      label: 'Version (0=Auto)',
      widget: 'number',
      min: 0,
      max: 40,
    },
    {
      name: 'backgroundColor',
      label: 'Background Color',
      widget: 'color',
    },
    {
      name: 'foregroundColor',
      label: 'Foreground Color',
      widget: 'color',
    },
  ],
};
```

**File: `packages/custom-plugins/src/custom-qr/index.ts`**

```typescript
import type { Plugin } from '@pdfme/common';
import { pdfRender } from './pdfRender';
import { uiRender } from './uiRender';
import { propPanel } from './propPanel';
import type { CustomQrCodeSchema } from './types';

const icon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <circle cx="18" cy="18" r="3" />
  </svg>
`;

export const customQrCode: Plugin<CustomQrCodeSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon,
};

export type { CustomQrCodeSchema };
export default customQrCode;
```

---

## Testing

### Unit Tests for PDF Rendering

**File: `packages/custom-plugins/src/signature-pad/__tests__/pdfRender.test.ts`**

```typescript
import { pdfRender } from '../pdfRender';
import { PDFDocument } from '@pdfme/pdf-lib';
import type { SignaturePadSchema } from '../types';

describe('SignaturePad PDF Render', () => {
  it('should render without value', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([210, 297]);

    const mockArg = {
      value: '',
      schema: {
        name: 'signature',
        type: 'signaturePad',
        position: { x: 10, y: 10 },
        width: 100,
        height: 50,
        borderColor: '#000000',
        borderWidth: 1,
        backgroundColor: '#ffffff',
        penColor: '#000000',
        penWidth: 2,
      } as SignaturePadSchema,
      pdfDoc,
      page,
      pdfLib: require('@pdfme/pdf-lib'),
      basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
      options: { font: {} },
      _cache: new Map(),
    };

    // Should not throw
    await pdfRender(mockArg as any);
  });

  it('should render signature image', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([210, 297]);

    // Create a valid base64 PNG
    const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const mockArg = {
      value: `data:image/png;base64,${validBase64}`,
      schema: {
        name: 'signature',
        type: 'signaturePad',
        position: { x: 10, y: 10 },
        width: 100,
        height: 50,
        borderColor: '#000000',
        borderWidth: 1,
        backgroundColor: '#ffffff',
        penColor: '#000000',
        penWidth: 2,
      } as SignaturePadSchema,
      pdfDoc,
      page,
      pdfLib: require('@pdfme/pdf-lib'),
      basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
      options: { font: {} },
      _cache: new Map(),
    };

    // Should not throw
    await pdfRender(mockArg as any);
  });
});
```

### Integration Tests

**File: `packages/custom-plugins/src/__tests__/integration.test.ts`**

```typescript
import { generate } from '@pdfme/generator';
import { getPlugins } from '../../src/index';

describe('Custom Plugins Integration', () => {
  it('should generate PDF with custom plugin', async () => {
    const template = {
      schemas: [[
        {
          name: 'signature',
          type: 'signaturePad',
          position: { x: 10, y: 10 },
          width: 100,
          height: 50,
          borderColor: '#000000',
          borderWidth: 1,
          backgroundColor: '#ffffff',
          penColor: '#000000',
          penWidth: 2,
        }
      ]],
      basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] }
    };

    const inputs = [{
      signature: 'data:image/png;base64,iVBORw0KGgo...'
    }];

    const pdf = await generate({
      template,
      inputs,
      plugins: getPlugins(),
      options: { font: {} }
    });

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
```

### Snapshot Tests

```bash
npm test -- --updateSnapshot
```

---

## Deployment Checklist

### Before Deploying

- [ ] **Plugin code is identical** in both browser and server
- [ ] **All dependencies** (like `qrcode` library) are installed in both places
- [ ] **Plugin registered** in `browser/src/plugins.ts`
- [ ] **Plugin registered** in `server/src/plugins.ts`
- [ ] **Same plugin name** (key) in both `getPlugins()` functions
- [ ] **PDF render function** handles all input cases (empty, valid, invalid)
- [ ] **Unit tests** pass: `npm run test`
- [ ] **Type checks** pass: `npm run type-check`
- [ ] **Builds succeed**: `npm run build`
- [ ] **No unused dependencies** in package.json

### Server Deployment

1. **Update server/package.json:**
   ```json
   {
     "dependencies": {
       "@pdfme/custom-plugins": "workspace:*"
     }
   }
   ```

2. **Update server/src/plugins.ts:**
   ```typescript
   import { signaturePad } from '@pdfme/custom-plugins';

   export function getPlugins() {
     return {
       // ... other plugins
       'Signature Pad': signaturePad,
     };
   }
   ```

3. **Rebuild server:**
   ```bash
   npm run build:server
   ```

4. **Test locally:**
   ```bash
   npm run dev:server
   ```

5. **Deploy:**
   ```bash
   docker build -t pdfme-generator:latest .
   docker push your-registry/pdfme-generator:latest
   ```

### Browser Deployment

1. **Update playground/package.json:**
   ```json
   {
     "dependencies": {
       "@pdfme/custom-plugins": "workspace:*"
     }
   }
   ```

2. **Update playground/src/plugins.ts:**
   ```typescript
   import { signaturePad } from '@pdfme/custom-plugins';

   export const getPlugins = () => {
     return {
       // ... other plugins
       'Signature Pad': signaturePad,
     };
   }
   ```

3. **Rebuild playground:**
   ```bash
   npm run build:playground
   ```

4. **Test locally:**
   ```bash
   npm run dev:playground
   ```

5. **Deploy to CDN/hosting:**
   ```bash
   npm run build:playground
   # Deploy dist/ folder
   ```

---

## Troubleshooting

### Issue: "Plugin not found" error when generating PDF

**Cause**: Custom plugin registered in browser but not on server.

**Solution**:
1. Verify plugin in `server/src/plugins.ts`:
   ```bash
   grep -n "signaturePad" server/src/plugins.ts
   ```

2. Ensure same name in both `getPlugins()`:
   ```bash
   diff <(grep "Signature" playground/src/plugins.ts) \
        <(grep "Signature" server/src/plugins.ts)
   ```

3. Rebuild and redeploy server:
   ```bash
   npm run build:server
   ```

### Issue: Custom plugin not appearing in Designer

**Cause**: Plugin not registered in browser or import missing.

**Solution**:
1. Check import in `playground/src/plugins.ts`:
   ```typescript
   import { signaturePad } from '@pdfme/custom-plugins'; // ← Must exist
   ```

2. Check export from custom plugins:
   ```bash
   cat packages/custom-plugins/src/index.ts | grep "export"
   ```

3. Rebuild playground:
   ```bash
   npm run build:playground
   ```

4. Clear browser cache and reload

### Issue: Different plugin versions between browser and server

**Cause**: Dependencies were updated differently.

**Solution**:
1. Check versions:
   ```bash
   npm ls @pdfme/custom-plugins
   ```

2. Ensure monorepo uses workspace dependencies:
   ```json
   {
     "dependencies": {
       "@pdfme/custom-plugins": "workspace:*"
     }
   }
   ```

3. Rebuild both:
   ```bash
   npm run build
   ```

### Issue: PDF rendering produces blank output for custom field

**Cause**: PDF render function has an error or returns early.

**Solution**:
1. Check server logs:
   ```bash
   docker logs pdfme-generator
   ```

2. Add debug logging to pdfRender:
   ```typescript
   export const pdfRender = async (arg: PDFRenderProps<YourSchema>) => {
     console.log('Rendering with value:', arg.value);
     console.log('Schema:', arg.schema);
     // ... rest of code
   };
   ```

3. Test locally with dev server:
   ```bash
   npm run dev:server
   ```

4. Send test request:
   ```bash
   curl -X POST http://localhost:3001/api/pdf \
     -H "Content-Type: application/json" \
     -d '{"template": {...}, "inputs": [...]}'
   ```

### Issue: UI not rendering in Designer or Form

**Cause**: UIRender function has errors or missing element binding.

**Solution**:
1. Open browser console (F12) and check for JavaScript errors
2. Verify `rootElement` is accessible in `uiRender`:
   ```typescript
   const container = arg.rootElement as HTMLDivElement;
   if (!container) {
     console.error('No root element provided');
     return;
   }
   ```

3. Test UI rendering independently:
   ```typescript
   // In browser console
   const container = document.createElement('div');
   container.style.width = '200px';
   container.style.height = '200px';
   document.body.appendChild(container);

   signaturePad.ui({
     rootElement: container,
     value: '',
     schema: {...},
     mode: 'form',
     onChange: (v) => console.log('Changed:', v),
   });
   ```

### Issue: Custom plugin increases bundle size too much

**Solution**:
1. Use dynamic imports:
   ```typescript
   // In plugins.ts
   const customPlugins = import('@pdfme/custom-plugins');

   export const getPlugins = async () => {
     const { signaturePad } = await customPlugins;
     return {
       // ...
       'Signature Pad': signaturePad,
     };
   };
   ```

2. Tree-shake unused plugins:
   ```typescript
   // Only import what you need
   import { signaturePad } from '@pdfme/custom-plugins/signature-pad';
   ```

3. Use webpack bundle analyzer:
   ```bash
   npm install --save-dev webpack-bundle-analyzer
   ```

---

## Summary

### Key Principles

1. **Plugin Parity**: Same code runs in browser and server
2. **Modular Design**: Plugin is self-contained in one package
3. **Clear Responsibilities**:
   - `pdf()` → PDF rendering (browser + server)
   - `ui()` → Interactive UI (browser only)
   - `propPanel` → Designer config (browser only)
4. **Test Early**: Unit test PDF rendering before deploying
5. **Version Control**: Keep versions in sync between environments

### Deployment Flow

```
1. Create plugin
   └─> src/my-plugin/{pdfRender, uiRender, propPanel, types, index}

2. Test locally
   └─> npm test

3. Register in both
   └─> playground/src/plugins.ts
   └─> server/src/plugins.ts

4. Build and deploy
   └─> npm run build
   └─> Deploy browser + server

5. Verify
   └─> Test in Designer
   └─> Generate PDF on server
   └─> Verify output
```

---

## References

- [PDFme Plugin Documentation](https://pdfme.com/docs/custom-plugins)
- [PDFme Schemas Source](https://github.com/pdfme/pdfme/tree/main/packages/schemas/src)
- [pdf-lib Documentation](https://pdfme.com/docs/custom-plugins#using-pdf-lib)

