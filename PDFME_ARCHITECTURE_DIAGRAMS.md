# PDFme Architecture - Visual Diagrams & Flowcharts

## Table of Contents
1. [Plugin System Architecture](#plugin-system-architecture)
2. [Data Model Structure](#data-model-structure)
3. [Rendering Pipeline](#rendering-pipeline)
4. [Component Architecture](#component-architecture)
5. [State Management Flow](#state-management-flow)
6. [Package Dependencies](#package-dependencies)

---

## Plugin System Architecture

### The Three Pillar Plugin Model

```
                    ┌──────────────────────────────┐
                    │      Plugin<T extends Schema>│
                    │                              │
                    │  Three independent functions │
                    └──────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
       ┌────────▼────────┐ ┌────▼─────────┐ ┌───▼──────────┐
       │   PDF Render    │ │  UI Render   │ │ PropPanel    │
       ├─────────────────┤ ├──────────────┤ ├──────────────┤
       │                 │ │              │ │              │
       │ Input:          │ │ Input:       │ │ Input:       │
       │ - value: string │ │ - value      │ │ - schema obj │
       │ - schema: Obj   │ │ - schema     │ │ - options    │
       │ - pdfDoc        │ │ - mode       │ │ - theme      │
       │ - pdfPage       │ │ - element    │ │              │
       │ - pdfLib        │ │ - options    │ │ Output:      │
       │ - options       │ │ - theme      │ │ - schema:    │
       │ - _cache        │ │ - i18n       │ │   form-render│
       │                 │ │ - scale      │ │ - widgets    │
       │ Output:         │ │ - _cache     │ │ - defaultSch │
       │ PDF drawn       │ │              │ │              │
       │ (pixels)        │ │ Output:      │ │ Used for:    │
       │                 │ │ HTML DOM     │ │ Property     │
       │ Used in:        │ │ (editable)   │ │ editing in   │
       │ - generate()    │ │              │ │ Designer     │
       │   function      │ │ Used in:     │ │              │
       │ - PDF creation  │ │ - Designer   │ │              │
       │                 │ │ - Form       │ │              │
       │                 │ │ - Viewer     │ │              │
       └─────────────────┘ │              │ └──────────────┘
                           └──────────────┘

                    Same Input, Different Uses
              Each function is independent and
             can be called at different times
```

### Plugin Registration & Discovery

```
                    ┌─────────────────────────────┐
                    │  Create Plugins              │
                    │  {                           │
                    │    text: textPlugin,         │
                    │    image: imagePlugin,       │
                    │    table: tablePlugin,       │
                    │    email: emailPlugin,       │
                    │    barcode: barcodePlugin    │
                    │  }                           │
                    └────────────┬──────────────────┘
                                 │
                    ┌────────────▼──────────────────┐
                    │  pluginRegistry(plugins)      │
                    │                               │
                    │  Creates: PluginRegistry      │
                    │  which is a Map<type, Plugin> │
                    │  with helper methods          │
                    └────────────┬──────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
     ┌──────▼─────────┐   ┌──────▼────────┐   ┌─────▼──────┐
     │ Designer       │   │ Generator     │   │ Form/Viewer│
     │                │   │               │   │            │
     │ registry.      │   │ registry.     │   │ registry.  │
     │findByType(     │   │findByType(    │   │findByType( │
     │ 'text')        │   │'image')       │   │'checkbox') │
     │      │         │   │       │       │   │      │     │
     │      ▼         │   │       ▼       │   │      ▼     │
     │ textPlugin     │   │ imagePlugin   │   │ checkboxP  │
     │ {pdf, ui,      │   │ {pdf, ui,     │   │ {pdf, ui,  │
     │  propPanel}    │   │  propPanel}   │   │  propPanel}│
     └────────────────┘   └───────────────┘   └────────────┘
```

---

## Data Model Structure

### Template & Schema Hierarchy

```
Template (Root Document)
│
├─ basePdf: BlankPdf | CustomPdf
│  ├─ if BlankPdf: { width, height, padding }
│  └─ if CustomPdf: { pdf, width, height }
│
├─ schemas: Schema[][]  ← 2D Array
│  │
│  ├─ [0]: Schema[]  ← Page 1
│  │  ├─ [0]: Schema  ← Field 1 on Page 1
│  │  │  ├─ id: string
│  │  │  ├─ type: string (plugin type)
│  │  │  ├─ name: string (data binding key)
│  │  │  ├─ position: { x, y }  (mm)
│  │  │  ├─ width: number  (mm)
│  │  │  ├─ height: number  (mm)
│  │  │  ├─ ... type-specific properties
│  │  │  │
│  │  │  └─ For TextSchema:
│  │  │     ├─ fontSize: number
│  │  │     ├─ fontColor: string
│  │  │     ├─ alignment: string
│  │  │     └─ ... text-specific
│  │  │
│  │  └─ [1]: Schema  ← Field 2 on Page 1
│  │     └─ ... (same structure)
│  │
│  └─ [1]: Schema[]  ← Page 2
│     └─ [0]: Schema  ← Field 1 on Page 2
│        └─ ... (same structure)
│
└─ staticSchema?: Schema[]  ← Appears on every page

Input Data (Flat Object)
│
├─ field_name_1: string  ← Maps to schema.name
├─ field_name_2: string  ← Maps to schema.name
└─ field_name_3: string  ← Maps to schema.name
```

### Schema Property Breakdown

```
Base Schema Properties (All Types)
├─ Identity
│  ├─ id: "schema-1" (unique ID)
│  ├─ type: "text" (plugin type)
│  └─ name: "customerName" (data binding)
│
├─ Layout
│  ├─ position: { x: 10, y: 20 }  (in mm)
│  ├─ width: 100  (in mm)
│  ├─ height: 10  (in mm)
│  ├─ rotate: 0  (degrees)
│  └─ opacity: 1  (0-1)
│
├─ Content
│  ├─ content?: string  (for static/readOnly fields)
│  └─ readOnly?: boolean  (not data-bound)
│
└─ Extra
   └─ ... type-specific properties


TextSchema (extends Schema)
├─ All base properties
└─ Text-specific
   ├─ fontSize: 12
   ├─ fontName?: "Arial"
   ├─ fontColor: "#000000"
   ├─ backgroundColor: "#ffffff"
   ├─ alignment: "left" | "center" | "right"
   ├─ verticalAlignment: "top" | "middle" | "bottom"
   ├─ lineHeight: 1.2
   ├─ characterSpacing: 0
   ├─ strikethrough?: false
   ├─ underline?: false
   └─ dynamicFontSize?: { min, max, fit }


ImageSchema (extends Schema)
├─ All base properties
└─ Image-specific
   ├─ fit: "contain" | "cover" | "stretch"
   ├─ preserveAspectRatio: true
   └─ ... image options


TableSchema (extends Schema)
├─ All base properties
└─ Table-specific
   ├─ head: string[]  (column headers)
   ├─ body: string[][]  (table data)
   ├─ tableStyles: {...}
   ├─ border: boolean
   └─ ... table options
```

---

## Rendering Pipeline

### PDF Generation Pipeline (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│                     GENERATE FUNCTION                            │
│                  (packages/generator/generate.ts)                │
│                                                                  │
│  generate({                                                      │
│    template,                                                    │
│    inputs,         ← Array of data objects                      │
│    options,        ← Fonts, colors, etc.                        │
│    plugins         ← Plugin registry                            │
│  })                                                              │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1. PREPROCESSING              │
        ├────────────────────────────────┤
        │                                │
        │ ✓ Create PDFDocument           │
        │ ✓ Load base PDF pages          │
        │ ✓ Build renderObj              │
        │   = Map<type, pdf function>    │
        │   = Registry entries           │
        │                                │
        │ Output: { pdfDoc, renderObj }  │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  FOR EACH INPUT (loop)         │
        ├────────────────────────────────┤
        │                                │
        │ inputArray = [                 │
        │   {name: "John", logo: "..."},│
        │   {name: "Jane", logo: "..."}│
        │ ]                              │
        │                                │
        │ Each iteration:                │
        │ - Process one person           │
        │ - Generate one PDF document    │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.1. getDynamicTemplate()     │
        ├────────────────────────────────┤
        │                                │
        │ INPUT:                         │
        │ - template                     │
        │ - input (current row data)     │
        │ - options                      │
        │ - _cache                       │
        │                                │
        │ PROCESS:                       │
        │ 1. Replace {{placeholders}}    │
        │    "Hello {{name}}" +          │
        │    {name: "John"}              │
        │    = "Hello John"              │
        │                                │
        │ 2. Evaluate {{expressions}}    │
        │    "Total: {{price * qty}}"    │
        │    {price: 10, qty: 5}         │
        │    = "Total: 50"               │
        │                                │
        │ 3. Calculate dynamic heights   │
        │    For table: measure content  │
        │    Might be: 30mm (default)    │
        │    But content needs 45mm      │
        │    Recalculate to 45mm         │
        │                                │
        │ 4. Reposition dependent fields │
        │    If table grows, next field  │
        │    moves down accordingly      │
        │                                │
        │ OUTPUT:                        │
        │ - Modified template with:      │
        │   - Resolved values            │
        │   - Correct heights            │
        │   - Correct positions          │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2. FOR EACH PAGE (loop)     │
        ├────────────────────────────────┤
        │                                │
        │ Template has 2 pages:          │
        │ schemas[0] = page 1 schemas    │
        │ schemas[1] = page 2 schemas    │
        │                                │
        │ Each iteration:                │
        │ - Process one page             │
        │ - Add content to that page     │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2.1. insertPage()           │
        ├────────────────────────────────┤
        │                                │
        │ Create new PDF page:           │
        │                                │
        │ If blank PDF:                  │
        │ - Create empty page            │
        │ - Set dimensions (210x297)     │
        │                                │
        │ If custom PDF:                 │
        │ - Embed existing PDF           │
        │ - Use its dimensions           │
        │                                │
        │ OUTPUT:                        │
        │ - page (PDFPage object ready)  │
        │   for drawing                  │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2.2. FOR EACH SCHEMA        │
        │         (loop)                 │
        ├────────────────────────────────┤
        │                                │
        │ Page 1 has 5 schemas:          │
        │                                │
        │ Loop through each:             │
        │ 1. Title field (text)          │
        │ 2. Logo field (image)          │
        │ 3. Description (text)          │
        │ 4. Table (table)               │
        │ 5. Footer (text)               │
        │                                │
        │ For EACH schema:               │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2.2.1. GET PLUGIN           │
        ├────────────────────────────────┤
        │                                │
        │ schema.type = "text"           │
        │      ↓                         │
        │ renderObj["text"]              │
        │      ↓                         │
        │ pdfRender function from        │
        │ text plugin                    │
        │                                │
        │ IF type not found:             │
        │ - skip this schema             │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2.2.2. PREPARE PROPS        │
        ├────────────────────────────────┤
        │                                │
        │ PDFRenderProps = {             │
        │   value:                       │
        │     if readOnly:               │
        │       use schema.content       │
        │     else:                      │
        │       use input[schema.name]   │
        │                                │
        │   schema: {...},               │
        │   basePdf: {...},              │
        │   pdfLib: pdf-lib,             │
        │   pdfDoc: PDFDocument,         │
        │   page: PDFPage,               │
        │   options: {...},              │
        │   _cache: Map {}               │
        │ }                              │
        └────────────┬───────────────────┘
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2.2.3. CALL PDF RENDER      │
        ├────────────────────────────────┤
        │                                │
        │ await renderFunction(props)    │
        │                                │
        │ Text plugin pdfRender():       │
        │ ├─ Embed font in PDF           │
        │ ├─ Calculate layout            │
        │ ├─ Handle wrapping             │
        │ ├─ Apply colors & styles       │
        │ └─ page.drawText(...)          │
        │                                │
        │ Image plugin pdfRender():      │
        │ ├─ Load image                  │
        │ ├─ Calculate fit               │
        │ ├─ Embed in PDF                │
        │ └─ page.drawImage(...)         │
        │                                │
        │ Table plugin pdfRender():      │
        │ ├─ Parse table data            │
        │ ├─ Draw grid                   │
        │ ├─ Draw cells                  │
        │ └─ page.drawRect/Text/...()    │
        │                                │
        │ [Field is now in PDF]          │
        └────────────┬───────────────────┘
                     │
                     ├─ [Loop: next schema]
                     │
                     ↓
        ┌────────────────────────────────┐
        │  1.2.3. STATIC SCHEMAS         │
        ├────────────────────────────────┤
        │                                │
        │ If template.basePdf.static:    │
        │ - Process static schemas too   │
        │ - They appear on every page    │
        │   (header, footer, etc.)       │
        │                                │
        │ Same process as regular        │
        │ schemas but for each page      │
        └────────────┬───────────────────┘
                     │
                     ├─ [Loop: next page]
                     │
                     ↓
        ┌────────────────────────────────┐
        │  2. POSTPROCESSING             │
        ├────────────────────────────────┤
        │                                │
        │ ✓ Set PDF metadata             │
        │ ✓ Compress if requested        │
        │ ✓ Final adjustments            │
        └────────────┬───────────────────┘
                     │
                     ├─ [Loop: next input]
                     │
                     ↓
        ┌────────────────────────────────┐
        │  3. SAVE & RETURN              │
        ├────────────────────────────────┤
        │                                │
        │ pdfDoc.save()                  │
        │      ↓                         │
        │ Uint8Array                     │
        │ (PDF binary data)              │
        └────────────────────────────────┘
```

### UI Rendering Pipeline (Designer)

```
┌──────────────────────────────────────────┐
│         Designer Component               │
│     (packages/ui/Designer.tsx)           │
└──────────────────┬───────────────────────┘
                   │
                   ├─ App Context
                   │  ├─ fonts
                   │  ├─ language
                   │  ├─ plugins
                   │  └─ options
                   │
                   ↓
┌──────────────────────────────────────────┐
│    DesignerComponent (React)             │
│    (packages/ui/components/Designer/)    │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼─────────┐ ┌────▼────────────┐
│ LEFT SIDEBAR  │ │ CANVAS AREA      │
│               │ │                  │
│ Displays:     │ │ Displays:        │
│ ├─ List of    │ │ ├─ Current page  │
│ │  all schema │ │ │  preview       │
│ │  on page    │ │ │  (as image)    │
│ ├─ Click to   │ │ ├─ All fields    │
│ │  select     │ │ │  rendered via  │
│ ├─ Drag to    │ │ │  plugin.ui()   │
│ │  reorder    │ │ ├─ Moveable:     │
│ └─ Delete btn │ │ │  drag/resize   │
│               │ │ ├─ Selecto:      │
└───────────────┘ │ │  multi-select  │
                  │ ├─ Guides:       │
                  │ │  alignment     │
                  │ └─ Padding:      │
                  │    margin visual │
                  └────┬─────────────┘
                       │
                       ↓
         ┌─────────────────────────┐
         │  For Each Schema:       │
         │                         │
         │  plugin.ui({            │
         │    value,               │
         │    schema,              │
         │    mode: 'designer',    │
         │    rootElement,         │
         │    onChange,            │
         │    options,             │
         │    theme,               │
         │    i18n,                │
         │    scale,               │
         │    _cache               │
         │  })                     │
         │                         │
         │  ui() returns:          │
         │  - HTML element         │
         │  - Styled              │
         │  - Interactive         │
         │  - Positioned at       │
         │    x, y in viewport    │
         └─────────────────────────┘
                       │
                       ↓
         ┌─────────────────────────┐
         │  RIGHT SIDEBAR          │
         │  (DetailView)           │
         │                         │
         │  When field selected:   │
         │  ├─ Get plugin.propPanel│
         │  ├─ form-render renders │
         │  │  property form       │
         │  ├─ User edits props    │
         │  ├─ onChange triggers   │
         │  └─ Canvas re-renders   │
         │     with new values     │
         └─────────────────────────┘
```

---

## Component Architecture

### Directory Structure & Component Relationship

```
packages/ui/src/
│
├── class.ts
│   ├── BaseUIClass (abstract)
│   │   ├── Designer extends BaseUIClass
│   │   ├── Form extends BaseUIClass
│   │   ├── Viewer extends BaseUIClass
│   │   └── PreviewUI extends BaseUIClass
│   │       ├── Form extends PreviewUI
│   │       └── Viewer extends PreviewUI
│   │
│   └── Methods available to all:
│       ├── getTemplate()
│       ├── updateTemplate()
│       ├── updateOptions()
│       ├── destroy()
│       └── render() [abstract]
│
├── Designer.tsx (wrapper)
│   └── Wraps React component with class API
│       └── Extends BaseUIClass
│           ├── saveTemplate()
│           ├── onSaveTemplate(cb)
│           ├── onChangeTemplate(cb)
│           └── onPageChange(cb)
│
├── Form.tsx (wrapper)
│   └── Wraps React component
│       └── Extends PreviewUI
│           └── PreviewUI adds:
│               ├── getInputs()
│               ├── setInputs()
│
├── Viewer.tsx (wrapper)
│   └── Similar to Form
│
├── components/
│   │
│   ├── AppContextProvider.tsx
│   │   ├── Provides: lang, font, plugins, options
│   │   └── Wraps all children
│   │
│   ├── Designer/
│   │   │
│   │   ├── index.tsx (main component)
│   │   │   ├── State: template, selected, page, inputs
│   │   │   ├── Renders:
│   │   │   │  ├─ CtlBar
│   │   │   │  ├─ LeftSidebar
│   │   │   │  ├─ Canvas
│   │   │   │  └─ RightSidebar
│   │   │   └─ Handles all interactions
│   │   │
│   │   ├── LeftSidebar.tsx
│   │   │   ├── Lists all schemas on current page
│   │   │   ├── Select/delete/drag
│   │   │   └─ Communicates via callbacks
│   │   │
│   │   ├── Canvas/
│   │   │   ├── index.tsx (main canvas)
│   │   │   │   ├─ Renders page background/grid
│   │   │   │   ├─ For each schema:
│   │   │   │   │  └─ SchemaField component
│   │   │   │   └─ Handles selection, callbacks
│   │   │   │
│   │   │   ├── SchemaField.tsx (renderer)
│   │   │   │   ├─ Gets schema from props
│   │   │   │   ├─ Gets plugin by type
│   │   │   │   ├─ Calls plugin.ui({...})
│   │   │   │   ├─ Wraps in Moveable
│   │   │   │   └─ Returns interactive element
│   │   │   │
│   │   │   ├── Moveable.tsx
│   │   │   │   ├─ Library: react-moveable
│   │   │   │   ├─ Wraps schema field
│   │   │   │   ├─ Handles drag/resize
│   │   │   │   └─ Updates schema position
│   │   │   │
│   │   │   ├── Selecto.tsx
│   │   │   │   ├─ Library: selecto
│   │   │   │   ├─ Multi-selection
│   │   │   │   └─ Drag to select multiple
│   │   │   │
│   │   │   ├── Guides.tsx
│   │   │   │   └─ Visual alignment guides
│   │   │   │
│   │   │   └── Padding.tsx
│   │   │       └─ Show page margins
│   │   │
│   │   └── RightSidebar/
│   │       ├── index.tsx
│   │       │   ├─ Tabs: DetailView, ListView
│   │       │   └─ Shows property panel
│   │       │
│   │       ├── DetailView/
│   │       │   ├── index.tsx
│   │       │   │   ├─ Render property form
│   │       │   │   ├─ Uses plugin.propPanel
│   │       │   │   └─ form-render library
│   │       │   │
│   │       │   ├── WidgetRenderer.tsx
│   │       │   │   ├─ Renders form fields
│   │       │   │   └─ Handles field changes
│   │       │   │
│   │       │   └── ... other widgets
│   │       │
│   │       └── ListView/
│   │           └─ Shows position/size controls
│   │
│   ├── Form/
│   │   ├── index.tsx
│   │   │   ├─ Similar structure to Designer
│   │   │   ├─ But read-only or editable fields
│   │   │   └─ mode='form'
│   │   │
│   │   └── SchemaField.tsx
│   │       ├─ Calls plugin.ui({ mode: 'form' })
│   │       ├─ Collects input data
│   │       └─ onChange updates parent
│   │
│   ├── Viewer/
│   │   └─ Similar to Form
│   │       └─ mode='viewer' (read-only)
│   │
│   └── CtlBar.tsx
│       └─ Control buttons, page navigation, etc.
│
├── hooks.ts
│   ├─ useContext(AppContext)
│   ├─ Custom hooks for Designer logic
│   └─ Event handlers, state management
│
├── helper.ts
│   ├─ Utility functions
│   ├─ Styling helpers
│   └─ DOM manipulation
│
├── contexts.ts
│   └─ AppContext definition
│
├── i18n.ts
│   └─ Language strings/translations
│
├── theme.ts
│   └─ Ant Design theme configuration
│
└── index.ts
    └─ Exports: Designer, Form, Viewer
```

---

## State Management Flow

### Designer State Changes

```
Initial State
├─ template: Template
├─ selectedId: string | null
├─ currentPage: number
├─ inputs: InputData[]
└─ mode: 'design' | 'form' | 'view'

                 │
                 ↓ (USER ACTION)
          ┌──────────────┐
          │ Click Canvas │
          └──────┬───────┘
                 │
                 ├─ If on schema:
                 │  └─ selectedId = schema.id
                 │
                 └─ If on empty area:
                    └─ selectedId = null
                       │
                       ↓
          ┌──────────────────────┐
          │ RightSidebar updates │
          │ Shows selected field │
          │ properties           │
          └──────────────────────┘

                 │
                 ↓ (USER ACTION)
          ┌──────────────┐
          │ Edit Property│
          └──────┬───────┘
                 │
                 └─ propPanel.onChange({
                    key: 'fontSize',
                    value: 16,
                    schemaId: selectedId
                 })
                   │
                   ↓
          ┌──────────────────────────┐
          │ Designer State Updates   │
          │                          │
          │ template.schemas[page]   │
          │  .find(s => s.id === id) │
          │  .fontSize = 16          │
          └──────┬───────────────────┘
                 │
                 ↓
          ┌──────────────────────┐
          │ Canvas Re-renders    │
          │                      │
          │ For each schema:     │
          │  plugin.ui({...})    │
          │                      │
          │ Field shows new      │
          │ font size           │
          └──────────────────────┘

                 │
                 ↓ (USER ACTION)
          ┌──────────────┐
          │ Drag Field   │
          └──────┬───────┘
                 │
                 ├─ Moveable captures event
                 │
                 └─ onMove({
                    x: newX,
                    y: newY,
                    width: newW,
                    height: newH
                 })
                   │
                   ↓
          ┌──────────────────────────┐
          │ Designer State Updates   │
          │                          │
          │ template.schemas[page]   │
          │  .find(s => s.id === id) │
          │  .position = {x, y}      │
          │  .width = w              │
          │  .height = h             │
          └──────┬───────────────────┘
                 │
                 ↓
          ┌──────────────────────┐
          │ Canvas Re-renders    │
          │ (instant feedback)   │
          └──────────────────────┘
```

### Form/Viewer State Changes

```
Initial State
├─ template: Template
├─ inputs: InputData[]
├─ currentPage: number
└─ mode: 'form' | 'viewer'

                 │
                 ↓ (USER TYPES)
          ┌──────────────┐
          │ Input Field  │
          └──────┬───────┘
                 │
          ┌──────────────────────┐
          │ plugin.ui onChange   │
          │ called               │
          │                      │
          │ onChange({           │
          │   key: 'name',       │
          │   value: 'John'      │
          │ })                   │
          └──────┬───────────────┘
                 │
                 ↓
          ┌──────────────────────┐
          │ Form State Updates   │
          │                      │
          │ inputs[index]        │
          │  .name = 'John'      │
          └──────┬───────────────┘
                 │
                 ↓
          ┌──────────────────────┐
          │ Field Re-renders     │
          │ (shows new value)    │
          └──────────────────────┘
```

---

## Package Dependencies

### Core Dependency Graph

```
┌─────────────────────────────────────────────────┐
│           Application Layer                      │
│  (Designer/Form/Viewer usage)                   │
└────┬───────────────────────────────┬────────────┘
     │                               │
     ↓                               ↓
┌──────────────────────┐    ┌────────────────────┐
│ @pdfme/ui            │    │ @pdfme/generator   │
├──────────────────────┤    ├────────────────────┤
│ - Designer class     │    │ - generate()       │
│ - Form class         │    │ - PDF creation     │
│ - Viewer class       │    └────────┬───────────┘
│ - React components   │            │
└────┬────────┬────────┘            │
     │        │                     │
     │        └─────────┬───────────┘
     │                  │
     ↓                  ↓
┌────────────────────────────────────┐
│ @pdfme/common                      │
├────────────────────────────────────┤
│ - Plugin interface                 │
│ - PDFRenderProps, UIRenderProps    │
│ - Template types                   │
│ - Helper functions                 │
│ - PluginRegistry                   │
└────┬────────────────┬──────────────┘
     │                │
     ↓                ↓
┌──────────────────────────────────────┐
│ @pdfme/schemas                       │
├──────────────────────────────────────┤
│ - Built-in plugins                   │
│ - Text, Image, Table, Barcode, etc.  │
│ - Each plugin depends on:            │
│   - @pdfme/common (types)            │
│   - @pdfme/pdf-lib (PDF rendering)   │
└────┬─────────────────┬───────────────┘
     │                 │
     ↓                 ↓
┌────────────────────────────────────┐
│ @pdfme/pdf-lib                     │
├────────────────────────────────────┤
│ - PDF creation library              │
│ - Forked from pdf-lib               │
│ - Adds CJK font support             │
└──────────────────────────────────────┘

External Dependencies
├─ React (UI framework)
├─ TypeScript (Type system)
├─ Zod (Validation)
├─ Ant Design (UI components)
├─ form-render (Property panel forms)
├─ Moveable (DOM drag/resize)
├─ Selecto (Multi-selection)
├─ Fontkit (Font metrics)
└─ ... others
```

### Plugin Dependencies

```
┌──────────────────────────┐
│  Plugin System           │
│  (pluginRegistry)        │
└────────┬─────────────────┘
         │
┌────────┴─────────────┐
│                      │
┌─────────────────┐   ┌─────────────────┐
│ Text Plugin     │   │ Image Plugin    │
├─────────────────┤   ├─────────────────┤
│ Depends on:     │   │ Depends on:     │
│ - TextSchema    │   │ - ImageSchema   │
│ - @pdfme/common │   │ - @pdfme/common │
│ - @pdfme/pdf-lib│   │ - @pdfme/pdf-lib│
│ - fontkit       │   │                 │
│                 │   │                 │
│ Exports:        │   │ Exports:        │
│ - pdfRender()   │   │ - pdfRender()   │
│ - uiRender()    │   │ - uiRender()    │
│ - propPanel     │   │ - propPanel     │
└─────────────────┘   └─────────────────┘

┌─────────────────┐   ┌─────────────────┐
│ Table Plugin    │   │ Barcode Plugin  │
├─────────────────┤   ├─────────────────┤
│ Depends on:     │   │ Depends on:     │
│ - TableSchema   │   │ - BarcodeSchema │
│ - @pdfme/common │   │ - @pdfme/common │
│ - @pdfme/pdf-lib│   │ - @pdfme/pdf-lib│
│ - Dynamic layout│   │ - jsbarcode lib │
│                 │   │                 │
│ Exports:        │   │ Exports:        │
│ - pdfRender()   │   │ - pdfRender()   │
│ - uiRender()    │   │ - uiRender()    │
│ - propPanel     │   │ - propPanel     │
└─────────────────┘   └─────────────────┘

Each plugin is independent:
- Can be used without others
- Has complete PDF + UI + config
- Can be replaced/extended
- Follows same interface
```

---

## Component Interaction Sequence

### Designer: Creating a New Field

```
┌─────────────┐
│ User clicks │
│ "Add Text"  │
│ button      │
└──────┬──────┘
       │
       ↓
┌─────────────────────────┐
│ DesignerComponent       │
│ receives action         │
│ addSchema('text')       │
└──────┬──────────────────┘
       │
       ├─ Get text plugin
       │  plugin.propPanel.defaultSchema
       │  │
       │  └─ {
       │     fontSize: 12,
       │     fontColor: '#000000',
       │     alignment: 'left',
       │     width: 100,
       │     height: 10,
       │     position: {x: 10, y: 10},
       │     type: 'text',
       │     ...
       │    }
       │
       ├─ Generate unique ID
       │  id = 'schema-123'
       │
       ├─ Add to template.schemas[currentPage]
       │
       ├─ Select new field
       │  selectedId = 'schema-123'
       │
       └─ Trigger re-render
          │
          ↓
       ┌──────────────────────────┐
       │ Canvas Re-renders        │
       │                          │
       │ For each schema:         │
       │  ├─ Get plugin by type   │
       │  ├─ Call plugin.ui({     │
       │  │   value: '',          │
       │  │   schema: {...},      │
       │  │   mode: 'designer',   │
       │  │   ...                 │
       │  │ })                    │
       │  ├─ Wraps in Moveable    │
       │  └─ Shows on canvas      │
       │                          │
       │ [New field appears]      │
       └──────────────────────────┘
          │
          ↓
       ┌──────────────────────────┐
       │ RightSidebar Updates     │
       │                          │
       │ Shows text plugin's      │
       │ propPanel form fields:   │
       │ - fontSize input         │
       │ - alignment select       │
       │ - fontColor picker       │
       │ - ... others             │
       │                          │
       │ User can edit properties │
       │ field updates in real-   │
       │ time                     │
       └──────────────────────────┘
```

---

## Summary: How Everything Works Together

```
                    ┌─────────────────┐
                    │  User Creates   │
                    │  PDF Template   │
                    │  in Designer    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────┐
                    │ Designer (React App)   │
                    │                        │
                    │ Uses BaseUIClass       │
                    │ Manages:               │
                    │ - template object      │
                    │ - user selections      │
                    │ - property changes     │
                    └────────┬───────────────┘
                             │
                    ┌────────▼────────────────┐
                    │ Canvas + Sidebars      │
                    │                        │
                    │ Canvas:                │
                    │ - Renders each schema  │
                    │  via plugin.ui()       │
                    │ - Allows drag/resize   │
                    │                        │
                    │ LeftSidebar:           │
                    │ - List of fields       │
                    │                        │
                    │ RightSidebar:          │
                    │ - Property panel via   │
                    │  plugin.propPanel      │
                    └────────┬───────────────┘
                             │
                             │ [User saves]
                             │
                    ┌────────▼────────────────┐
                    │ Template JSON Saved    │
                    │                        │
                    │ Can be:                │
                    │ - Stored in DB         │
                    │ - Sent to backend      │
                    │ - Shared with others   │
                    └────────┬───────────────┘
                             │
                             │ [Time to generate]
                             │
                    ┌────────▼────────────────┐
                    │ PDF Generation         │
                    │ generate() function    │
                    │                        │
                    │ For each input:        │
                    │ - Call getDynamic()    │
                    │ - For each page:       │
                    │  - Create page         │
                    │  - For each schema:    │
                    │   - Call plugin.pdf()  │
                    │   - Draw on PDF        │
                    └────────┬───────────────┘
                             │
                    ┌────────▼────────────────┐
                    │ Output: PDF Bytes      │
                    │                        │
                    │ Ready to:              │
                    │ - Download             │
                    │ - Email                │
                    │ - Print                │
                    │ - Store                │
                    └────────────────────────┘
```

This architecture ensures:
✓ **Separation of Concerns**: Each plugin is independent
✓ **Reusability**: Same plugin works in Designer, Form, Generator
✓ **Extensibility**: Easy to add new field types
✓ **Type Safety**: TypeScript ensures correctness
✓ **Performance**: Caching and optimization throughout
