# PDFme Server Deployment Guide

## Overview

This guide explains how to deploy PDFme PDF generation on a server and send input data to generate PDFs programmatically.

## Basic Server Setup

### Node.js Example

```javascript
import { generate } from '@pdfme/generator';
import express from 'express';

const app = express();
app.use(express.json());

app.post('/generate-pdf', async (req, res) => {
  try {
    const { template, inputs } = req.body;

    const pdf = await generate({
      template,
      inputs,
      options: { font: { /* font config */ } }
    });

    res.contentType('application/pdf');
    res.send(Buffer.from(pdf));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('PDFme server running on port 3000'));
```

### Python Example

```python
import requests
import json

url = 'http://localhost:3000/generate-pdf'
data = {
  'template': template_json,
  'inputs': [input_data]
}

response = requests.post(url, json=data)
if response.status_code == 200:
  with open('output.pdf', 'wb') as f:
    f.write(response.content)
```

---

## Input Data Format

Input data is a **flat object** where keys match schema field names (the `name` property of each schema).

### Request Payload Structure

```json
{
  "template": {
    "basePdf": "...",
    "schemas": [...]
  },
  "inputs": [
    {
      "fieldName1": "value1",
      "fieldName2": "value2",
      ...
    }
  ]
}
```

The `inputs` array can contain **multiple objects** to generate multiple PDFs in one request.

---

## Plugin Input Data Examples

### 1. Text (`type: 'text'`)

Simple text field. Input is a **string**.

```json
{
  "inputs": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  ]
}
```

### 2. Image (`type: 'image'`)

Image field. Input can be:
- **Base64 string**: `data:image/png;base64,iVBORw0KGg...`
- **URL**: `https://example.com/image.jpg`
- **Binary**: Convert to base64 before sending

```json
{
  "inputs": [
    {
      "logo": "data:image/png;base64,iVBORw0KGg...",
      "signature": "https://example.com/signature.png"
    }
  ]
}
```

**Server-side tip**: To convert a file to base64:
```javascript
const fs = require('fs');
const imageBuffer = fs.readFileSync('image.png');
const base64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
```

### 3. Table (`type: 'table'`)

Table field. Input is a **JSON stringified 2D array** of strings.

```json
{
  "inputs": [
    {
      "invoiceTable": "[[\"Item\",\"Qty\",\"Price\"],[\"Widget\",\"5\",\"$10\"],[\"Gadget\",\"3\",\"$25\"]]"
    }
  ]
}
```

Or as JavaScript:
```javascript
const tableData = [
  ["Item", "Qty", "Price"],
  ["Widget", "5", "$10"],
  ["Gadget", "3", "$25"]
];

inputs: [{
  invoiceTable: JSON.stringify(tableData)
}]
```

### 4. NestedTable (`type: 'nestedTable'`)

Nested table with headers. Input is also a **JSON stringified 2D array**.

Structure: Each row is an array of cell values, matching the leaf column structure.

```json
{
  "inputs": [
    {
      "nestedData": "[[\"Q1\",\"Sales\",\"500\",\"Costs\",\"300\"],[\"Q2\",\"Sales\",\"600\",\"Costs\",\"350\"]]"
    }
  ]
}
```

### 5. Checkbox (`type: 'checkbox'`)

Checkbox field. Input is `'true'` or `'false'` (string).

```json
{
  "inputs": [
    {
      "agreeTerms": "true",
      "newsletter": "false"
    }
  ]
}
```

### 6. Select (`type: 'select'`)

Select/dropdown field. Input is a **string matching one of the defined options**.

Schema example (in template):
```json
{
  "name": "country",
  "type": "select",
  "options": ["USA", "Canada", "Mexico"]
}
```

Input:
```json
{
  "inputs": [
    {
      "country": "USA"
    }
  ]
}
```

### 7. RadioGroup (`type: 'radioGroup'`)

Radio button group. Input is a **string matching one of the radio options**.

