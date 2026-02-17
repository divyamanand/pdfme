# PDFme Quick Reference Guide

## Quick Navigation

### I. Creating a Template
### II. Generating a PDF
### III. Building a Custom Plugin
### IV. Key Types & Interfaces
### V. Common Patterns & Examples

---

## I. Creating a Template

### Basic Template Structure

```typescript
import { Template } from '@pdfme/common';

const template: Template = {
  // BasePdf: Define canvas size
  basePdf: {
    width: 210,   // mm
    height: 297,  // mm (A4)
    padding: [10, 10, 10, 10]  // [top, right, bottom, left]
  },

  // Schemas: 2D array [page][field]
  schemas: [
    [
      // Page 1, Field 1: Text
      {
        id: 'field-1',
        type: 'text',         // Must match plugin type
        name: 'customerName', // Data binding key
        position: { x: 10, y: 20 },
        width: 100,
        height: 10,
        fontSize: 14,
        fontColor: '#000000',
        alignment: 'left'
      },
      // Page 1, Field 2: Image
      {
        id: 'field-2',
        type: 'image',
        name: 'logo',
        position: { x: 10, y: 35 },
        width: 50,
        height: 20,
        fit: 'contain'
      }
    ],
    [
      // Page 2, Field 1: Table
      {
        id: 'field-3',
        type: 'table',
        name: 'products',
        position: { x: 10, y: 10 },
        width: 190,
        height: 50,
        head: ['Product', 'Price', 'Qty'],
        // Data comes from input
      }
    ]
  ],

  // Optional: Fields on every page
  staticSchema: [
    {
      id: 'footer',
      type: 'text',
      name: '', // Static, not data-bound
      content: 'Page [page] of [totalPages]',  // Special vars
      position: { x: 10, y: 280 },
      width: 190,
      height: 5,
      fontSize: 8
    }
  ]
};

export default template;
```

---

## II. Generating a PDF

### Using the Generator

```typescript
import { generate } from '@pdfme/generator';
import { builtInPlugins } from '@pdfme/schemas';
import template from './template';

// Input data: flat object
const inputs = [
  {
    customerName: 'John Doe',
    logo: 'data:image/png;base64,...',
    products: [['Laptop', '$999', '1']]
  },
  {
    customerName: 'Jane Smith',
    logo: 'data:image/png;base64,...',
    products: [['Phone', '$599', '2']]
  }
];

// Generate
const pdf = await generate({
  template,
  inputs,
  options: {
    font: {
      'Arial': {
        data: fontBuffer,  // ArrayBuffer or URL
        fallback: true
      }
    }
  },
  plugins: builtInPlugins
});

// Output: Uint8Array (PDF binary)
// Download
const blob = new Blob([pdf], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'document.pdf';
a.click();
```

---

## III. Building a Custom Plugin

### Step 1: Define Schema Type

```typescript
// types.ts
import type { Schema } from '@pdfme/common';

export interface EmailSchema extends Schema {
  fontSize: number;
  fontColor: string;
  fontName?: string;
  alignment: 'left' | 'center' | 'right';
  underline?: boolean;
}
```

### Step 2: Implement PDF Renderer

```typescript
// pdfRender.ts
import type { PDFRenderProps } from '@pdfme/common';
import type { EmailSchema } from './types';

export const pdfRender = async (props: PDFRenderProps<EmailSchema>) => {
  const { value, schema, page, pdfDoc, options, _cache } = props;

  // Skip if no value
  if (!value) return;

  // Embed font
  const fontObj = await embedFont(pdfDoc, options.font, _cache);

  // Draw
  page.drawText(value, {
    x: schema.position.x,
    y: schema.position.y,
    size: schema.fontSize,
    color: parseColor(schema.fontColor),
    font: fontObj
  });

  // Optional: Add underline
  if (schema.underline) {
    page.drawLine({
      start: { x: schema.position.x, y: schema.position.y - 2 },
      end: { x: schema.position.x + schema.width, y: schema.position.y - 2 },
      thickness: 1
    });
  }
};
```

### Step 3: Implement UI Renderer

