# TemplateTester Component Refactor

## Overview

The TemplateTester component in the playground has been simplified to provide a clean, user-friendly interface for testing templates. Instead of complex table grid editors, it now uses simple input fields for all dynamic fields.

**Date:** 2026-02-18
**Status:** ✅ Complete

---

## What Changed

### Removed Features

✅ **TableEditor Component** - Complex table grid with add/remove row buttons
✅ **Table Content Parsing** - No more JSON parsing of table data
✅ **Nested Table Support** - No manual table editing
✅ **Plus/Minus Icons** - Removed row manipulation UI
✅ **parseTableContent()** - Unused helper function
✅ **getLeafColumns()** - Unused helper function
✅ **getColumnsForSchema()** - Unused helper function

### New Approach

#### Before (Complex):
```typescript
// Old: Table had grid editor with rows/cells
<TableEditor
  columns={columns}
  value={value}
  onChange={(v) => updateField(field.name, v)}
/>

// Input: {"table": "[[\"a\",\"b\"],[\"c\",\"d\"]]"}
```

#### After (Simple):
```typescript
// New: Tables skipped, no special editing
if (STATIC_TYPES.has(field.type)) {
  return null; // Skip table & nestedTable
}

// Input: Direct string values for all fields
{
  "firstName": "John",
  "lastName": "Doe",
  "age": "30"
}
```

---

## Field Type Handling

### Simple Input Fields

| Field Type | Input Control | Output Format |
|---|---|---|
| **Text** | Text input | String |
| **MultiVariableText** | Textarea | String with {variables} |
| **Date/Time/DateTime** | Text input | ISO string |
| **Select** | Dropdown | Selected option |
| **RadioGroup** | Dropdown | Selected option |
| **Checkbox** | Toggle | "true" or "false" |

### File Input Fields

| Field Type | Input Control | Output Format |
|---|---|---|
| **Image** | File upload | data:image/png;base64,... |
| **SVG** | File upload | data:image/svg+xml;base64,... |
| **Signature** | File upload | data:image/png;base64,... |

### Skipped Fields (No Input)

| Field Type | Reason |
|---|---|
| **Table** | Content filled via input object |
| **NestedTable** | Content filled via input object |
| **Line** | Static shape |
| **Rectangle** | Static shape |
| **Ellipse** | Static shape |

---

## How Tables Are Filled

Tables and NestedTables are **not edited in the tester**. Instead, they're populated from the input data:

```json
{
  "field1": "row1col1",
  "field2": "row1col2",
  "field3": "row2col1",
  "field4": "row2col2"
}
```

Or using nested structures for multi-row tables, the template designer manages the table structure, and the tester provides simple string values.

**Key Point:** Tables are **content-driven**, not structure-driven in the tester.

---

## Code Changes

### File: `playground/src/components/TemplateTester.tsx`

**Removed:**
```typescript
// Removed table editing functionality
- TableEditor component (lines 62-150)
- parseTableContent() function
- getLeafColumns() function
- getColumnsForSchema() function
- Plus, Minus icons from imports
```

**Updated:**
```typescript
// Simplified STATIC_TYPES to include tables
const STATIC_TYPES = new Set(["line", "rectangle", "ellipse", "table", "nestedTable"]);

// renderField() now handles simple inputs only
// Tables automatically skipped (in STATIC_TYPES)
// No grid editors or complex UI
```

**Simplified:**
```typescript
// Input controls now just:
// - Text fields (default)
// - Textarea (for multiVariableText)
// - File upload (for images)
// - Toggle/checkbox
// - Dropdowns (select, radioGroup)

// No JSON handling
// No table grid logic
// No row add/remove buttons
```

---

## User Experience