Schema:
```json
{
  "name": "paymentMethod",
  "type": "radioGroup",
  "options": ["Credit Card", "Bank Transfer", "Cash"]
}
```

Input:
```json
{
  "inputs": [
    {
      "paymentMethod": "Credit Card"
    }
  ]
}
```

### 8. Date (`type: 'date'`)

Date field. Input is a **date string** in format `YYYY-MM-DD`.

```json
{
  "inputs": [
    {
      "issueDate": "2024-12-19",
      "expiryDate": "2025-12-19"
    }
  ]
}
```

### 9. Barcode (`type: 'barcodes'`)

Barcode field (supports multiple formats: Code128, QR, etc.). Input is a **string**.

```json
{
  "inputs": [
    {
      "productCode": "123456789",
      "qrCode": "{\"text\":\"https://example.com\",\"errorCorrectionLevel\":\"Q\"}"
    }
  ]
}
```

For QR codes, if special options are needed, pass as JSON string.

### 10. MultiVariableText (`type: 'multiVariableText'`)

Text with multiple variables/placeholders. Input is a **JSON object** containing variable values.

Schema:
```json
{
  "name": "greeting",
  "type": "multiVariableText",
  "variables": ["firstName", "lastName"]
}
```

Input:
```json
{
  "inputs": [
    {
      "greeting": "{\"firstName\":\"John\",\"lastName\":\"Doe\"}"
    }
  ]
}
```

---

## Conditional Formatting

Fields with **conditional formatting rules** will have their displayed value replaced by the CF expression result at generation time.

For example, if a text field has:
- Content: `"Invoice Amount"`
- CF Rule: `amount > 1000 ? "High Value" : "Standard"`

The generated PDF will display `"High Value"` if `amount > 1000`, regardless of the input content.

**Input data remains the same** — CF evaluation happens automatically during generation.

---

## Complete Server Example

### Full Request/Response

**Request:**
```bash
curl -X POST http://localhost:3000/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "basePdf": "...",
      "schemas": [
        {
          "name": "customerName",
          "type": "text"
        },
        {
          "name": "orderItems",
          "type": "table"
        },
        {
          "name": "signature",
          "type": "image"
        }
      ]
    },
    "inputs": [
      {
        "customerName": "John Smith",
        "orderItems": "[[\"SKU\",\"Description\",\"Qty\"],[\"001\",\"Widget\",\"5\"],[\"002\",\"Gadget\",\"3\"]]",
        "signature": "data:image/png;base64,iVBORw0KGg..."
      }
    ]
  }' \
  --output invoice.pdf
```

**Node.js Handler:**
```javascript
app.post('/generate-pdf', async (req, res) => {
  try {
    const { template, inputs } = req.body;

    // Validate input format
    if (!template || !inputs || !Array.isArray(inputs)) {
      return res.status(400).json({
        error: 'Invalid format. Expected {template, inputs[]}'
      });
    }

    // Generate PDF
    const pdf = await generate({
      template,
      inputs,
      plugins: {
        // Register any custom plugins if needed
      },
      options: {
        font: {
          // Your font configuration
        }
      }
    });

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
    res.send(Buffer.from(pdf));

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(400).json({
      error: error.message,
      details: error.stack
    });
  }
});
```

---

## Batch Generation

Generate multiple PDFs in one request:

```json
{
  "inputs": [
    {
      "customerName": "John Smith",
      "orderItems": "[[\"SKU\",\"Description\"],[\"001\",\"Widget\"]]"
    },
    {
      "customerName": "Jane Doe",
      "orderItems": "[[\"SKU\",\"Description\"],[\"002\",\"Gadget\"]]"
    },
    {
      "customerName": "Bob Wilson",
      "orderItems": "[[\"SKU\",\"Description\"],[\"003\",\"Tool\"]]"
    }
  ]
}
```

Result: Single PDF with 3 pages (one for each input).

---

## Expression System