```typescript
// uiRender.ts
import type { UIRenderProps } from '@pdfme/common';
import type { EmailSchema } from './types';

export const uiRender = async (props: UIRenderProps<EmailSchema>) => {
  const { value, schema, rootElement, mode, onChange } = props;

  // Create container
  const container = document.createElement('input');
  container.type = 'email';
  container.value = value;

  // Style
  Object.assign(container.style, {
    fontSize: `${schema.fontSize}px`,
    color: schema.fontColor,
    textAlign: schema.alignment,
    textDecoration: schema.underline ? 'underline' : 'none'
  });

  if (mode !== 'viewer') {
    // Editable
    container.addEventListener('change', () => {
      if (onChange) {
        onChange({ key: 'value', value: container.value });
      }
    });
  } else {
    // Read-only
    container.disabled = true;
  }

  rootElement.appendChild(container);
};
```

### Step 4: Create Property Panel

```typescript
// propPanel.ts
import type { PropPanel } from '@pdfme/common';
import type { EmailSchema } from './types';

export const propPanel: PropPanel<EmailSchema> = {
  schema: {
    fontSize: {
      type: 'number',
      widget: 'inputNumber',
      title: 'Font Size',
      props: { min: 6, max: 72 },
      span: 6
    },
    alignment: {
      type: 'string',
      widget: 'select',
      title: 'Alignment',
      props: {
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' }
        ]
      },
      span: 6
    },
    fontColor: {
      type: 'string',
      widget: 'colorPicker',
      title: 'Color',
      span: 12
    },
    underline: {
      type: 'boolean',
      widget: 'checkbox',
      title: 'Underline',
      span: 12
    }
  },

  defaultSchema: {
    fontSize: 12,
    fontColor: '#0000FF',
    alignment: 'left',
    width: 100,
    height: 10,
    position: { x: 0, y: 0 }
  }
};
```

### Step 5: Export Plugin

```typescript
// index.ts
import type { Plugin } from '@pdfme/common';
import { pdfRender } from './pdfRender';
import { uiRender } from './uiRender';
import { propPanel } from './propPanel';
import type { EmailSchema } from './types';
import { Mail } from 'lucide';

const emailPlugin: Plugin<EmailSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon: '<svg>...</svg>',  // SVG icon
  uninterruptedEditMode: true  // Don't re-render while typing
};

export default emailPlugin;
```

### Step 6: Use Plugin

```typescript
import Designer from '@pdfme/ui';
import emailPlugin from './email';

const designer = new Designer({
  domContainer: document.getElementById('designer'),
  template,
  plugins: {
    text: textPlugin,
    email: emailPlugin,    // ← Use custom plugin
    image: imagePlugin,
    table: tablePlugin
  }
});
```

---

## IV. Key Types & Interfaces

### Template Type

```typescript
type Template = {
  basePdf: BasePdf;        // Canvas definition
  schemas: Schema[][];     // 2D array: pages → fields
  staticSchema?: Schema[]; // Fields on every page
  pdfmeVersion: string;    // Version tracking
};
```

### Schema Type

```typescript
type Schema = {
  // Identity
  id: string;              // Unique field ID
  type: string;            // Field type (plugin type)
  name: string;            // Data binding key

  // Position & Size (in mm)
  position: { x, y };
  width: number;
  height: number;

  // Styling
  rotate?: number;         // Degrees
  opacity?: number;        // 0-1

  // Content
  content?: string;        // Static content for readOnly
  readOnly?: boolean;      // Data-bound or static

  // Type-specific: handled by plugin
  [key: string]: any;
};
```

### Plugin Interface

```typescript
type Plugin<T extends Schema> = {
  // 1. PDF Rendering Function
  pdf: (props: PDFRenderProps<T>) => Promise<void> | void;

  // 2. UI Rendering Function
  ui: (props: UIRenderProps<T>) => Promise<void> | void;

  // 3. Property Panel Configuration
  propPanel: PropPanel<T>;

  // Optional
  icon?: string;                    // SVG icon
  uninterruptedEditMode?: boolean;  // Prevent re-render during edit
};
```

### PDFRenderProps Type

```typescript
type PDFRenderProps<T extends Schema> = {
  value: string;                    // Data to render
  schema: T;                        // Field configuration
  basePdf: BasePdf;                 // Canvas info
  pdfLib: typeof import('@pdfme/pdf-lib');  // PDF library
  pdfDoc: PDFDocument;              // PDF document
  page: PDFPage;                    // Current page
  options: GeneratorOptions;        // Generation options
  _cache: Map<string | number, unknown>;  // Caching
};
```

