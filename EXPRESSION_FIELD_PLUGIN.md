# Expression Field Plugin - Implementation Summary

## Overview
Successfully implemented a JavaScript Expression Field plugin for PDFme that gives users a first-class, code-styled field type for creating calculated/dynamic fields.

## Changes Made

### 1. New File: `playground/src/plugins/expressionField.ts`
A complete plugin implementation that:
- **Defines Schema**: `ExpressionFieldSchema` interface extending `Schema`
  - `content: string` — Stored as `{expression}`, e.g., `{Number(price) * qty}`
  - `readOnly: true` — Always true (handled automatically by generator)
  - Text styling properties: `fontSize`, `fontColor`, `alignment`, `verticalAlignment`, `lineHeight`, `characterSpacing`, `backgroundColor`, `fontName`, `opacity`

- **UI Rendering** (`ui` function):
  - Designer mode: Shows raw expression with braces in monospace, teal-colored code style
  - Viewer/Form mode: Shows resolved value with applied styling
  - Provides visual distinction between expression and calculated result

- **PDF Rendering** (`pdf` function):
  - Reuses `text.pdf` directly from `@pdfme/schemas`
  - Works because the generator automatically evaluates `{expression}` in `content` when `readOnly: true` before calling `pdf()`
  - The resolved value is passed to `pdf()`, which handles all text rendering

- **Prop Panel** (`propPanel`):
  - **Custom Widget** (`ExpressionWidget`):
    - Textarea for JavaScript expression input (without braces)
    - Shows hint text about available variables
    - Automatically wraps/unwraps braces on input/output
    - Uses `changeSchemas` to update the `content` field
  - **Standard Controls**:
    - Font size, font color, alignment (left/center/right)
    - Vertical alignment (top/middle/bottom)
    - Line height, character spacing
    - Background color

- **Icon**:
  - Custom SVG showing `{}` brackets to clearly signal "code expression"

### 2. Updated File: `playground/src/plugins/index.ts`
- Added import: `import { expressionField } from './expressionField';`
- Added to `getPlugins()` return object: `'Expression Field': expressionField,`
- Positioned after `Text` for intuitive sidebar ordering

## How It Works

### Generator Integration (Zero Changes Needed)
The PDFme generator already supports this workflow:

```typescript
// packages/generator/src/generate.ts (lines 135-141)
const value: string = schema.readOnly
  ? replacePlaceholders({
      content: schema.content || '',    // "{Number(price) * qty}" → "50"
      variables: { ...input, totalPages, currentPage },
      schemas,
    })
  : ((input[name] || '') as string);
```

Our plugin leverages this by setting `readOnly: true` and storing expressions as `{expression}`.

### User Workflow
1. **Drag field to canvas**: "Expression Field" appears as a teal `{date}` badge
2. **Click to configure**: Prop panel shows textarea with `date` (no braces)
3. **Type expression**: `Number(price) * quantity` → canvas updates to `{Number(price) * quantity}`
4. **Generate PDF**:
   - Expression Field is automatically calculated (readOnly, not in Template Tester)
   - Generator evaluates expression: `{Number(price) * quantity}` → `50`
   - `pdf()` renders resolved value with configured styling

### Available Built-in Variables
These work automatically (no setup required):

| Variable | Result | Example |
|---|---|---|
| `date` | Current date | `2026/02/18` |
| `dateTime` | Current date + time | `2026/02/18 14:30` |
| `currentPage` | Current page number | `1` |
| `totalPages` | Total pages in PDF | `3` |
| Input field names | Value from input field | `price`, `quantity` |

### JavaScript Expressions
Full JavaScript support via the existing security-validated expression evaluator:

```javascript
Number(price) * qty                    // Arithmetic
total > 100 ? "Premium" : "Regular"   // Conditionals
Math.round(subtotal * 0.1)            // Math functions
date                                   // Built-in variables
Total: {price}                         // Mixed text + expression
```

## Verification Checklist

### Visual Tests in Playground
- [ ] `cd playground && npm run dev` (now running on port 5178+)
- [ ] Left sidebar shows "Expression Field" below "Text"
- [ ] Dragging "Expression Field" creates teal badge with `{date}` text
- [ ] Clicking the field shows prop panel with expression textarea
- [ ] Textarea shows `date` (no braces)
- [ ] Type `Number(price) * quantity` → canvas badge updates to `{Number(price) * quantity}`
- [ ] Font size, color, alignment controls work normally

### Functional Tests (Template Tester)
- [ ] Create template with Expression Field
- [ ] Open Template Tester
- [ ] Expression Field is NOT shown (readOnly fields are hidden, correct!)
- [ ] Add input fields: `price` (value: 10), `quantity` (value: 5)
- [ ] Click "Generate" → PDF shows "50" in Expression Field location
- [ ] Verify styling (font size, color) is applied

### Error Handling
- [ ] Invalid expression (e.g., `foo bar`): PDF shows raw `{foo bar}` (fail-safe)
- [ ] Empty expression: Falls back to `{date}`
- [ ] Mixed text + expression (e.g., `Total: {price}`): Renders `Total: 10`

## Technical Details

### Why This Works Without Touching Generator
1. Generator's `replacePlaceholders()` already evaluates `{expression}` patterns
2. It validates expressions via Acorn-based AST checking (secure)
3. Resolved value is passed to `pdf()` function
4. We reuse `text.pdf` which expects an already-resolved string

### Plugin Architecture
- Extends `Plugin<ExpressionFieldSchema>` interface
- Implements required methods: `ui`, `pdf`, and `propPanel`
- Custom widget pattern follows existing conventions (see `UseDynamicFontSize` in text plugin)
- No changes to @pdfme packages — purely playground extension

### Default Schema
Expression Field initializes with safe defaults:
```typescript
{
  content: '{date}',           // Safe—date is always available
  readOnly: true,
  fontSize: 13,
  fontColor: '#000000',
  alignment: 'left',
  verticalAlignment: 'top',
  backgroundColor: '',
  opacity: 1,
}
```

## Files Changed
```
playground/src/plugins/expressionField.ts  [NEW] 202 lines
playground/src/plugins/index.ts            [MODIFIED] Added import + 1 line to getPlugins()
```

**Zero changes to any `packages/` directory.**

## Future Enhancement Ideas
While not needed for this implementation, these could be added:
- Caching optimizations for complex expressions
- Expression validation/preview in prop panel
- Syntax highlighting in textarea (via Monaco or Ace)
- Template variables documentation link
- Expression history/favorites

## Testing Commands
```bash
cd /e/Dev/campx/pdfme/playground && npm run dev
# Navigate to http://localhost:5178 (or assigned port)
```

No build step required — dev server handles everything, and playground is already configured to use local plugins.
