# PDFme Complete Architecture Guide

## Table of Contents
1. [Complete Folder Structure](#complete-folder-structure)
2. [Core Concepts](#core-concepts)
3. [Plugin Architecture](#plugin-architecture)
4. [Logic Flow for Elements](#logic-flow-for-elements)
5. [Reusable Components](#reusable-components)
6. [End-to-End Flow](#end-to-end-flow)
7. [How Elements Are Built](#how-elements-are-built)

---

## Complete Folder Structure

```
pdfme/
├── packages/
│   ├── common/                      # Core types, utilities, and shared logic
│   │   └── src/
│   │       ├── types.ts            # Base type definitions (Plugin, UIRenderProps, PDFRenderProps)
│   │       ├── schema.ts           # Zod schema definitions for validation
│   │       ├── constants.ts        # Global constants and default values
│   │       ├── dynamicTemplate.ts  # Dynamic template engine for variable height
│   │       ├── expression.ts       # JavaScript expression evaluator for dynamic content
│   │       ├── helper.ts           # Utility functions
│   │       ├── pluginRegistry.ts   # Plugin registry management
│   │       └── index.ts            # Main exports
│   │
│   ├── pdf-lib/                    # Forked pdf-lib with custom modifications
│   │   └── src/
│   │       ├── core/              # PDF core operations
│   │       ├── api/               # High-level API
│   │       └── ... (pdf-lib internals)
│   │
│   ├── schemas/                    # Built-in field type plugins (text, image, table, etc.)
│   │   └── src/
│   │       ├── text/              # Text field plugin
│   │       │   ├── index.ts       # Plugin export
│   │       │   ├── types.ts       # TextSchema interface
│   │       │   ├── pdfRender.ts   # PDF rendering logic
│   │       │   ├── uiRender.ts    # Browser UI rendering
│   │       │   ├── propPanel.ts   # Designer property panel config
│   │       │   ├── helper.ts      # Helper functions
│   │       │   ├── constants.ts   # Field-specific constants
│   │       │   └── icons/         # SVG icons
│   │       │
│   │       ├── image/             # Image field plugin
│   │       ├── barcode/           # Barcode field plugins
│   │       ├── tables/            # Table field plugin
│   │       │   ├── index.ts
│   │       │   ├── types.ts
│   │       │   ├── pdfRender.ts
│   │       │   ├── uiRender.ts
│   │       │   ├── propPanel.ts
│   │       │   ├── classes.ts     # Table data structure classes
│   │       │   ├── dynamicTemplate.ts  # Dynamic height calculation
│   │       │   └── tableHelper.ts
│   │       │
│   │       ├── checkbox/          # Checkbox field plugin
│   │       ├── radioGroup/        # Radio group field plugin
│   │       ├── select/            # Select/dropdown field plugin
│   │       ├── date/              # Date field plugin
│   │       ├── shapes/            # Shape field plugins
│   │       ├── graphics/          # Graphics field plugins
│   │       ├── multiVariableText/ # Multi-variable text field plugin
│   │       ├── utils.ts           # Shared schema utilities
│   │       ├── constants.ts       # Shared constants
│   │       └── index.ts           # All plugins export
│   │
│   ├── generator/                 # PDF generation engine
│   │   └── src/
│   │       ├── generate.ts        # Main generation function
│   │       ├── helper.ts          # Helper functions for generation
│   │       ├── types.ts           # Generator-specific types
│   │       ├── constants.ts       # Generator constants
│   │       └── index.ts           # Main export
│   │
│   ├── ui/                        # React UI components (Designer, Form, Viewer)
│   │   └── src/
│   │       ├── class.ts           # BaseUIClass (abstract base)
│   │       ├── Designer.tsx       # Designer React component wrapper
│   │       ├── Form.tsx           # Form React component wrapper
│   │       ├── Viewer.tsx         # Viewer React component wrapper
│   │       ├── components/        # React components
│   │       │   ├── Designer/      # Designer components
│   │       │   │   ├── index.tsx              # Main Designer component
│   │       │   │   ├── LeftSidebar.tsx        # Left panel (schema list)
│   │       │   │   ├── RightSidebar/         # Right panel (properties)
│   │       │   │   │   ├── DetailView/       # Editable schema properties
│   │       │   │   │   └── ListView/         # Schema list view
│   │       │   │   ├── Canvas/               # Drawing canvas
│   │       │   │   │   ├── index.tsx         # Canvas container
│   │       │   │   │   ├── Moveable.tsx      # Move/resize functionality
│   │       │   │   │   ├── Selecto.tsx       # Multi-selection
│   │       │   │   │   ├── Guides.tsx        # Grid guides
│   │       │   │   │   ├── Mask.tsx          # Canvas mask
│   │       │   │   │   └── Padding.tsx       # Padding display
│   │       │   │   └── PluginIcon.tsx
│   │       │   ├── Form/         # Form components
│   │       │   ├── Viewer/       # Viewer components
│   │       │   ├── AppContextProvider.tsx  # Global context provider
│   │       │   └── CtlBar.tsx             # Control bar
│   │       │
│   │       ├── hooks.ts           # Custom React hooks
│   │       ├── helper.ts          # Helper functions
│   │       ├── contexts.ts        # React contexts
│   │       ├── i18n.ts            # Internationalization strings
│   │       ├── theme.ts           # Theme configuration
│   │       ├── constants.ts       # UI constants
│   │       ├── types.ts           # UI-specific types
│   │       └── index.ts           # Main export
│   │
│   ├── manipulator/               # PDF manipulation (merge, split, rotate)
│   │   └── src/
│   │       ├── ... (manipulation functions)
│   │
│   ├── converter/                 # Format conversion utilities
│   │   └── src/
│   │       ├── ... (conversion functions)
│   │
│   └── package.json              # Each package has its own package.json
│
├── playground/                    # Interactive development environment
│   ├── src/
│   │   ├── main.tsx              # Entry point
│   │   ├── App.tsx               # Main app component
│   │   └── ...
│   ├── public/
│   │   └── template-assets/      # Template examples
│   └── package.json
│
├── website/                       # Documentation site (Docusaurus)
│   └── ...
│
├── package.json                  # Root monorepo package.json
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
├── CLAUDE.md                      # This file (project instructions)
└── ...
```

---

## Core Concepts

### 1. **Template Structure**
A template defines what a PDF looks like and what fields it contains:

```typescript
interface Template {
  basePdf: BasePdf;        // Base PDF structure (blank or custom)
  schemas: Schema[][];     // 2D array: first level = pages, second level = fields
  staticSchema?: Schema[]; // Fields that appear on every page
  pdfmeVersion: string;    // Version tracking
}

// BasePdf can be:
// - BlankPdf: Dimensions only { width, height, padding }
// - CustomPdf: Actual PDF file { pdf (URL or buffer) }
```

### 2. **Schema (Field Definition)**
Each field in a PDF has a schema that defines its properties:

```typescript
interface Schema {
  // Base properties (required for all fields)
  id: string;              // Unique identifier
  type: string;            // Field type (text, image, table, etc.)
  name: string;            // Field name for binding data
  position: { x, y };      // Position in mm
  width: number;           // Width in mm
  height: number;          // Height in mm

  // Optional properties
  content?: string;        // Static content for non-data fields
  readOnly?: boolean;      // Cannot be changed in form
  rotate?: number;         // Rotation in degrees
  opacity?: number;        // Opacity 0-1

  // Type-specific properties (defined in individual plugins)
  // For TextSchema: fontSize, fontColor, alignment, etc.
  // For ImageSchema: fit, preserveAspectRatio, etc.
}
```

### 3. **Plugin System**
Each field type is implemented as a plugin with three parts:

```typescript
type Plugin<T extends Schema> = {
  // 1. PDF Rendering: Creates visual output for PDF
  pdf: (args: PDFRenderProps<T>) => Promise<void>;

  // 2. UI Rendering: Creates interactive HTML element
  ui: (args: UIRenderProps<T>) => Promise<void>;

  // 3. Property Panel: Configuration interface in Designer
  propPanel: PropPanel<T>;

  // Optional
  icon?: string;                    // SVG icon for UI
  uninterruptedEditMode?: boolean;  // Prevent re-render during edit
}
```

---

## Plugin Architecture

### How Plugins Work

```
┌─────────────────────────────────────────────────────────────┐
│                      Plugin Registry                         │
│  Map<type: string, Plugin>                                  │
│  { text, image, table, barcode, ... }                       │
└─────────────────────────────────────────────────────────────┘
        ↓
        │ Each Plugin has THREE independent functions:
        │
        ├─────────────────────────────────────────────────────┐
        │                                                     │
        ↓                                                     ↓
   ┌─────────────┐                            ┌─────────────┐
   │ PDF Render  │                            │ UI Render   │
   │             │                            │             │
   │ Input:      │                            │ Input:      │
   │ - value     │                            │ - value     │
   │ - schema    │                            │ - schema    │
   │ - pdfDoc    │                            │ - mode      │
   │ - pdfPage   │                            │ - element   │
   │             │                            │             │
   │ Output:     │                            │ Output:     │
   │ Pixels on   │                            │ HTML DOM    │
   │ PDF page    │                            │ elements    │
   └─────────────┘                            └─────────────┘

        ├─────────────────────────────────────────────────────┐
        │                                                     │
        ↓                                                     ↓
   ┌─────────────────────┐
   │ Property Panel      │
   │                     │
   │ Used in Designer    │
   │ to configure        │
   │ field properties    │
   └─────────────────────┘
```

### Example: Text Plugin Structure

```
packages/schemas/src/text/
├── index.ts
│   ├── Imports pdfRender, uiRender, propPanel
│   └── Exports { pdf: pdfRender, ui: uiRender, propPanel, icon }
│
├── types.ts
│   └── interface TextSchema extends Schema {
│       fontName, fontSize, alignment, fontColor, ...
│     }
│
├── pdfRender.ts
│   ├── embedAndGetFontObj() - Load and cache fonts
│   ├── getFontProp() - Calculate font properties
│   └── export const pdfRender = async (args) => {
│       // Calculate positions
│       // Embed fonts in PDF
│       // Split text into lines
│       // Draw each line on PDF page with styling
│     }
│
├── uiRender.ts
│   ├── replaceUnsupportedChars() - Handle missing glyphs
│   ├── buildStyledTextContainer() - Create CSS styles
│   └── export const uiRender = async (args) => {
│       // Create HTML input element
│       // Apply CSS styling
│       // Handle focus/blur events
│       // Sync changes back to parent
│     }
│
├── propPanel.ts
│   └── export const propPanel = {
│       schema: { // Form-render schema
│         fontName: { type: 'string', widget: 'select' },
│         fontSize: { type: 'number', widget: 'inputNumber' },
│         alignment: { type: 'string', widget: 'select' },
│         ...
│       },
│       defaultSchema: { // Defaults when creating field
│         fontSize: 12,
│         alignment: 'left',
│         ...
│       }
│     }
│
└── helper.ts, constants.ts, icons/
```

### Built-in Plugins

```
Text Plugin
├── Supports: Multi-line, dynamic font sizing, alignment
├── PDF: Uses pdf-lib to draw text with fonts
└── UI: HTML contenteditable div with CSS styling

Image Plugin
├── Supports: Fit modes (contain, cover, stretch)
├── PDF: Embeds images in PDF
└── UI: Image preview with drag-drop

Table Plugin
├── Supports: Dynamic height, cell formatting, borders
├── PDF: Draws table with cells and content
└── UI: Editable table with cell selection

Barcode Plugin
├── Supports: QR codes, Code128, etc.
├── PDF: Renders barcode image
└── UI: Barcode preview

Checkbox Plugin
├── Supports: Checked/unchecked states
├── PDF: Draws checkbox symbol
└── UI: HTML checkbox input

Select/Radio Plugin
├── Supports: Dropdown and radio button selection
├── PDF: Draws selected value or symbol
└── UI: HTML select or radio inputs

Date Plugin
├── Supports: Date formatting
├── PDF: Draws formatted date string
└── UI: Date picker input

Shapes/Graphics Plugin
├── Supports: Rectangles, circles, lines
├── PDF: Draws shapes
└── UI: Shape preview
```

---

## Logic Flow for Elements

### A. Element Lifecycle in the Generator

```
Input Data
    ↓
Template + Input
    ↓
    ├─ Preprocessing
    │  ├─ Create PDF document
    │  ├─ Prepare base pages
    │  └─ Build renderObj (map of type → pdf function)
    │
    ↓
    ├─ For each input item:
    │  │
    │  ├─ getDynamicTemplate()
    │  │  ├─ Replace placeholders in content
    │  │  ├─ Evaluate expressions
    │  │  └─ Calculate dynamic heights (for tables)
    │  │
    │  ├─ For each page:
    │  │  │
    │  │  ├─ insertPage()
    │  │  │  ├─ Add base page (blank or embed custom)
    │  │  │  └─ Create new page object
    │  │  │
    │  │  ├─ For each schema on page:
    │  │  │  │
    │  │  │  ├─ Get the render function from renderObj
    │  │  │  ├─ Prepare PDFRenderProps:
    │  │  │  │  ├─ value: actual data for this field
    │  │  │  │  ├─ schema: field configuration
    │  │  │  │  ├─ pdfDoc: PDF document
    │  │  │  │  ├─ page: current page
    │  │  │  │  ├─ options: generation options
    │  │  │  │  └─ _cache: shared cache
    │  │  │  │
    │  │  │  └─ render(props)  ← Call plugin's pdf function
    │  │  │     ├─ Calculate position and size
    │  │  │     ├─ Process value (e.g., embed fonts, resize image)
    │  │  │     ├─ Handle styling (colors, rotation, opacity)
    │  │  │     └─ Draw on PDF page
    │  │  │
    │  │  └─ Process static schemas (appear on every page)
    │  │
    │  └─ Add this document to output
    │
    ├─ postProcessing()
    │  ├─ Set metadata
    │  ├─ Compress if needed
    │  └─ Final PDF adjustments
    │
    ↓
Output: Uint8Array (PDF binary)
```

### B. Element Lifecycle in the Designer

```
Designer UI
    ↓
    ├─ DesignerComponent (React)
    │  │
    │  ├─ Canvas
    │  │  ├─ Preview of current page
    │  │  ├─ Render all schemas on page using ui() functions
    │  │  ├─ Enable interaction (move, resize, edit)
    │  │  └─ Show guides and selection
    │  │
    │  ├─ LeftSidebar
    │  │  ├─ List all schemas on current page
    │  │  ├─ Click to select
    │  │  ├─ Drag to reorder
    │  │  └─ Delete button
    │  │
    │  └─ RightSidebar
    │     ├─ DetailView: Editable properties
    │     │  ├─ Use propPanel.schema to render form
    │     │  ├─ form-render library renders UI
    │     │  ├─ On change: update schema object
    │     │  └─ Trigger Canvas re-render
    │     │
    │     └─ ListView: Position/size controls
    │        └─ Numeric inputs for x, y, width, height
    │
    ↓
User makes change (e.g., select text field)
    ↓
    ├─ Event bubbles to DesignerComponent
    ├─ Update schema state
    ├─ Trigger re-render
    └─ Canvas shows updated field instantly
```

### C. Element Rendering in UI (Viewer/Form)

```
Template + Input Data
    ↓
    ├─ Viewer/Form Component
    │  │
    │  ├─ For each page in template:
    │  │  │
    │  │  ├─ Create a page container (HTML div)
    │  │  │
    │  │  └─ For each schema on page:
    │  │     │
    │  │     ├─ Get plugin by type
    │  │     ├─ Create container element
    │  │     ├─ Prepare UIRenderProps:
    │  │     │  ├─ value: data value for this field
    │  │     │  ├─ schema: field configuration
    │  │     │  ├─ mode: 'viewer', 'form', or 'designer'
    │  │     │  ├─ rootElement: DOM container
    │  │     │  ├─ options: UI options (fonts, colors, etc.)
    │  │     │  ├─ theme: Ant Design theme
    │  │     │  ├─ i18n: translation function
    │  │     │  ├─ scale: scaling factor (for different screen sizes)
    │  │     │  └─ _cache: cache for expensive operations
    │  │     │
    │  │     └─ plugin.ui(props)  ← Call ui function
    │  │        ├─ Generate HTML element(s)
    │  │        ├─ Apply CSS styling
    │  │        ├─ If mode='form': add onChange listener
    │  │        ├─ If mode='viewer': read-only display
    │  │        ├─ If mode='designer': full editing
    │  │        └─ Append to rootElement
    │  │
    │  └─ Return rendered page
    │
    ↓
User interacts with field (in form or designer mode)
    ↓
    ├─ onChange called with new value
    ├─ Component state updated
    ├─ Parent component notified
    └─ Field re-rendered with new value
```

---

## Reusable Components

### 1. **BaseUIClass** (packages/ui/src/class.ts)

The foundation for all UI components:

```typescript
abstract class BaseUIClass {
  protected domContainer: HTMLElement;
  protected template: Template;
  protected size: Size;
  private lang: Lang;
  private font: Font;
  private pluginsRegistry: PluginRegistry;
  private options: UIOptions;

  // Methods all UI components inherit:

  getTemplate()              // Get current template
  updateTemplate(template)   // Change template
  updateOptions(options)     // Change theme, lang, fonts
  destroy()                  // Clean up
  protected abstract render() // Implemented by subclasses
}

// Subclasses:
class Designer extends BaseUIClass { /* Template editing */ }
class Form extends BaseUIClass { /* Data filling */ }
class Viewer extends BaseUIClass { /* Read-only display */ }
```

### 2. **Plugin Registry** (packages/common/src/pluginRegistry.ts)

Manages all available plugins:

```typescript
interface PluginRegistry {
  plugins: Map<type, Plugin>

  exists()                          // Check if any plugins
  values()                          // Get all plugins
  entries()                         // Get [type, plugin] pairs
  findByType(type)                  // Get plugin for type
  findWithLabelByType(type)         // Get label and plugin
}

// Usage:
const registry = pluginRegistry({
  text: textPlugin,
  image: imagePlugin,
  table: tablePlugin,
  ...builtInPlugins
});

const textPlugin = registry.findByType('text');
await textPlugin.pdf(pdfRenderProps);  // PDF rendering
await textPlugin.ui(uiRenderProps);    // UI rendering
```

### 3. **Helper Functions** (packages/common/src/helper.ts)

Shared utilities:

```typescript
// Unit conversion
mm2pt(mm)                 // Millimeters to points
pt2mm(pt)                 // Points to millimeters

// Value processing
replacePlaceholders(content, variables, schemas)
                         // Replace {{variable}} in content
evaluateExpression(expr) // Evaluate JavaScript expressions

// Deep copying
cloneDeep(obj)           // Safe deep clone

// Data formatting
convertToStringObjectArray(data)  // Stringify values for UI
```

### 4. **Dynamic Template Engine** (packages/common/src/dynamicTemplate.ts)

Handles variable-height fields:

```typescript
async function getDynamicTemplate(args: {
  template: Template
  input: InputData
  options: GeneratorOptions
  _cache: Map
  getDynamicHeights: (value, args) => Promise<number[]>
}) {
  // Returns adjusted template with:
  // - Placeholders replaced
  // - Expressions evaluated
  // - Dynamic heights calculated
  // - Schemas positioned correctly
}

// Example: Table with 10 rows needs 50mm, but you only allocated 30mm
// getDynamicHeights() recalculates to 50mm
// Next schemas below table are repositioned accordingly
```

### 5. **Expression Evaluator** (packages/common/src/expression.ts)

Safely evaluates JavaScript in content:

```typescript
// Content can have expressions:
// "Hello {{name}}" → simple placeholder
// "Total: {{items.reduce((a,b) => a+b.price, 0)}}" → expression

// Evaluator:
// 1. Parse with Acorn (JavaScript parser)
// 2. Validate AST (prevent dangerous operations)
// 3. Evaluate in sandboxed context
// 4. Return result

// Safe: Can access variables, do math, string operations
// Blocked: Cannot access window, document, eval, etc.
```

### 6. **AppContextProvider** (packages/ui/src/components/AppContextProvider.tsx)

React context providing global data:

```typescript
<AppContextProvider
  lang={lang}                    // Internationalization
  font={font}                    // Font definitions
  plugins={pluginRegistry}       // Available plugins
  options={uiOptions}            // Theme, colors, etc.
>
  {children}
</AppContextProvider>

// All children access via useContext(AppContext)
// Prevents prop drilling
```

### 7. **Form-Render Integration** (propPanel)

Uses `form-render` library for property panels:

```typescript
// propPanel defines:
propPanel: {
  schema: {
    fontSize: {
      type: 'number',
      widget: 'inputNumber',
      props: { min: 1, max: 100 },
      span: 6  // Width in grid
    },
    alignment: {
      type: 'string',
      widget: 'select',
      props: {
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
        ]
      }
    },
    // ... more fields
  },
  defaultSchema: {
    fontSize: 12,
    alignment: 'left',
    // ...
  }
}

// form-render library converts this schema into:
// HTML form with inputs, validation, layout
```

---

## End-to-End Flow

### Complete Flow: From Template to PDF

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER CREATES TEMPLATE IN DESIGNER                               │
├─────────────────────────────────────────────────────────────────────┤

User opens Designer
    ↓
  Choose basePdf (blank 210x297mm)
    ↓
  Add text field
    ├─ plugin.propPanel renders form (via form-render)
    ├─ User enters: fontSize=14, alignment=left, fontColor=#000000
    └─ propPanel.defaultSchema merged with user values

    ↓
  Drag field on canvas to position x=10mm, y=20mm
    ├─ Uses plugin.ui() to show field on canvas
    ├─ plugin.ui() creates HTML element
    ├─ Moveable.tsx handles drag-to-move
    └─ Position updated in schema

    ↓
  Add more fields (image, table, etc.)
    └─ Each uses respective plugin

    ↓
  Save template
    └─ Template object saved (JSON serializable)

    Template = {
      basePdf: { width: 210, height: 297 },
      schemas: [[
        {
          id: 'field-1',
          type: 'text',
          name: 'name',
          position: { x: 10, y: 20 },
          width: 100, height: 10,
          fontSize: 14,
          alignment: 'left',
          fontColor: '#000000'
        },
        {
          id: 'field-2',
          type: 'image',
          name: 'logo',
          position: { x: 10, y: 35 },
          width: 30, height: 20,
          fit: 'contain'
        },
        // ... more fields
      ]]
    }

┌─────────────────────────────────────────────────────────────────────┐
│ 2. USER FILLS DATA IN FORM OR GENERATES PDF                         │
├─────────────────────────────────────────────────────────────────────┤

Input Data:
{
  name: "John Doe",
  logo: "data:image/png;base64,..."
}

// Option A: Show Form
Form component
  ↓
  For each schema in template:
    ├─ Get plugin by type
    ├─ Call plugin.ui() with mode='form'
    ├─ plugin.ui() creates editable HTML element
    ├─ User fills in value
    └─ onChange updates state
  ↓
  User clicks "Submit"
    └─ Triggers generation with filled data

// Option B: Generate PDF directly
generate({
  template: templateObject,
  inputs: [
    { name: "John Doe", logo: "..." },
    { name: "Jane Smith", logo: "..." }
  ],
  options: { ... },
  plugins: builtInPlugins
})

┌─────────────────────────────────────────────────────────────────────┐
│ 3. GENERATOR PROCESSES EACH INPUT                                   │
├─────────────────────────────────────────────────────────────────────┤

For each input:

  Step 1: getDynamicTemplate()
    ├─ Replace {{placeholders}} with actual values
    ├─ Evaluate {{expressions}} using evaluator
    ├─ For table fields: calculate actual heights
    └─ Adjust positions of dependent fields

  Step 2: insertPage()
    ├─ Create new PDF page
    ├─ If blank PDF: just set dimensions
    ├─ If custom PDF: embed existing PDF page
    └─ Page ready for drawing

  Step 3: For each schema on page:
    ├─ Determine actual value
    │  ├─ If readOnly: use field.content (template default)
    │  └─ If not readOnly: use input[field.name]
    │
    ├─ Call plugin.pdf(PDFRenderProps)
    │  └─ PDFRenderProps = {
    │      value: "John Doe",
    │      schema: { ... },
    │      pdfDoc: PDFDocument,
    │      page: PDFPage,
    │      pdfLib: pdf-lib,
    │      options: { fonts, colorType },
    │      _cache: Map  // for caching fonts, images, etc.
    │    }
    │
    └─ plugin.pdf() does type-specific rendering:

       Text Plugin:
         ├─ Embed font in PDF
         ├─ Calculate line wrapping
         ├─ Apply font size, color, alignment
         └─ page.drawText(...)

       Image Plugin:
         ├─ Load image from URL/buffer
         ├─ Calculate fit (contain/cover/stretch)
         ├─ Embed in PDF
         └─ page.drawImage(...)

       Table Plugin:
         ├─ Parse table data
         ├─ Draw table grid
         ├─ Draw cell text/images
         └─ Handle borders, colors

       Barcode Plugin:
         ├─ Generate barcode image
         └─ Draw as image

  Step 4: postProcessing()
    ├─ Set PDF metadata
    ├─ Compress if needed
    └─ Ready for output

┌─────────────────────────────────────────────────────────────────────┐
│ 4. OUTPUT: PDF BYTES                                                │
├─────────────────────────────────────────────────────────────────────┤

Each input generates one PDF:
  Input 1: John Doe → PDF bytes (1 page)
  Input 2: Jane Smith → PDF bytes (1 page)
  ...

Or merged into single file (with manipulator package)
```

---

## How Elements Are Built

### Building a New Field Type (Complete Example)

Let's build an "Email" field plugin:

#### Step 1: Create Type Definition (types.ts)

```typescript
import type { Schema } from '@pdfme/common';

export interface EmailSchema extends Schema {
  fontSize: number;
  fontColor: string;
  alignment: 'left' | 'center' | 'right';
  fontName?: string;
}
```

#### Step 2: Build PDF Renderer (pdfRender.ts)

```typescript
import type { PDFRenderProps } from '@pdfme/common';
import type { EmailSchema } from './types';

// Validate email format
function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const pdfRender = async (arg: PDFRenderProps<EmailSchema>) => {
  const { value, schema, page, pdfDoc, pdfLib, options, _cache } = arg;

  if (!value || !validateEmail(value)) return;

  // Get fonts
  const font = options.font || getDefaultFont();
  const fontObj = await embedFonts(pdfDoc, font, _cache);

  // Get font metrics
  const fontSize = schema.fontSize || 12;
  const color = hex2PrintingColor(schema.fontColor || '#000000');

  // Calculate position (with rotation support)
  const pageHeight = page.getHeight();
  const { x, y, width, height } = convertForPdfLayoutProps({
    schema,
    pageHeight
  });

  // Draw background if needed
  if (schema.backgroundColor) {
    page.drawRectangle({
      x, y, width, height,
      color: hex2PrintingColor(schema.backgroundColor)
    });
  }

  // Draw email text
  page.drawText(value, {
    x,
    y: pageHeight - y,
    size: fontSize,
    font: fontObj,
    color,
    // Add email-specific styling if needed
  });

  // Optional: Add underline to indicate it's an email
  page.drawLine({
    start: { x, y: pageHeight - y - 2 },
    end: { x: x + width, y: pageHeight - y - 2 },
    thickness: 0.5,
    color: color
  });
};
```

#### Step 3: Build UI Renderer (uiRender.ts)

```typescript
import type { UIRenderProps } from '@pdfme/common';
import type { EmailSchema } from './types';

export const uiRender = async (arg: UIRenderProps<EmailSchema>) => {
  const { value, schema, rootElement, mode, onChange } = arg;

  // Create container
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    width: ${schema.width}mm;
    height: ${schema.height}mm;
    left: ${schema.position.x}mm;
    top: ${schema.position.y}mm;
  `;

  // Apply styling
  container.style.fontSize = `${schema.fontSize}px`;
  container.style.color = schema.fontColor || '#000000';
  container.style.textAlign = schema.alignment || 'left';

  if (mode === 'viewer') {
    // Read-only display
    const link = document.createElement('a');
    link.href = `mailto:${value}`;
    link.textContent = value;
    link.style.color = 'blue';
    link.style.textDecoration = 'underline';
    container.appendChild(link);
  } else if (mode === 'form' || mode === 'designer') {
    // Editable input
    const input = document.createElement('input');
    input.type = 'email';
    input.value = value;
    input.placeholder = 'Enter email address';
    input.style.width = '100%';
    input.style.height = '100%';

    input.addEventListener('blur', () => {
      if (onChange) {
        onChange({ key: 'email', value: input.value });
      }
    });

    container.appendChild(input);
  }

  rootElement.appendChild(container);
};
```

#### Step 4: Create Property Panel (propPanel.ts)

```typescript
import type { PropPanel } from '@pdfme/common';
import type { EmailSchema } from './types';

export const propPanel: PropPanel<EmailSchema> = {
  // Define form fields for Designer property panel
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
      title: 'Font Color',
      span: 12
    }
  },

  // Default values when creating new email field
  defaultSchema: {
    fontSize: 12,
    fontColor: '#000000',
    alignment: 'left',
    width: 100,
    height: 10,
    position: { x: 0, y: 0 }
  }
};
```

#### Step 5: Export Plugin (index.ts)

```typescript
import type { Plugin } from '@pdfme/common';
import { pdfRender } from './pdfRender';
import { uiRender } from './uiRender';
import { propPanel } from './propPanel';
import type { EmailSchema } from './types';
import { createSvgStr } from '../utils';
import { Mail } from 'lucide'; // Icon

const emailSchema: Plugin<EmailSchema> = {
  pdf: pdfRender,
  ui: uiRender,
  propPanel,
  icon: createSvgStr(Mail),
  uninterruptedEditMode: true // Don't re-render while typing
};

export default emailSchema;
```

#### Step 6: Register Plugin (packages/schemas/src/index.ts)

```typescript
import emailSchema from './email/index';

export const builtInPlugins = {
  text: textSchema,
  image: imageSchema,
  table: tableSchema,
  email: emailSchema,  // Add new plugin
  barcode: barcodeSchema,
  checkbox: checkboxSchema,
  // ... others
};
```

#### Step 7: Use in Template

```typescript
const template = {
  basePdf: { width: 210, height: 297 },
  schemas: [[
    {
      id: 'email-1',
      type: 'email',          // Use new plugin type
      name: 'email',          // Field name for data binding
      position: { x: 10, y: 20 },
      width: 100,
      height: 10,
      fontSize: 12,
      fontColor: '#000000',
      alignment: 'left'
    }
  ]]
};

// Generate PDF
const pdf = await generate({
  template,
  inputs: [{ email: 'john@example.com' }],
  plugins: { ...builtInPlugins } // Includes email plugin
});
```

---

## Component Hierarchy Diagram

```
Application Layer
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Designer.tsx / Form.tsx / Viewer.tsx (React components)  │
│  (Extends BaseUIClass)                                     │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  UI Component Layer (React Components)                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AppContextProvider                                  │   │
│  │ ├─ DesignerComponent                               │   │
│  │ │  ├─ Canvas                                        │   │
│  │ │  │  ├─ SchemaField (renders plugin.ui)            │   │
│  │ │  │  ├─ Moveable (drag/resize)                     │   │
│  │ │  │  ├─ Selecto (multi-select)                     │   │
│  │ │  │  └─ Guides                                     │   │
│  │ │  ├─ LeftSidebar                                   │   │
│  │ │  ├─ RightSidebar                                  │   │
│  │ │  │  ├─ DetailView (form via form-render)         │   │
│  │ │  │  └─ ListView                                   │   │
│  │ │  └─ CtlBar (controls)                             │   │
│  │ ├─ FormComponent                                    │   │
│  │ │  ├─ SchemaField (renders plugin.ui in form mode)  │   │
│  │ │  └─ Submit button                                 │   │
│  │ └─ ViewerComponent                                  │   │
│  │    └─ SchemaField (renders plugin.ui in viewer mode)│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Plugin Layer                                               │
│                                                             │
│  For each field type: { pdf, ui, propPanel }              │
│                                                             │
│  ├─ Text Plugin         (pdfRender, uiRender, propPanel)  │
│  ├─ Image Plugin        (pdfRender, uiRender, propPanel)  │
│  ├─ Table Plugin        (pdfRender, uiRender, propPanel)  │
│  ├─ Barcode Plugin      (pdfRender, uiRender, propPanel)  │
│  ├─ Email Plugin        (pdfRender, uiRender, propPanel)  │
│  ├─ Checkbox Plugin     (pdfRender, uiRender, propPanel)  │
│  ├─ Select Plugin       (pdfRender, uiRender, propPanel)  │
│  ├─ Date Plugin         (pdfRender, uiRender, propPanel)  │
│  ├─ Shapes Plugin       (pdfRender, uiRender, propPanel)  │
│  └─ Graphics Plugin     (pdfRender, uiRender, propPanel)  │
│                                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Core Libraries Layer                                       │
│                                                             │
│  ├─ pdf-lib (PDF creation & manipulation)                 │
│  ├─ form-render (Property panel form generation)           │
│  ├─ Moveable (DOM manipulation)                            │
│  ├─ Selecto (Multi-selection library)                      │
│  ├─ Ant Design (UI components)                             │
│  ├─ React (UI framework)                                   │
│  ├─ TypeScript (Type safety)                               │
│  └─ Zod (Schema validation)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### A. PDF Generation Flow

```
                    ┌─────────────────┐
                    │  Input Data     │
                    │ {               │
                    │  name: "John",  │
                    │  logo: "..."    │
                    │ }               │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Template       │
                    │ {               │
                    │  schemas: [..], │
                    │  basePdf: {...} │
                    │ }               │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────────┐
                    │ generate() function         │
                    │ (generator package)         │
                    └────────┬────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼──────┐   ┌───────▼────────┐  ┌────▼─────┐
    │Preprocess  │   │Dynamic Temp    │  │Get Plugins│
    │- Create PDF│   │- Replace vars  │  │- Registry │
    │  doc       │   │- Eval expr     │  │           │
    │            │   │- Dynamic height│  │           │
    └─────┬──────┘   └───────┬────────┘  └────┬─────┘
          │                  │                 │
          └──────────────────┼─────────────────┘
                             │
                    ┌────────▼────────┐
                    │For each page:   │
                    │- insertPage()   │
                    │                 │
                    │For each schema: │
                    │- Get plugin.pdf │
                    │- Call pdf()     │
                    │                 │
                    │pdf() draws on   │
                    │PDF page         │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │postProcessing() │
                    │- Set metadata   │
                    │- Compress       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │Output: PDF      │
                    │Uint8Array       │
                    └─────────────────┘
```

### B. Designer Interaction Flow

```
        User Action
        (click, drag, type)
             │
             ├─────────────────────────────────┐
             │                                 │
    ┌────────▼──────────┐          ┌──────────▼──────────┐
    │Select Field       │          │Move/Resize         │
    │                   │          │                     │
    │LeftSidebar onClick│          │Canvas drag/resize   │
    │      │            │          │      │              │
    │      ▼            │          │      ▼              │
    │  Set selected ID  │          │ Update position/size│
    │      │            │          │ in schema           │
    │      ▼            │          │      │              │
    │ Trigger re-render │          │      ▼              │
    │      │            │          │ Trigger re-render   │
    └────────┬──────────┘          └──────────┬──────────┘
             │                                 │
             └────────────────────┬────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │ Canvas renders:   │
                        │                   │
                        │For each schema:   │
                        │- Get plugin.ui    │
                        │- Call ui()        │
                        │- Show on canvas   │
                        │                   │
                        │Instant preview    │
                        └───────────────────┘
```

### C. Plugin Registry Access

```
                    ┌──────────────────────┐
                    │  Plugin Registry     │
                    │                      │
                    │ Map<type, Plugin>    │
                    │ {                    │
                    │  text: {...},        │
                    │  image: {...},       │
                    │  table: {...},       │
                    │  ...                 │
                    │ }                    │
                    └───────────┬──────────┘
                                │
                    ┌───────────▼──────────┐
                    │ findByType(type)     │
                    │      │               │
                    │      ▼               │
                    │ Plugin object        │
                    │ {                    │
                    │  pdf: fn             │
                    │  ui: fn              │
                    │  propPanel: {...}    │
                    │  icon: svg           │
                    │ }                    │
                    └───────────┬──────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼────────┐ ┌───▼────────────┐ ┌─▼─────────────┐
        │ PDF Render     │ │ UI Render      │ │ Prop Panel    │
        │                │ │                │ │               │
        │ Called by      │ │ Called by      │ │ Called by     │
        │ generator      │ │ Designer/Form  │ │ Designer      │
        │                │ │                │ │               │
        │ Inputs:        │ │ Inputs:        │ │ Inputs:       │
        │ - value        │ │ - value        │ │ - schema      │
        │ - schema       │ │ - schema       │ │ - options     │
        │ - pdfDoc       │ │ - rootElement  │ │               │
        │ - page         │ │ - mode         │ │ Outputs:      │
        │                │ │ - onChange     │ │ Form fields   │
        │ Outputs:       │ │                │ │ for editing   │
        │ Pixels in PDF  │ │ Outputs:       │ │               │
        │                │ │ HTML in DOM    │ │               │
        └────────────────┘ │                │ └───────────────┘
                           │                │
                           └────────────────┘
```

---

## Key Files Reference

### Common Package
- **types.ts**: Plugin, PDFRenderProps, UIRenderProps, PropPanel interfaces
- **schema.ts**: Zod schema definitions for validation
- **pluginRegistry.ts**: Plugin registry implementation
- **dynamicTemplate.ts**: Dynamic template calculation engine
- **expression.ts**: JavaScript expression evaluator
- **helper.ts**: Unit conversion, deep clone, placeholder replacement

### Generator Package
- **generate.ts**: Main PDF generation function
- **helper.ts**: Preprocessing, page insertion, postprocessing

### UI Package
- **class.ts**: BaseUIClass, PreviewUI abstract classes
- **Designer.tsx**: Designer component wrapper
- **Form.tsx**: Form component wrapper
- **Viewer.tsx**: Viewer component wrapper
- **components/Designer/index.tsx**: Main Designer React component
- **components/Designer/Canvas/**: Canvas rendering components
- **components/Designer/RightSidebar/DetailView/**: Property panel

### Schemas Package
Each field type has:
- **index.ts**: Plugin export
- **types.ts**: Schema interface
- **pdfRender.ts**: PDF rendering logic
- **uiRender.ts**: UI rendering logic
- **propPanel.ts**: Property panel configuration
- **helper.ts**: Helper functions
- **constants.ts**: Field-specific constants

---

## Summary

### Reusable Components
1. **BaseUIClass**: Foundation for Designer, Form, Viewer
2. **Plugin System**: All field types are plugins with pdf/ui/propPanel
3. **PluginRegistry**: Manages and retrieves plugins
4. **Form-render Integration**: Generates property panels from schemas
5. **AppContextProvider**: Global context for lang, fonts, plugins, options
6. **Helper Functions**: Unit conversion, placeholder replacement, deep clone

### Component Handling
- Each field type is a **Plugin** with three independent functions
- **PDF rendering**: Uses pdf-lib to draw on PDF pages
- **UI rendering**: Creates HTML DOM elements for interaction
- **Property panel**: Uses form-render to generate configuration forms
- All components receive standardized Props (PDFRenderProps, UIRenderProps)

### Logic Flow
1. **Designer**: User creates/edits template visually → propPanel + plugin.ui
2. **Generator**: Takes template + data → plugin.pdf generates PDFs
3. **Form**: Shows editable fields to user → plugin.ui in form mode
4. **Viewer**: Shows read-only fields → plugin.ui in viewer mode

### Building New Elements
1. Define **Schema type** extending base Schema
2. Implement **pdfRender()** for PDF output
3. Implement **uiRender()** for HTML UI
4. Define **propPanel** for configuration
5. Export as **Plugin**
6. Register in **PluginRegistry**
7. Use in templates with type name

All communication through standardized Props objects enables loose coupling and plugin extensibility!