### UIRenderProps Type

```typescript
type UIRenderProps<T extends Schema> = {
  value: string;                    // Data to display
  schema: T;                        // Field configuration
  basePdf: BasePdf;                 // Canvas info
  mode: 'viewer' | 'form' | 'designer';  // Render mode
  rootElement: HTMLDivElement;      // Target element
  options: UIOptions;               // UI options
  theme: GlobalToken;               // Ant Design theme
  i18n: (key: string) => string;    // Translation function
  scale: number;                    // Scaling factor
  _cache: Map<string | number, unknown>;  // Caching

  // Optional (form/designer mode)
  onChange?: (changes) => void;     // Data change callback
  tabIndex?: number;                // Tab index
  placeholder?: string;             // Placeholder text
  stopEditing?: () => void;         // Exit edit mode
};
```

### PropPanel Type

```typescript
type PropPanel<T extends Schema> = {
  // Form schema (form-render format)
  schema: Record<string, PropPanelSchema> |
          (props) => Record<string, PropPanelSchema>;

  // Custom widgets
  widgets?: Record<string, (props) => void>;

  // Defaults when creating field
  defaultSchema: T;
};
```

---

## V. Common Patterns & Examples

### Pattern 1: Static Content with Expressions

```typescript
const schema = {
  type: 'text',
  name: 'greeting',
  readOnly: true,  // Static, not data-bound
  content: 'Hello {{customerName}}, today is {{date}}'
};

const input = {
  customerName: 'John',
  date: '2024-02-17'
};

// Result: "Hello John, today is 2024-02-17"
```

### Pattern 2: Conditional Content

```typescript
const schema = {
  type: 'text',
  name: 'status',
  readOnly: true,
  content: '{{isPremium ? "Premium Customer" : "Standard Customer"}}'
};

const input = {
  isPremium: true
};

// Result: "Premium Customer"
```

### Pattern 3: Data Transformation

```typescript
const schema = {
  type: 'text',
  name: 'formatted_date',
  readOnly: true,
  content: '{{new Date(dateString).toLocaleDateString()}}'
};

const input = {
  dateString: '2024-02-17'
};

// Result: "2/17/2024" (or localized format)
```

### Pattern 4: Designer Setup

```typescript
import Designer from '@pdfme/ui';

const designer = new Designer({
  domContainer: document.getElementById('designer'),
  template,
  options: {
    font: fontDefinitions,
    lang: 'en',  // Internationalization
    labels: {     // Custom labels
      'button.addField': 'Add New Field'
    }
  },
  plugins: {
    text, image, table, barcode, // Built-in
    email, phone  // Custom
  }
});

// Listen for template changes
designer.onChangeTemplate((newTemplate) => {
  console.log('Template updated:', newTemplate);
  // Save to database
});

// Save template
designer.onSaveTemplate((template) => {
  // Send to backend
  api.saveTemplate(template);
});
```

### Pattern 5: Form Setup

```typescript
import Form from '@pdfme/ui';

const form = new Form({
  domContainer: document.getElementById('form'),
  template,
  inputs: [{}],  // Start with empty input
  options: { font: fontDefinitions },
  plugins: builtInPlugins
});

// Collect user input
form.setInputs([{
  customerName: 'John Doe',
  email: 'john@example.com',
  logo: imageUrl
}]);

// Get filled data
const filledData = form.getInputs();
console.log(filledData);
```

### Pattern 6: Viewer Setup

```typescript
import Viewer from '@pdfme/ui';

const viewer = new Viewer({
  domContainer: document.getElementById('viewer'),
  template,
  inputs: [{
    customerName: 'Jane Smith',
    email: 'jane@example.com',
    logo: imageUrl
  }],
  options: { font: fontDefinitions },
  plugins: builtInPlugins
});

// User can navigate pages
viewer.goToPage(0);  // First page
```

### Pattern 7: Custom Theme

```typescript
const designer = new Designer({
  domContainer,
  template,
  options: {
    theme: {
      colorPrimary: '#1890ff',
      colorSuccess: '#52c41a',
      colorError: '#f5222d',
      borderRadius: 4
      // ... Ant Design theme token
    }
  }
});
```