### Before
```
┌──────────────────────────────────────────────┐
│ Template Tester                              │
├──────────────────────────────────────────────┤
│                                              │
│ [firstName]                    [text input]  │
│                                              │
│ [table_field]                                │
│  ┌──────────────────────────────────────┐   │
│  │ Col1   │ Col2   │ Col3              │   │
│  ├────────┼────────┼───────────────────┤   │
│  │ [input]│ [input]│ [input]           │   │
│  │ [input]│ [input]│ [input]           │   │
│  └────────┴────────┴───────────────────┘   │
│  [+ Add Row] [- Remove Row]                │
│                                              │
│  [Copy JSON] [Generate PDF]       [Close]   │
│                                              │
└──────────────────────────────────────────────┘
```

**Issues:** Too complex, confusing table grid, JSON handling errors

### After
```
┌──────────────────────────────────────────────┐
│ Template Tester                              │
├──────────────────────────────────────────────┤
│                                              │
│ [firstName]  [text]                         │
│ ┌────────────────────────────────────────┐  │
│ │ Enter firstName...                     │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ [table_field] – SKIPPED (no input needed)   │
│                                              │
│ [age]  [text]                               │
│ ┌────────────────────────────────────────┐  │
│ │ Enter age...                           │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ [Copy JSON] [Generate PDF]       [Close]    │
│                                              │
└──────────────────────────────────────────────┘
```

**Benefits:**
- Clean interface
- Simple inputs
- No confusion
- Easier to understand
- No JSON errors
- Tables handled by template logic

---

## Example Workflow

### 1. Designer Creates Template

```json
{
  "schemas": [[
    {
      "name": "firstName",
      "type": "text",
      "position": { "x": 10, "y": 10 },
      "width": 100,
      "height": 20
    },
    {
      "name": "myTable",
      "type": "nestedTable",
      "headerTree": [...],
      "content": "[[\"{{firstName}}\",\"Data\"]]"
    }
  ]],
  "basePdf": { "width": 210, "height": 297, ... }
}
```

### 2. User Opens Template Tester

- **firstName field:** Shows text input
- **myTable field:** SKIPPED (no input UI)

### 3. User Fills Input

```json
{
  "firstName": "John Doe"
}
```

### 4. PDF Generated

- firstName replaced with "John Doe"
- myTable rendered with its content

---

## Benefits of Refactoring

✅ **Simpler Code**
- Less complexity
- Fewer edge cases
- Easier to maintain

✅ **Better UX**
- Clean interface
- Straightforward inputs
- No grid confusion

✅ **No JSON Errors**
- No manual JSON encoding/decoding
- No array parsing issues
- Direct string values

✅ **Focused Purpose**
- Tester focuses on simple value input
- Tables handled by template logic
- Clear separation of concerns

✅ **Easier Testing**
- Quick input filling
- Fast PDF generation
- Clear output format

---

## Migration Guide

If you were using the old TemplateTester with table editing:

### Old Way (No Longer Works)
```typescript
// Used to open table grid editor
// Manually entered cell values
// Generated JSON string: "[[\"a\",\"b\"]]"
```

### New Way
```typescript
// Tables are skipped in input form
// Fill simple text fields
// Table content comes from template definition
// Input is simple object: { fieldName: "value" }
```

---

## What's NOT Changed

✅ **Generate PDF button** - Still works the same
✅ **Copy JSON button** - Still copies input as JSON
✅ **PDF generation** - Unchanged
✅ **Playground integration** - Unchanged
✅ **Designer integration** - Unchanged
✅ **API** - Unchanged

---

## Files Modified

| File | Changes |
|------|---------|
| `playground/src/components/TemplateTester.tsx` | Removed table editor, simplified fields |

---

## Testing

Verified:
✅ TypeScript compiles without errors
✅ All field types render correctly
✅ Simple text inputs work
✅ File uploads work
✅ Checkboxes work
✅ Dropdowns work
✅ Tables are skipped
✅ PDF generation works
✅ JSON copy works

---

## Summary

The TemplateTester component has been refactored from a complex table-editing interface to a simple input form. This makes it easier to use and maintains a clean separation between template design and data input.

- **Tables** are designed in the Designer
- **Data** is provided via simple input fields in the Tester
- **PDFs** are generated with templates + data combined

---

**Status:** ✅ Ready for use
**Backward Compatibility:** ⚠️ Table inputs now skipped (as requested)
