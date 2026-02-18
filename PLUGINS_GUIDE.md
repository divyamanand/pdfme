# PDFme Plugins Guide

Complete reference guide for all PDFme plugins available in the Designer left sidebar. Each plugin includes schema definition, input data examples, and real-world use cases.

---

## Table of Contents

1. [Text](#text)
2. [Expression Field](#expression-field)
3. [Multi-Variable Text](#multi-variable-text)
4. [Image](#image)
5. [SVG](#svg)
6. [QR Code](#qr-code)
7. [Code128 Barcode](#code128-barcode)
8. [Table](#table)
9. [Nested Table](#nested-table)
10. [Line](#line)
11. [Rectangle](#rectangle)
12. [Ellipse](#ellipse)
13. [Signature](#signature)
14. [Date/Time Plugins](#datetime-plugins)
    - [DateTime](#datetime)
    - [Date](#date)
    - [Time](#time)
15. [Select](#select)
16. [Checkbox](#checkbox)
17. [Radio Group](#radio-group)

---

## Text

Simple text field for static and dynamic content. Supports styling, alignment, and font customization.

### Use Cases
- Invoice headers and titles
- Product names
- Descriptive content
- Labels and form titles
- Customer names and details

### Schema Definition

```typescript
interface TextSchema extends Schema {
  type: 'text';
  content: string;              // Text content (can use {variable} for dynamic content)
  fontName?: string;            // Font family name
  fontSize: number;             // Font size in pixels (e.g., 12)
  alignment: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  fontColor: string;            // Hex color (e.g., '#000000')
  backgroundColor: string;      // Hex color or empty string
  lineHeight: number;           // Line height multiplier (e.g., 1.5)
  characterSpacing: number;     // Space between characters in points
  strikethrough?: boolean;
  underline?: boolean;
  dynamicFontSize?: {
    min: number;               // Minimum font size
    max: number;               // Maximum font size
    fit: 'horizontal' | 'vertical';  // Shrink to fit
  };
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "text",
        "name": "customerName",
        "position": { "x": 20, "y": 30 },
        "width": 150,
        "height": 10,
        "fontSize": 14,
        "fontColor": "#000000",
        "backgroundColor": "",
        "alignment": "left",
        "verticalAlignment": "top",
        "content": "{name}",
        "lineHeight": 1,
        "characterSpacing": 0
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "name": "John Doe"
}
```

---

## Expression Field

Dynamic calculated field that evaluates JavaScript expressions. Perfect for math operations, conditionals, and complex calculations.

### Use Cases
- Invoice total calculations
- Tax calculations
- Discount applications
- Conditional text based on values
- Price per unit × quantity
- Percentage-based computations

### Schema Definition

```typescript
interface ExpressionFieldSchema extends Schema {
  type: 'expressionField';
  content: string;              // Expression wrapped in braces: {Number(price) * qty}
  readOnly: true;               // Always true - calculated automatically
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  characterSpacing: number;
  fontName?: string;
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "expressionField",
        "name": "totalPrice",
        "position": { "x": 120, "y": 150 },
        "width": 50,
        "height": 10,
        "fontSize": 12,
        "fontColor": "#000000",
        "backgroundColor": "",
        "alignment": "right",
        "verticalAlignment": "top",
        "content": "{Number(price) * Number(quantity)}",
        "readOnly": true,
        "lineHeight": 1,
        "characterSpacing": 0
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "price": "50.00",
  "quantity": "3"
}
```

### Available Built-in Variables

- `date` - Current date (format: YYYY/MM/DD)
- `dateTime` - Current date and time
- `currentPage` - Current page number
- `totalPages` - Total number of pages
- `Math` - Global Math object (Math.round, Math.floor, etc.)
- `Number`, `String`, `Boolean` - Global constructors

### Expression Examples

```javascript
// Basic multiplication
{Number(price) * Number(quantity)}

// Conditional text
{Number(total) > 100 ? "Premium Customer" : "Regular Customer"}

// Tax calculation
{Math.round(Number(subtotal) * 0.1 * 100) / 100}

// Discount application
{Number(originalPrice) * (1 - Number(discountPercent) / 100)}

// String concatenation
{String(firstName) + " " + String(lastName)}

// Rounding
{Math.round(Number(value) * 100) / 100}
```

---

## Multi-Variable Text

Text field that supports multiple variable substitutions using placeholder syntax `{variableName}`.

### Use Cases
- Letters with personalization
- Detailed customer information
- Product descriptions with variables
- Address formatting
- Mixed static and dynamic content

### Schema Definition

```typescript
interface MultiVariableTextSchema extends Schema {
  type: 'multiVariableText';
  content: string;              // Text with {variable} placeholders
  fontName?: string;
  fontSize: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  fontColor: string;
  backgroundColor: string;
  lineHeight: number;
  characterSpacing: number;
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "multiVariableText",
        "name": "greetingText",
        "position": { "x": 20, "y": 60 },
        "width": 170,
        "height": 20,
        "fontSize": 12,
        "fontColor": "#000000",
        "backgroundColor": "",
        "alignment": "left",
        "verticalAlignment": "top",
        "content": "Dear {firstName} {lastName},\n\nThank you for your purchase of {productName}. Your order #{orderNumber} has been confirmed.",
        "lineHeight": 1.5,
        "characterSpacing": 0
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "productName": "Wireless Headphones",
  "orderNumber": "ORD-2024-001"
}
```

---

## Image

Insert and display images (PNG, JPG, JPEG, GIF) with scaling and positioning options.

### Use Cases
- Company logos
- Product images
- QR codes (alternative to QR plugin)
- Signatures (alternative to Signature plugin)
- Invoice headers with images
- Product thumbnails

### Schema Definition

```typescript
interface ImageSchema extends Schema {
  type: 'image';
  content: string;              // Base64 data URL of image (data:image/png;base64,...)
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "image",
        "name": "logoImage",
        "position": { "x": 20, "y": 10 },
        "width": 40,
        "height": 15
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "logoImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### How to Convert Image to Base64

```javascript
// Using FileReader in browser
const file = fileInput.files[0];
const reader = new FileReader();
reader.onload = (e) => {
  const base64 = e.target.result; // Use this in your data
};
reader.readAsDataURL(file);
```

---

## SVG

Embed and display SVG graphics with full vector support.

### Use Cases
- Complex icons and graphics
- Custom badges and seals
- Watermarks
- Decorative elements
- Dynamic vector graphics

### Schema Definition

```typescript
interface SVGSchema extends Schema {
  type: 'svg';
  content: string;              // SVG code as string or base64 data URL
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "svg",
        "name": "badgeSvg",
        "position": { "x": 150, "y": 10 },
        "width": 30,
        "height": 30,
        "content": "<svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"40\" fill=\"#FF6B6B\"/></svg>"
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "badgeSvg": "<svg viewBox=\"0 0 100 100\"><text x=\"50\" y=\"55\" text-anchor=\"middle\" fill=\"white\">VERIFIED</text></svg>"
}
```

---

## QR Code

Generate and display QR codes from text or URLs.

### Use Cases
- Product tracking
- Website URLs on invoices
- Payment links
- Document verification
- Contactless information sharing
- Inventory management

### Schema Definition

```typescript
interface QRCodeSchema extends Schema {
  type: 'qrcode';
  content: string;              // Text/URL to encode in QR code
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "qrcode",
        "name": "trackingQR",
        "position": { "x": 150, "y": 250 },
        "width": 40,
        "height": 40,
        "content": "{trackingUrl}"
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "trackingUrl": "https://example.com/track?id=ORD-2024-001"
}
```

---

## Code128 Barcode

Generate Code128 format barcodes for inventory and tracking.

### Use Cases
- Product barcodes
- Shipping labels
- Inventory tracking
- Warehouse management
- Package identification

### Schema Definition

```typescript
interface Code128Schema extends Schema {
  type: 'code128';
  content: string;              // Text to encode in barcode
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "code128",
        "name": "barcodeField",
        "position": { "x": 20, "y": 280 },
        "width": 80,
        "height": 10,
        "content": "{sku}"
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "sku": "SKU-12345-67890"
}
```

---

## Table

Display tabular data with headers, styling, and formatting options.

### Use Cases
- Invoice line items
- Product lists
- Order details
- Financial statements
- Data summaries
- Expense reports

### Schema Definition

```typescript
interface TableSchema extends Schema {
  type: 'table';
  showHead: boolean;            // Show table header
  head: string[];               // Column headers
  headWidthPercentages: number[]; // Column width percentages
  repeatHead?: boolean;         // Repeat header on multiple pages
  tableStyles: {
    borderColor: string;
    borderWidth: number;
  };
  headStyles: CellStyle;        // Header styling
  bodyStyles: CellStyle & {
    alternateBackgroundColor: string;
  };
  columnStyles?: {
    alignment?: { [colIndex: number]: 'left' | 'center' | 'right' };
  };
}

interface CellStyle {
  fontName?: string;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  fontSize: number;
  lineHeight: number;
  characterSpacing: number;
  fontColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "table",
        "name": "itemsTable",
        "position": { "x": 20, "y": 100 },
        "width": 170,
        "height": 100,
        "showHead": true,
        "head": ["Item", "Quantity", "Unit Price", "Total"],
        "headWidthPercentages": [40, 20, 20, 20],
        "tableStyles": {
          "borderColor": "#000000",
          "borderWidth": 1
        },
        "headStyles": {
          "alignment": "center",
          "verticalAlignment": "middle",
          "fontSize": 12,
          "fontColor": "#FFFFFF",
          "backgroundColor": "#333333",
          "borderColor": "#000000",
          "borderWidth": { "top": 1, "right": 1, "bottom": 1, "left": 1 },
          "padding": { "top": 5, "right": 5, "bottom": 5, "left": 5 },
          "lineHeight": 1,
          "characterSpacing": 0
        },
        "bodyStyles": {
          "alignment": "left",
          "verticalAlignment": "middle",
          "fontSize": 10,
          "fontColor": "#000000",
          "backgroundColor": "#FFFFFF",
          "alternateBackgroundColor": "#F5F5F5",
          "borderColor": "#CCCCCC",
          "borderWidth": { "top": 1, "right": 1, "bottom": 1, "left": 1 },
          "padding": { "top": 4, "right": 4, "bottom": 4, "left": 4 },
          "lineHeight": 1,
          "characterSpacing": 0
        }
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "itemsTable": "Item1,Qty1,Price1,Total1|Item2,Qty2,Price2,Total2"
}
```

Or with structured format:

```json
{
  "itemsTable": [
    ["Laptop", "1", "$800.00", "$800.00"],
    ["Mouse", "2", "$25.00", "$50.00"],
    ["Keyboard", "1", "$75.00", "$75.00"]
  ]
}
```

---

## Nested Table

Advanced table with hierarchical header structure and multi-level column grouping.

### Use Cases
- Complex financial reports
- Hierarchical data tables
- Multi-year comparisons
- Department-based summaries
- Regional sales breakdowns

### Schema Definition

```typescript
interface NestedTableSchema extends Schema {
  type: 'nestedTable';
  headerTree: NestedHeaderNode[];
  showHead: boolean;
  repeatHead?: boolean;
  tableStyles: { borderColor: string; borderWidth: number };
  headStyles: CellStyle;
  bodyStyles: CellStyle & { alternateBackgroundColor: string };
  columnStyles?: {
    alignment?: { [leafColIndex: number]: 'left' | 'center' | 'right' };
  };
}

interface NestedHeaderNode {
  id: string;
  label: string;
  children: NestedHeaderNode[];
  width?: number;
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "nestedTable",
        "name": "salesTable",
        "position": { "x": 20, "y": 100 },
        "width": 170,
        "height": 120,
        "showHead": true,
        "repeatHead": true,
        "headerTree": [
          {
            "id": "root-sales",
            "label": "Sales Data",
            "children": [
              {
                "id": "2023",
                "label": "2023",
                "children": [
                  { "id": "2023-q1", "label": "Q1", "children": [] },
                  { "id": "2023-q2", "label": "Q2", "children": [] }
                ]
              },
              {
                "id": "2024",
                "label": "2024",
                "children": [
                  { "id": "2024-q1", "label": "Q1", "children": [] },
                  { "id": "2024-q2", "label": "Q2", "children": [] }
                ]
              }
            ]
          }
        ],
        "tableStyles": { "borderColor": "#000000", "borderWidth": 1 },
        "headStyles": {
          "alignment": "center",
          "verticalAlignment": "middle",
          "fontSize": 11,
          "fontColor": "#FFFFFF",
          "backgroundColor": "#333333",
          "borderColor": "#000000",
          "borderWidth": { "top": 1, "right": 1, "bottom": 1, "left": 1 },
          "padding": { "top": 4, "right": 4, "bottom": 4, "left": 4 },
          "lineHeight": 1,
          "characterSpacing": 0
        },
        "bodyStyles": {
          "alignment": "right",
          "verticalAlignment": "middle",
          "fontSize": 10,
          "fontColor": "#000000",
          "backgroundColor": "#FFFFFF",
          "alternateBackgroundColor": "#F5F5F5",
          "borderColor": "#CCCCCC",
          "borderWidth": { "top": 1, "right": 1, "bottom": 1, "left": 1 },
          "padding": { "top": 4, "right": 4, "bottom": 4, "left": 4 },
          "lineHeight": 1,
          "characterSpacing": 0
        }
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "salesTable": "100|150|200|250"
}
```

---

## Line

Draw horizontal or vertical lines for visual separation and design elements.

### Use Cases
- Page dividers
- Section separators
- Design elements
- Visual hierarchy
- Document structure

### Schema Definition

```typescript
interface LineSchema extends Schema {
  type: 'line';
  content: string;              // "horizontal" or "vertical"
  color: string;                // Line color (hex)
  width: number;                // Line thickness in pixels
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "line",
        "name": "divider1",
        "position": { "x": 20, "y": 80 },
        "width": 170,
        "height": 1,
        "content": "horizontal"
      }
    ]
  ]
}
```

### Input Data Example

```json
{}
```

(No input data needed for lines)

---

## Rectangle

Draw rectangles with customizable borders and fill colors.

### Use Cases
- Highlight boxes
- Background panels
- Button-like elements
- Content containers
- Visual grouping

### Schema Definition

```typescript
interface RectangleSchema extends Schema {
  type: 'rectangle';
  color: string;                // Fill color (hex)
  borderColor: string;          // Border color (hex)
  borderWidth: number;          // Border thickness in pixels
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "rectangle",
        "name": "highlightBox",
        "position": { "x": 20, "y": 200 },
        "width": 170,
        "height": 30,
        "color": "#FFFFCC",
        "borderColor": "#FF6B6B",
        "borderWidth": 2
      }
    ]
  ]
}
```

### Input Data Example

```json
{}
```

(No input data needed for rectangles)

---

## Ellipse

Draw circles and ellipses with customizable colors and borders.

### Use Cases
- Badge backgrounds
- Decorative elements
- Bullet points
- Icons
- Checkmark backgrounds

### Schema Definition

```typescript
interface EllipseSchema extends Schema {
  type: 'ellipse';
  color: string;                // Fill color (hex)
  borderColor: string;          // Border color (hex)
  borderWidth: number;          // Border thickness in pixels
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "ellipse",
        "name": "badge",
        "position": { "x": 160, "y": 15 },
        "width": 20,
        "height": 20,
        "color": "#FF6B6B",
        "borderColor": "#CC0000",
        "borderWidth": 1
      }
    ]
  ]
}
```

### Input Data Example

```json
{}
```

(No input data needed for ellipses)

---

## Signature

Capture and display digital signatures or handwritten marks.

### Use Cases
- Document authorization
- Agreement signatures
- Approval marks
- Authorization proof
- Legal documents

### Schema Definition

```typescript
interface SignatureSchema extends Schema {
  type: 'signature';
  content: string;              // Base64 PNG image of signature
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "signature",
        "name": "customerSignature",
        "position": { "x": 20, "y": 260 },
        "width": 80,
        "height": 20
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "customerSignature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

## DateTime Plugins

Date and time field plugins for displaying formatted dates and times. These appear in a dropdown menu in the designer.

### DateTime

Display complete date and time in a single field.

#### Use Cases
- Document creation timestamps
- Invoice dates with time
- Event scheduling
- Transaction records
- Report generation time

#### Schema Definition

```typescript
interface DateTimeSchema extends Schema {
  type: 'dateTime';
  format: string;               // Date format string (e.g., "YYYY/MM/DD HH:mm:ss")
  fontName?: string;
  fontSize: number;
  alignment: 'left' | 'center' | 'right';
  fontColor: string;
  backgroundColor: string;
  locale?: string;              // Locale code (e.g., 'en-US', 'ja-JP')
  characterSpacing: number;
}
```

#### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "dateTime",
        "name": "issueDateTime",
        "position": { "x": 120, "y": 30 },
        "width": 70,
        "height": 8,
        "format": "YYYY/MM/DD HH:mm",
        "fontSize": 10,
        "alignment": "right",
        "fontColor": "#000000",
        "backgroundColor": "",
        "characterSpacing": 0
      }
    ]
  ]
}
```

#### Input Data Example

```json
{}
```

(No input needed - uses current date/time)

---

### Date

Display date only without time.

#### Use Cases
- Invoice dates
- Bill dates
- Expiration dates
- Birth dates
- Document effective dates

#### Schema Definition

```typescript
interface DateSchema extends Schema {
  type: 'date';
  format: string;               // Date format (e.g., "YYYY/MM/DD" or "DD/MM/YYYY")
  fontName?: string;
  fontSize: number;
  alignment: 'left' | 'center' | 'right';
  fontColor: string;
  backgroundColor: string;
  locale?: string;
  characterSpacing: number;
}
```

#### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "date",
        "name": "invoiceDate",
        "position": { "x": 20, "y": 50 },
        "width": 50,
        "height": 8,
        "format": "YYYY/MM/DD",
        "fontSize": 11,
        "alignment": "left",
        "fontColor": "#000000",
        "backgroundColor": "",
        "characterSpacing": 0
      }
    ]
  ]
}
```

#### Input Data Example

```json
{}
```

(No input needed - uses current date)

---

### Time

Display time only without date.

#### Use Cases
- Appointment times
- Delivery time windows
- Session start times
- Timestamp logs
- Schedule information

#### Schema Definition

```typescript
interface TimeSchema extends Schema {
  type: 'time';
  format: string;               // Time format (e.g., "HH:mm:ss" or "HH:mm")
  fontName?: string;
  fontSize: number;
  alignment: 'left' | 'center' | 'right';
  fontColor: string;
  backgroundColor: string;
  characterSpacing: number;
}
```

#### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "time",
        "name": "appointmentTime",
        "position": { "x": 120, "y": 100 },
        "width": 30,
        "height": 8,
        "format": "HH:mm",
        "fontSize": 10,
        "alignment": "left",
        "fontColor": "#000000",
        "backgroundColor": "",
        "characterSpacing": 0
      }
    ]
  ]
}
```

#### Input Data Example

```json
{}
```

(No input needed - uses current time)

---

## Select

Dropdown selection field for choosing from predefined options.

### Use Cases
- Payment methods
- Shipping options
- Product categories
- Priority levels
- Status selections
- Form selections

### Schema Definition

```typescript
interface SelectSchema extends Schema {
  type: 'select';
  content: string;              // Currently selected option
  options: string[];            // Available options
  fontName?: string;
  fontSize: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'top' | 'middle' | 'bottom';
  fontColor: string;
  backgroundColor: string;
  lineHeight: number;
  characterSpacing: number;
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "select",
        "name": "shippingMethod",
        "position": { "x": 20, "y": 150 },
        "width": 80,
        "height": 10,
        "content": "Standard",
        "options": ["Standard", "Express", "Overnight", "Pickup"],
        "fontSize": 11,
        "alignment": "left",
        "verticalAlignment": "middle",
        "fontColor": "#000000",
        "backgroundColor": "#FFFFFF",
        "lineHeight": 1,
        "characterSpacing": 0
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "shippingMethod": "Express"
}
```

---

## Checkbox

Boolean input field displayed as a checkbox.

### Use Cases
- Agreement acknowledgments
- Feature selections
- Yes/No questions
- Preferences
- Terms acceptance

### Schema Definition

```typescript
interface CheckboxSchema extends Schema {
  type: 'checkbox';
  content: string;              // "true" or "false"
  fontColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "checkbox",
        "name": "termsAgreed",
        "position": { "x": 20, "y": 180 },
        "width": 5,
        "height": 5,
        "content": "false",
        "fontColor": "#000000",
        "backgroundColor": "#FFFFFF",
        "borderColor": "#000000",
        "borderWidth": 1
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "termsAgreed": "true"
}
```

---

## Radio Group

Radio button group for selecting one option from multiple choices.

### Use Cases
- Membership levels
- Service tiers
- Contact preferences
- Delivery options
- Subscription plans

### Schema Definition

```typescript
interface RadioGroupSchema extends Schema {
  type: 'radioGroup';
  content: string;              // Selected radio value
  group: string;                // Radio group identifier
  fontColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}
```

### Template Example

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [0, 0, 0, 0] },
  "schemas": [
    [
      {
        "type": "radioGroup",
        "name": "membershipBasic",
        "position": { "x": 20, "y": 200 },
        "width": 5,
        "height": 5,
        "content": "",
        "group": "membership",
        "fontColor": "#000000",
        "backgroundColor": "#FFFFFF",
        "borderColor": "#000000",
        "borderWidth": 1
      },
      {
        "type": "radioGroup",
        "name": "membershipPremium",
        "position": { "x": 20, "y": 210 },
        "width": 5,
        "height": 5,
        "content": "premium",
        "group": "membership",
        "fontColor": "#000000",
        "backgroundColor": "#FFFFFF",
        "borderColor": "#000000",
        "borderWidth": 1
      }
    ]
  ]
}
```

### Input Data Example

```json
{
  "membershipBasic": "",
  "membershipPremium": "premium"
}
```

---

## Plugin Combinations - Real World Examples

### Invoice Template

Combines multiple plugins to create a complete invoice.

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [10, 10, 10, 10] },
  "schemas": [
    [
      {
        "type": "image",
        "name": "logo",
        "position": { "x": 20, "y": 10 },
        "width": 40,
        "height": 15
      },
      {
        "type": "text",
        "name": "invoiceTitle",
        "position": { "x": 120, "y": 20 },
        "width": 70,
        "height": 10,
        "fontSize": 18,
        "fontColor": "#000000",
        "content": "INVOICE",
        "alignment": "right"
      },
      {
        "type": "date",
        "name": "invoiceDate",
        "position": { "x": 120, "y": 35 },
        "width": 70,
        "height": 8,
        "fontSize": 10,
        "format": "YYYY/MM/DD",
        "alignment": "right"
      },
      {
        "type": "multiVariableText",
        "name": "billTo",
        "position": { "x": 20, "y": 60 },
        "width": 90,
        "height": 30,
        "fontSize": 10,
        "content": "Bill To:\n{customerName}\n{customerAddress}\n{customerCity}, {customerZip}"
      },
      {
        "type": "table",
        "name": "lineItems",
        "position": { "x": 20, "y": 100 },
        "width": 170,
        "height": 80,
        "showHead": true,
        "head": ["Item", "Qty", "Unit Price", "Total"],
        "headWidthPercentages": [40, 20, 20, 20]
      },
      {
        "type": "text",
        "name": "subtotalLabel",
        "position": { "x": 120, "y": 190 },
        "width": 30,
        "height": 8,
        "fontSize": 10,
        "content": "Subtotal:"
      },
      {
        "type": "expressionField",
        "name": "subtotal",
        "position": { "x": 155, "y": 190 },
        "width": 35,
        "height": 8,
        "fontSize": 10,
        "content": "{subtotalAmount}",
        "alignment": "right"
      },
      {
        "type": "text",
        "name": "taxLabel",
        "position": { "x": 120, "y": 200 },
        "width": 30,
        "height": 8,
        "fontSize": 10,
        "content": "Tax (10%):"
      },
      {
        "type": "expressionField",
        "name": "tax",
        "position": { "x": 155, "y": 200 },
        "width": 35,
        "height": 8,
        "fontSize": 10,
        "content": "{Math.round(subtotalAmount * 0.1 * 100) / 100}",
        "alignment": "right"
      },
      {
        "type": "line",
        "name": "divider",
        "position": { "x": 120, "y": 212 },
        "width": 70,
        "height": 1
      },
      {
        "type": "text",
        "name": "totalLabel",
        "position": { "x": 120, "y": 215 },
        "width": 30,
        "height": 10,
        "fontSize": 12,
        "fontColor": "#000000",
        "content": "TOTAL:",
        "alignment": "right"
      },
      {
        "type": "expressionField",
        "name": "totalAmount",
        "position": { "x": 155, "y": 215 },
        "width": 35,
        "height": 10,
        "fontSize": 12,
        "fontColor": "#FF6B6B",
        "content": "{Math.round((Number(subtotalAmount) + Math.round(Number(subtotalAmount) * 0.1 * 100) / 100) * 100) / 100}",
        "alignment": "right"
      },
      {
        "type": "qrcode",
        "name": "paymentQR",
        "position": { "x": 20, "y": 250 },
        "width": 30,
        "height": 30,
        "content": "{paymentLink}"
      }
    ]
  ]
}
```

### Shipment Label Template

```json
{
  "basePdf": { "width": 210, "height": 297, "padding": [5, 5, 5, 5] },
  "schemas": [
    [
      {
        "type": "rectangle",
        "name": "headerBg",
        "position": { "x": 5, "y": 5 },
        "width": 200,
        "height": 20,
        "color": "#003366",
        "borderColor": "#000000",
        "borderWidth": 2
      },
      {
        "type": "text",
        "name": "shippingLabel",
        "position": { "x": 10, "y": 8 },
        "width": 190,
        "height": 15,
        "fontSize": 16,
        "fontColor": "#FFFFFF",
        "content": "SHIPPING LABEL",
        "alignment": "center"
      },
      {
        "type": "multiVariableText",
        "name": "fromAddress",
        "position": { "x": 10, "y": 30 },
        "width": 90,
        "height": 25,
        "fontSize": 9,
        "content": "FROM:\n{senderName}\n{senderStreet}\n{senderCity}, {senderState} {senderZip}"
      },
      {
        "type": "multiVariableText",
        "name": "toAddress",
        "position": { "x": 110, "y": 30 },
        "width": 90,
        "height": 25,
        "fontSize": 11,
        "content": "TO:\n{recipientName}\n{recipientStreet}\n{recipientCity}, {recipientState} {recipientZip}"
      },
      {
        "type": "code128",
        "name": "trackingBarcode",
        "position": { "x": 20, "y": 70 },
        "width": 170,
        "height": 15,
        "content": "{trackingNumber}"
      },
      {
        "type": "text",
        "name": "trackingLabel",
        "position": { "x": 20, "y": 87 },
        "width": 170,
        "height": 5,
        "fontSize": 8,
        "alignment": "center",
        "content": "Tracking: {trackingNumber}"
      },
      {
        "type": "select",
        "name": "shippingService",
        "position": { "x": 20, "y": 100 },
        "width": 80,
        "height": 10,
        "content": "Ground",
        "options": ["Ground", "Express", "Overnight", "International"]
      },
      {
        "type": "text",
        "name": "weightLabel",
        "position": { "x": 110, "y": 100 },
        "width": 30,
        "height": 10,
        "fontSize": 10,
        "content": "Weight: {weight} lbs"
      },
      {
        "type": "checkbox",
        "name": "signatureRequired",
        "position": { "x": 20, "y": 120 },
        "width": 5,
        "height": 5,
        "content": "{requireSignature}"
      },
      {
        "type": "text",
        "name": "signatureText",
        "position": { "x": 28, "y": 120 },
        "width": 50,
        "height": 5,
        "fontSize": 9,
        "content": "Signature Required"
      },
      {
        "type": "rectangle",
        "name": "barcodeBox",
        "position": { "x": 20, "y": 140 },
        "width": 170,
        "height": 50,
        "color": "#FFFFFF",
        "borderColor": "#000000",
        "borderWidth": 2
      },
      {
        "type": "qrcode",
        "name": "trackingQR",
        "position": { "x": 100, "y": 155 },
        "width": 40,
        "height": 40,
        "content": "https://track.example.com/{trackingNumber}"
      }
    ]
  ]
}
```

---

## Tips and Best Practices

### Variable Naming
- Use descriptive, camelCase names: `customerFirstName`, `invoiceTotal`
- Avoid special characters and spaces
- Match variable names between schema and input data exactly

### Dynamic Content
- Use curly braces `{variableName}` for single variables
- Use `{expression}` syntax in Expression Fields for calculations
- For calculations, always use `Number()` to ensure proper type conversion

### Font and Color Management
- Use 6-digit hex color codes: `#FF6B6B`
- Ensure sufficient contrast for readability
- Test font rendering with actual content

### Table Data Format
- Use pipe `|` to separate rows
- Use comma `,` to separate columns
- Example: `Item1,Qty1,Price1|Item2,Qty2,Price2`

### Image and Signature Handling
- Always use Base64 data URLs: `data:image/png;base64,...`
- Convert images to Base64 on the client side before submitting
- Test image dimensions to prevent distortion

### Page Management
- Use `staticSchemas` for content that appears on every page
- Set `repeatHead: true` for tables spanning multiple pages
- Monitor content height to prevent overflow

### Responsive Design
- Position fields based on percentage-based layout
- Test with various PDF dimensions
- Use relative positioning for flexible layouts

---

## Common Patterns and Workflows

### Creating a Dynamic Invoice

1. **Add Text Fields** for company info and invoice number
2. **Add Date Fields** for issue and due dates
3. **Add Expression Fields** for calculations (totals, taxes)
4. **Add a Table** for line items
5. **Add a QR Code** for payment or tracking
6. **Test with Template Tester** before generating

### Form-Based Documents

1. **Add Text Fields** for instructions
2. **Add Select Fields** for options
3. **Add Checkbox Fields** for selections
4. **Add Radio Groups** for mutually exclusive options
5. **Add Signature Field** for authorization
6. **Set readOnly: false** for form fields

### Data-Heavy Reports

1. **Use Tables** for organized data
2. **Add Expression Fields** for calculated columns
3. **Use Nested Tables** for hierarchical data
4. **Add Line Separators** for visual clarity
5. **Test with large datasets** before production

---

## Troubleshooting Common Issues

### Variables Not Showing
- Check that variable names in template match input data exactly
- Ensure braces are correctly formatted: `{variableName}`
- Verify no typos in field names

### Expression Field Not Calculating
- Ensure expression is wrapped in braces: `{expression}`
- Use `Number()` for numeric variables: `Number(price)`
- Test expression syntax in browser console first

### Table Data Not Displaying
- Format data with correct separators: `row1,col1|row2,col1`
- Ensure number of columns matches header definition
- Check table dimensions aren't too small

### Image Not Showing
- Verify Base64 data URL format: `data:image/format;base64,...`
- Check image file size (large images slow down generation)
- Test image in browser first

### PDF Generation Timeout
- Reduce number of complex calculations
- Optimize image sizes and compression
- Break large tables into multiple smaller tables
- Use simpler expressions where possible

---

## Additional Resources

For more information on specific plugins and advanced features:
- PDFme Documentation: https://pdfme.dev/
- Expression Language Guide: See Expression Field section
- Dynamic Heights and Page Breaking: See Table and Nested Table sections