Fields can include **dynamic expressions** using `{{...}}` syntax.

**Examples:**
- `"Total: {{item1Price + item2Price}}"` → Calculates sum at generation time
- `"Page {{currentPage}} of {{totalPages}}"` → Inserts page numbers
- `"Date: {{date}}"` → Inserts current date
- `"{{invoiceTable.A1}}"` → References table cell A1

**Input data doesn't need to include expression results** — they're evaluated automatically.

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `field X is required` | Input missing required field | Ensure all `required: true` fields have values |
| `Invalid table format` | Table not JSON stringified | Use `JSON.stringify(array)` for tables |
| `Image not found` | Invalid base64/URL | Verify image is properly base64 encoded or URL is accessible |
| `Invalid date format` | Date not YYYY-MM-DD | Format all dates as `YYYY-MM-DD` |
| `Barcode generation failed` | Invalid barcode content | Check barcode value is valid for the format |

### Server Response Example

```javascript
{
  "success": true,
  "message": "PDF generated successfully",
  "pageCount": 3,
  "fileSize": 245632 // bytes
}

// or on error:

{
  "success": false,
  "error": "customerName is required",
  "code": "VALIDATION_ERROR"
}
```

---

## Performance Tips

1. **Batch requests**: Send multiple inputs in one request instead of multiple requests
2. **Cache templates**: Store template objects to avoid re-parsing
3. **Image optimization**: Convert images to base64 beforehand, not during request
4. **Font loading**: Load fonts once at server startup, not per request
5. **Async/await**: Use async processing for large batches

---

## Security Considerations

1. **Validate all inputs** — Check data types and lengths before generation
2. **Sanitize file paths** — Never allow user input to specify file locations
3. **Rate limiting** — Implement rate limits on `/generate-pdf` endpoint
4. **File size limits** — Set max request size (e.g., 50MB for images)
5. **Timeout handling** — Set generation timeout (large PDFs can take time)
6. **No file upload** — Send images as base64 or URLs, never save temp files

Example validation middleware:
```javascript
const validatePdfRequest = (req, res, next) => {
  const { template, inputs } = req.body;

  if (!template) return res.status(400).json({ error: 'template required' });
  if (!Array.isArray(inputs)) return res.status(400).json({ error: 'inputs must be array' });
  if (inputs.length === 0) return res.status(400).json({ error: 'inputs empty' });
  if (inputs.length > 100) return res.status(400).json({ error: 'max 100 inputs per request' });

  next();
};

app.post('/generate-pdf', validatePdfRequest, async (req, res) => {
  // ... generation logic
});
```

---

## Example: Complete Address Label Generator

```javascript
app.post('/generate-labels', async (req, res) => {
  const { addresses } = req.body; // Array of address objects

  // Convert to PDFme input format
  const inputs = addresses.map(addr => ({
    name: addr.name,
    address: addr.street,
    cityStateZip: `${addr.city}, ${addr.state} ${addr.zip}`
  }));

  try {
    const pdf = await generate({
      template: LABEL_TEMPLATE,
      inputs
    });

    res.contentType('application/pdf');
    res.send(Buffer.from(pdf));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Debugging

Enable detailed logging:

```javascript
app.post('/generate-pdf', async (req, res) => {
  try {
    console.log('Received template:', JSON.stringify(req.body.template, null, 2));
    console.log('Received inputs:', JSON.stringify(req.body.inputs, null, 2));

    const pdf = await generate({...});

    console.log('Generated PDF size:', pdf.length, 'bytes');
    res.send(Buffer.from(pdf));
  } catch (error) {
    console.error('Full error:', error);
    res.status(400).json({ error: error.message, stack: error.stack });
  }
});
```

---

## Resources

- **PDFme Docs**: https://pdfme.jp/
- **API Reference**: @pdfme/generator, @pdfme/common
- **Plugin Source**: packages/schemas/src/
- **Examples**: playground/ directory