### Pattern 8: Dynamic Templates with Height Calculation

```typescript
// Some field types (like table) have dynamic height
// The generator automatically calculates final height

const template = {
  basePdf: { width: 210, height: 297 },
  schemas: [[
    {
      type: 'text',
      name: 'title',
      position: { x: 10, y: 10 },
      width: 190,
      height: 10
    },
    {
      type: 'table',
      name: 'data',
      position: { x: 10, y: 25 },
      width: 190,
      height: 50  // May expand if data is longer
    },
    {
      type: 'text',
      name: 'footer',
      position: { x: 10, y: 80 },  // Will be repositioned if table grows
      width: 190,
      height: 10
    }
  ]]
};
```

### Pattern 9: Font Management

```typescript
// Define fonts
const fonts = {
  'Roboto': {
    data: robotoBuffer,  // ArrayBuffer or URL
    fallback: true        // Set one as fallback
  },
  'NotoSansJP': {
    data: notoBuffer,     // For CJK text
    subset: true          // Use font subsetting
  }
};

// Use in Designer/Form
const designer = new Designer({
  domContainer,
  template,
  options: { font: fonts }
});

// Use in Generator
const pdf = await generate({
  template,
  inputs,
  options: { font: fonts }
});
```

### Pattern 10: Event Handling

```typescript
const designer = new Designer({
  domContainer,
  template
});

// Template change (real-time)
designer.onChangeTemplate((newTemplate) => {
  console.log('User editing template');
});

// Save template
designer.onSaveTemplate((template) => {
  console.log('User clicked save');
  // Backend API call
});

// Page navigation
designer.onPageChange(({ currentPage, totalPages }) => {
  console.log(`Page ${currentPage} of ${totalPages}`);
  // Update UI
});

// Cleanup
designer.destroy();
```

---

## Cheat Sheet

### File Organization for New Plugin

```
my-plugin/
├── index.ts           // Export plugin
├── types.ts           // MyFieldSchema interface
├── pdfRender.ts       // PDF rendering logic
├── uiRender.ts        // UI rendering logic
├── propPanel.ts       // Property panel config
├── helper.ts          // Utility functions
├── constants.ts       // Default values
└── icons/             // SVG icons
```

### NPM Scripts

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Testing
npm run test
npm run test:ui:update-snapshots

# Linting
npm run lint
npm run prettier
```

### Package Structure

```
packages/
├── common/             # Types, interfaces, helpers
├── pdf-lib/            # PDF library
├── schemas/            # Built-in plugins
├── generator/          # PDF generation
├── ui/                 # React UI components
├── manipulator/        # PDF operations
├── converter/          # Format conversion
└── playground/         # Development testing
```

### Most Important Files

| File | Purpose |
|------|---------|
| `packages/common/src/types.ts` | Plugin, Props interfaces |
| `packages/generator/src/generate.ts` | PDF generation entry |
| `packages/ui/src/class.ts` | BaseUIClass |
| `packages/ui/src/Designer.tsx` | Designer wrapper |
| `packages/schemas/src/*/index.ts` | Plugin exports |

---

## Getting Help

### Common Issues & Solutions

**"Module not found"**
- Ensure packages are built: `npm run build`
- Check package.json dependencies
- Verify import paths

**"Type error"**
- Check `packages/common/src/types.ts` for correct interfaces
- Ensure schema extends Schema
- Verify plugin exports match Plugin<T>

**"Field not rendering"**
- Verify plugin is registered in plugins object
- Check schema.type matches plugin key
- Ensure plugin.ui and plugin.pdf are functions

**"Font not working"**
- Verify font file is valid (TTF/OTF)
- Check font is included in options.font
- For CJK: use @pdfme/pdf-lib version with support

### Debugging Tips

```typescript
// Log schema being rendered
console.log('Schema:', schema);

// Check plugin registry
console.log('Available plugins:', registry.entries());

// Inspect template
console.log('Template:', JSON.stringify(template, null, 2));

// Monitor input data
console.log('Input data:', inputs);

// Test plugin independently
await textPlugin.pdf(props);
await textPlugin.ui(props);
```
