# JavaScript Expressions in PDFme Schemas

This guide explains how to use JavaScript expressions in PDFme templates, what is allowed, and how to add fields using expressions.

---

## Table of Contents
1. [Overview](#overview)
2. [Allowed JavaScript Syntax](#allowed-javascript-syntax)
3. [Blocked/Dangerous Operations](#blockeddangerous-operations)
4. [Real-World Examples](#real-world-examples)
5. [Variable Context](#variable-context)
6. [How to Add Expressions via Designer](#how-to-add-expressions-via-designer)
7. [Schema Examples](#schema-examples)
8. [Security Features](#security-features)

---

## Overview

PDFme allows you to inject **JavaScript expressions** into schema `content` fields using the placeholder syntax: `{expression}`

### Key Points:
- ✅ **Sandboxed Execution** - Uses Acorn parser for safe evaluation
- ✅ **No `eval()`** - Expressions are parsed into AST and validated before execution
- ✅ **Whitelist Model** - Only explicitly allowed operations work
- ✅ **Fail-Safe** - Invalid expressions return the placeholder unchanged
- ✅ **Cached Compilation** - Expressions cached after first parse for performance

### When to Use Expressions:
- **Dynamic Calculations** - Compute totals, tax, discounts
- **Conditional Display** - Show/hide content based on values
- **Data Transformation** - Format strings, convert units
- **Multi-row Aggregation** - Sum arrays, count items
- **Field References** - Reference other schema fields

---

## Allowed JavaScript Syntax

### ✅ Literals
```javascript
42                    // Numbers
"string"              // Strings
true, false, null     // Booleans
[1, 2, 3]            // Arrays
{a: 1, b: 2}         // Objects
```

### ✅ Operators

**Arithmetic:**
```javascript
a + b    // Addition
a - b    // Subtraction
a * b    // Multiplication
a / b    // Division
a % b    // Modulo
a ** b   // Exponentiation
```

**Comparison:**
```javascript
a == b   // Loose equality
a != b   // Loose inequality
a === b  // Strict equality
a !== b  // Strict inequality
a < b    // Less than
a > b    // Greater than
a <= b   // Less than or equal
a >= b   // Greater than or equal
```

**Logical:**
```javascript
a && b   // AND
a || b   // OR
!a       // NOT
```

**Ternary:**
```javascript
condition ? trueValue : falseValue
```

### ✅ Member Access
```javascript
object.property        // Dot notation
object[computed]       // Bracket notation
array[0]              // Array indexing
nested.deep.value     // Chained access
```

### ✅ Function Calls
```javascript
Math.max(1, 2, 3)
String.concat('a', 'b')
Array.isArray([1, 2])
parseFloat("123.45")
parseInt("42")
```

### ✅ Arrow Functions & Methods
```javascript
[1, 2, 3].map(x => x * 2)        // [2, 4, 6]
[1, 2, 3].filter(x => x > 1)     // [2, 3]
[1, 2, 3].reduce((sum, x) => sum + x, 0)  // 6
"hello".toUpperCase()            // "HELLO"
```

### ✅ Allowed Global Objects & Functions
```javascript
Math              // Math.max, Math.min, Math.abs, Math.floor, etc.
String            // String methods
Number            // Number parsing
Boolean           // Type conversion
Array             // Array utilities
Object            // Object.keys(), Object.values(), Object.entries()
Date              // Date constructor and methods
JSON              // JSON.parse(), JSON.stringify()

// Global functions
isNaN(value)
parseFloat(value)
parseInt(value)
decodeURI(value)
decodeURIComponent(value)
encodeURI(value)
encodeURIComponent(value)
```

### ✅ Available Built-in Variables
```javascript
date              // Current date (YYYY/MM/DD format)
dateTime          // Current date-time (YYYY/MM/DD HH:mm format)
currentPage       // Current page number
totalPages        // Total number of pages
```

---

## ❌ Blocked/Dangerous Operations

### Prototype Pollution Prevention
```javascript
__proto__                        // BLOCKED
constructor                      // BLOCKED
prototype                        // BLOCKED
__defineGetter__                // BLOCKED
__defineSetter__                // BLOCKED
__lookupGetter__                // BLOCKED
__lookupSetter__                // BLOCKED
```

### Dangerous Object Methods
```javascript
Object.getOwnPropertyDescriptor  // BLOCKED
Object.getPrototypeOf           // BLOCKED
Object.setPrototypeOf           // BLOCKED
Object.defineProperty           // BLOCKED
Object.defineProperties         // BLOCKED
Object.getOwnPropertyNames      // BLOCKED
Object.getOwnPropertySymbols    // BLOCKED
Object.create                   // BLOCKED
Object.freeze                   // BLOCKED
Object.seal                     // BLOCKED
```

### Code Execution
```javascript
eval()              // BLOCKED
Function()          // BLOCKED
process             // BLOCKED
global              // BLOCKED
window              // BLOCKED
```

### Assignment Operations
```javascript
x = value           // BLOCKED (not in expression context)
x += value          // BLOCKED
```

---

## Real-World Examples

### 1. Invoice Total Calculation

**Schema Definition:**
```json
{
  "type": "text",
  "name": "subtotal",
  "position": { "x": 150, "y": 150 },
  "width": 50,
  "height": 10,
  "content": "{orders.reduce((sum, item) => sum + parseFloat(item[1] || 0) * parseFloat(item[2] || 0), 0)}",
  "readOnly": true
}
```

**Input Data:**
```json
{
  "orders": [
    ["Widget", "10", "5"],    // 10 units × 5 = 50
    ["Gadget", "20", "3"]     // 20 units × 3 = 60
  ]
}
```

**Result:** `110`

### 2. Tax Calculation

**Schema:**
```json
{
  "type": "text",
  "name": "tax",
  "content": "{Number(subtotal) * Number(taxRate) / 100}",
  "readOnly": true
}
```

**Input:**
```json
{
  "subtotal": "110",
  "taxRate": "10"
}
```

**Result:** `11`

### 3. Total with Tax

**Schema:**
```json
{
  "type": "text",
  "name": "total",
  "content": "{Number(subtotal) + Number(tax)}",
  "readOnly": true
}
```

**Result:** `121`

### 4. Conditional Display

**Schema:**
```json
{
  "type": "text",
  "name": "discountMessage",
  "content": "{Number(total) > 100 ? 'Eligible for 5% discount!' : 'No discount available'}",
  "readOnly": true
}
```

**Result:** `Eligible for 5% discount!`

### 5. String Formatting

**Schema:**
```json
{
  "type": "text",
  "name": "formattedAmount",
  "content": "${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}",
  "readOnly": true
}
```

**Result:** `$121.00`

### 6. Array Filtering

**Schema:**
```json
{
  "type": "text",
  "name": "premiumCount",
  "content": "{orders.filter(item => parseFloat(item[2]) > 10).length}",
  "readOnly": true
}
```

**Result:** `1` (only Gadget with price 20 > 10)

### 7. Date Formatting

**Schema:**
```json
{
  "type": "text",
  "name": "invoiceDate",
  "content": "Invoice Date: {date}",
  "readOnly": true
}
```

**Result:** `Invoice Date: 2026/02/18`

### 8. Page Information

**Schema (StaticSchema):**
```json
{
  "type": "text",
  "name": "pageInfo",
  "content": "Page {currentPage} of {totalPages}",
  "readOnly": true
}
```

**Result:** `Page 1 of 3`

---

## Variable Context

When expressions are evaluated, the following variables are available:

### 1. Built-in Variables
```javascript
date              // ISO date: YYYY/MM/DD
dateTime          // ISO datetime: YYYY/MM/DD HH:mm
currentPage       // Integer: 1, 2, 3, ...
totalPages        // Integer: total number of pages
```

### 2. Input Variables
All variables passed during PDF generation:
```javascript
{
  "orders": [...],
  "subtotal": "110",
  "taxRate": "10",
  "customerName": "John Doe"
}
```

### 3. Schema References
All `readOnly: true` schema fields can be referenced by name:
```javascript
{name}            // References schema field "name"
{subtotal}        // References previously calculated subtotal
{tax}             // References previously calculated tax
```

### 4. Nested Access
```javascript
{orders[0]}           // First order array
{customer.name}       // Nested object property
{items[2].price}      // Nested property in array element
```

---

## How to Add Expressions via Designer

### Step 1: Open Designer
1. Navigate to the Designer route
2. Create or load a template

### Step 2: Add a Text Field
1. Drag **Text** icon from left sidebar to canvas
2. Position the field

### Step 3: Make Field Read-Only
1. Select the text field on canvas
2. In the right sidebar (DetailView), find the **readOnly** checkbox
3. **Check** the readOnly checkbox

### Step 4: Enter Expression in Content
1. With the field still selected, find the **content** field in right sidebar
2. Enter your expression with curly braces: `{expression}`
3. Example: `{Number(subtotal) + Number(tax)}`

### Step 5: Add Required Input Fields
1. Make sure your template has all required input fields
2. Example: Add separate fields for "subtotal" and "tax" inputs

### Step 6: Test in Template Tester
1. Click **Test Template** button in navbar
2. Enter values for input fields (subtotal, tax)
3. Watch the expression field auto-update with calculated result
4. Click **Generate PDF** to see it rendered

### Step 7: Use in Generation
When generating PDFs programmatically:
```javascript
const pdf = await generate({
  template: myTemplate,
  inputs: [{
    subtotal: "110",
    tax: "11",
    // readOnly fields are calculated automatically
  }],
  options: { font, lang: 'en' },
  plugins: getPlugins()
});
```

---

## Schema Examples

### Complete Invoice Schema
```json
{
  "schemas": [[
    // Input fields
    {
      "name": "subtotalInput",
      "type": "text",
      "position": { "x": 10, "y": 50 },
      "width": 100,
      "height": 20
    },
    {
      "name": "taxRateInput",
      "type": "text",
      "position": { "x": 10, "y": 80 },
      "width": 100,
      "height": 20
    },
    // Calculated fields (readOnly with expressions)
    {
      "name": "tax",
      "type": "text",
      "position": { "x": 150, "y": 80 },
      "width": 100,
      "height": 20,
      "content": "{Number(subtotalInput) * Number(taxRateInput) / 100}",
      "readOnly": true
    },
    {
      "name": "total",
      "type": "text",
      "position": { "x": 150, "y": 110 },
      "width": 100,
      "height": 20,
      "content": "{Number(subtotalInput) + Number(tax)}",
      "readOnly": true
    }
  ]],
  "basePdf": {
    "width": 210,
    "height": 297,
    "padding": [10, 10, 10, 10]
  }
}
```

### Using StaticSchema for Headers/Footers
```json
{
  "staticSchemas": [
    {
      "name": "pageNumber",
      "type": "text",
      "position": { "x": 180, "y": 270 },
      "width": 20,
      "height": 10,
      "content": "Page {currentPage}",
      "readOnly": true
    },
    {
      "name": "generatedDate",
      "type": "text",
      "position": { "x": 10, "y": 270 },
      "width": 100,
      "height": 10,
      "content": "Generated: {dateTime}",
      "readOnly": true
    }
  ],
  "schemas": [[ /* ... */ ]],
  "basePdf": { /* ... */ }
}
```

---

## Security Features

### 1. AST Validation
- Expressions are parsed using Acorn parser
- Generated AST is validated against whitelist of allowed node types
- Unknown nodes are rejected
- Recursive validation prevents nested injection

### 2. Sandboxed Evaluation
- No `eval()` or `Function()` constructor
- Only whitelisted globals available
- Custom evaluation function interprets validated AST
- Context isolated from browser/Node globals

### 3. Prototype Pollution Prevention
- `__proto__`, `constructor`, `prototype` blocked
- `Object.assign()` uses safe assignment
- Dangerous Object methods blocked

### 4. Safe Method Calls
```javascript
// ✅ ALLOWED
Object.keys(obj)
Object.values(obj)
Object.entries(obj)
Object.fromEntries(entries)

// ❌ BLOCKED
Object.defineProperty(obj, 'prop', desc)
Object.setPrototypeOf(obj, proto)
```

### 5. Error Handling
- Invalid expressions silently fail
- Returns original placeholder instead of throwing
- No error messages exposed to user

### 6. Performance
- Expressions cached after first compilation
- Two-level caching: parsed AST + evaluated data
- No re-parsing on repeated use

---

## Troubleshooting

### Expression Not Evaluating
**Problem:** Field shows `{expression}` instead of result

**Solutions:**
1. ✅ Check field has `readOnly: true`
2. ✅ Verify expression syntax is valid
3. ✅ Check all referenced variables exist in input
4. ✅ Test expression in Template Tester

### "Undefined" Result
**Problem:** Expression evaluates to `undefined`

**Solutions:**
1. ✅ Check variable names match exactly (case-sensitive)
2. ✅ Use proper null coalescing: `{value || 0}`
3. ✅ Add fallback: `{Number(price) || 0}`

### Can't Reference Schema Field
**Problem:** `{fieldName}` doesn't work

**Solutions:**
1. ✅ Make source field `readOnly: true`
2. ✅ Make sure source field comes BEFORE referencing field
3. ✅ Use correct field name (case-sensitive)

---

## Best Practices

1. **Keep Expressions Simple** - Long expressions are hard to maintain
2. **Use Meaningful Names** - Name fields clearly (e.g., `subtotalInput`, not `value`)
3. **Add Fallbacks** - Use `|| 0` for optional values
4. **Test First** - Always test in Template Tester before deploying
5. **Document Calculations** - Add comments in expression for complex logic
6. **Order Dependencies** - Reference fields should come after source fields
7. **Type Convert** - Always convert to proper types: `Number(value)`, `String(value)`

---

## Examples for Common Use Cases

### Discount Calculation
```javascript
{Math.round(subtotal * discountPercent / 100 * 100) / 100}
```

### Percentage Display
```javascript
{Math.round(count / total * 100)}%
```

### Word Count
```javascript
{description.split(' ').length}
```

### Price Formatting
```javascript
${Number(price).toFixed(2)}
```

### List Length
```javascript
{items.length} items
```

### Conditional Message
```javascript
{total > 1000 ? 'Premium Customer' : 'Regular Customer'}
```

---

## Links & References

- **Expression Engine:** `packages/common/src/expression.ts`
- **Test Examples:** `packages/common/__tests__/expression.test.ts`
- **Generator:** `packages/generator/src/generate.ts`
- **Real Templates:** `playground/public/template-assets/`

---

Last Updated: 2026-02-18
