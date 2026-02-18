# Expression Field Variable Detection

## Overview

When you use Expression Fields in your PDFme template, the **Template Tester** now automatically detects and displays which variables your expressions require. This helps you understand what input data is needed before generating PDFs.

## How It Works

### 1. Variable Extraction

When you open the Template Tester, the system:
1. Parses all Expression Field content (e.g., `{Number(price) * quantity}`)
2. Uses JavaScript AST parsing (with acorn) to extract identifiers
3. Filters out built-in variables (date, dateTime, currentPage, totalPages, Math, etc.)
4. Returns the custom variables needed (e.g., `price`, `quantity`)

### 2. Display in Template Tester

Expression Fields appear in a dedicated **"Calculated Fields"** section with:
- **Field Name**: The name of your expression field
- **Expression**: The JavaScript code (with braces)
- **Required Variables**: Each variable shown with status badge
  - ✓ Green badge = Variable has a value
  - ❌ Red badge = Variable is missing
- **Overall Status**: "✓ Ready" or "⚠ Incomplete"

### 3. Input Fields Below

Below the calculated fields, you'll see **Input Fields** for all variables that need values. Fill these in, and the status badges update in real-time.

## Example

### Template Setup

Create three fields:
1. **price** — Text input field
2. **quantity** — Text input field
3. **total** — Expression Field with content: `{Number(price) * quantity}`

### Template Tester Display

```
┌─────────────────────────────────────────────────────┐
│ Calculated Fields (Expression Fields)              │
│                                                     │
│ total                              ⚠ Incomplete   │
│ {Number(price) * quantity}                          │
│ ❌ price   ❌ quantity                             │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Input Fields                                        │
│                                                     │
│ price [text]                [5]                    │
│ quantity [text]             [10]                   │
│                                                     │
│ [Generate PDF]                                      │
└─────────────────────────────────────────────────────┘
```

As you type values:
- `price = 5` → ✓ price badge turns green
- `quantity = 10` → ✓ quantity badge turns green
- Status changes to "✓ Ready"
- Generated PDF will calculate: 5 × 10 = 50

## Supported Expressions

### Simple Variables
```javascript
{price}                    // Single variable
{firstName} {lastName}     // Multiple variables
```

### Calculations
```javascript
{Number(price) * quantity}
{subtotal + tax}
{Math.round(amount * 0.1)}
```

### Conditionals
```javascript
{total > 100 ? "Premium" : "Regular"}
{quantity >= 10 ? quantity * 0.9 : quantity}
```

### Built-in Variables (No Input Needed)
```javascript
{date}                     // 2026/02/18
{dateTime}                 // 2026/02/18 14:30
{currentPage}              // 1, 2, 3, etc.
{totalPages}               // 3, 5, 10, etc.
```

### Complex Expressions
```javascript
{Array.from({length: quantity}, (_, i) => i + 1).join(', ')}
{Math.sqrt(length * length + width * width)}
{JSON.stringify({price, quantity})}
```

## Implementation Details

### Files Created/Modified

#### New: `playground/src/utils/expressionVariableExtractor.ts`
- `extractVariablesFromExpression(expressionString)` — Extract variables from a single expression
- `extractAllExpressionVariables(schemas)` — Extract variables from all expression fields in a template
- Handles AST parsing, filters built-ins, returns sorted unique variables

#### Modified: `playground/src/components/TemplateTester.tsx`
- Imports `extractVariablesFromExpression`
- Detects expression fields during template loading
- Displays calculated fields section with status tracking
- Updates status as user fills in input fields

### Variable Detection Algorithm

1. **Parse Expression** — Use acorn to parse JavaScript into AST
2. **Walk AST** — Recursively visit all nodes
3. **Collect Identifiers** — When you find an Identifier node, add it if:
   - It's not in BUILT_IN_VARIABLES list
   - It's not a property name in a MemberExpression
4. **Return Sorted** — Return unique, alphabetically sorted variables

### Built-in Variables (Filtered Out)

**Date/Time** (provided by generator):
- date, dateTime, currentPage, totalPages

**Global Objects** (JS standard):
- Math, String, Number, Boolean, Array, Object, Date, JSON
- isNaN, parseFloat, parseInt
- decodeURI, decodeURIComponent, encodeURI, encodeURIComponent

## Error Handling

### Invalid Expressions
If an expression can't be parsed (syntax error):
- Console logs debug message
- No status shown for that field
- PDF generation still works (may show raw `{expression}`)

### Missing Variables
If a variable is missing when generating:
- Generator throws: "Undefined variable: variableName"
- Toast error shown to user
- PDF generation fails gracefully

### Example Error Cases
```javascript
{foo bar}                  // Invalid syntax → ignored
{if (x > 0) x else 0}     // Not supported → error
{import('module')}         // Not supported → error
{constructor}              // Blocked (security) → error
```

## Testing Workflow

### Step 1: Create Expression Field
1. Open Designer
2. Drag "Expression Field" to canvas
3. Edit in prop panel: `{Number(price) * quantity}`

### Step 2: Open Template Tester
1. Click "Template Tester"
2. See "Calculated Fields" section showing:
   - Expression: `{Number(price) * quantity}`
   - Required: ❌ price, ❌ quantity
   - Status: ⚠ Incomplete

### Step 3: Fill Input Fields
1. Find "price" in "Input Fields"
2. Enter value: `10`
3. See badge change to "✓ price"
4. Find "quantity"
5. Enter value: `5`
6. See badge change to "✓ quantity"
7. See status change to "✓ Ready"

### Step 4: Generate PDF
1. Click "Generate PDF"
2. Open PDF
3. Expression Field shows: `50` (10 * 5)

## Features

✅ **Automatic Detection** — No manual configuration needed
✅ **Real-time Status** — Shows which variables are ready/missing
✅ **Built-in Filtering** — Doesn't show system variables
✅ **Error Resilience** — Invalid expressions don't break Template Tester
✅ **Security** — Blocks access to dangerous properties (__proto__, constructor)
✅ **Performance** — Uses cached AST parsing
✅ **User Friendly** — Color-coded status badges, clear labels

## Limitations

⚠️ **Arrow Function Bodies** — Complex arrow function bodies aren't fully analyzed
⚠️ **Block Statement Bodies** — Function block statements aren't analyzed
⚠️ **Dynamic Property Access** — `obj[variableName]` can't detect all variables
⚠️ **Template Strings** — `\`Count: ${variable}\`` are not expressions (use `{variable}` instead)

## Future Enhancements

Possible improvements:
- Syntax highlighting in expression display
- "Copy template" with sample values
- Expression validation/autocomplete in prop panel
- Variable type hints based on usage
- Expression templates/examples library
- Performance metrics (which variables slow down generation)

## Usage Tips

💡 **Keep Expressions Simple** — Complex expressions are harder to debug
💡 **Name Fields Clearly** — Use descriptive names like "total_amount" not "t"
💡 **Test with Sample Data** — Always test in Template Tester before generating PDFs
💡 **Comment Your Expressions** — Use the hint field in prop panel to explain logic
💡 **Handle Missing Data** — Use conditionals: `{price ? Number(price) : 0}`
