# Smart Variable Detection for Expression Fields

## Overview

Expression Fields now intelligently detect whether required variables are already provided by other fields in your template. This eliminates unnecessary input prompts and clearly shows data dependencies.

## How It Works

### Smart Categorization

When you open Template Tester, the system:

1. **Collects all input fields** — Finds all Text, Select, Checkbox, etc. fields
2. **Extracts expression variables** — Parses `{expression}` to find required variables
3. **Matches variables to fields** — Checks if variable name matches a field name
4. **Categorizes** — Splits into "Provided" vs "Requires Input"

### Example

**Template Structure:**
```
Fields:
├── price (Text field)
├── quantity (Text field)
└── total (Expression Field: {Number(price) * quantity})
```

**Smart Detection:**
```
Expression Field: total
├── Expression: {Number(price) * quantity}
├── Provided by other fields:
│   ✓ price (matched to "price" field)
│   ✓ quantity (matched to "quantity" field)
└── Status: ✓ Ready (all variables provided)
```

**Result:** User doesn't see "price" and "quantity" as requirements — they're already satisfied!

---

## Usage Scenarios

### Scenario 1: Complete Auto-satisfaction

```
Fields:
├── firstName (Text field)
├── lastName (Text field)
├── greeting (Expression Field: {"Hello " + firstName + " " + lastName})
```

**Template Tester Shows:**
```
┌─ Calculated Fields ─────────────────────┐
│ greeting                      ✓ Ready  │
│ {"Hello " + firstName + " " + lastName} │
│                                          │
│ Provided by other fields:               │
│ ✓ firstName   ✓ lastName               │
│                                          │
│ Requires input: (none - all satisfied)  │
└──────────────────────────────────────────┘

(No input needed - expression is fully satisfied!)
```

---

### Scenario 2: Partial Satisfaction

```
Fields:
├── basePrice (Text field)
├── taxRate (Text field)
├── discount (Text field)
└── finalPrice (Expression Field: {basePrice * (1 + taxRate) - discount})
```

**Template Tester Shows:**
```
┌─ Calculated Fields ──────────────────────┐
│ finalPrice                  ⚠ Incomplete│
│ {basePrice * (1 + taxRate) - discount}  │
│                                           │
│ Provided by other fields:                │
│ ✓ basePrice   ✓ taxRate   ✓ discount   │
│                                           │
│ Requires input: (none - all satisfied)   │
└───────────────────────────────────────────┘

(All variables provided! PDF ready to generate.)
```

---

### Scenario 3: Partial Missing

```
Fields:
├── quantity (Text field)
└── total (Expression Field: {Number(quantity) * unitPrice})
```

**Template Tester Shows:**
```
┌─ Calculated Fields ──────────────────────┐
│ total                       ⚠ Incomplete│
│ {Number(quantity) * unitPrice}          │
│                                          │
│ Provided by other fields:               │
│ ✓ quantity                             │
│                                          │
│ Requires input:                        │
│ ❌ unitPrice (not found in fields)    │
└──────────────────────────────────────────┘

Input Fields
────────────
unitPrice [____________]  ← Must fill this
```

---

## Visual Indicators

### Status Badges

| Badge | Meaning | Color |
|-------|---------|-------|
| ✓ Ready | All variables satisfied | Green |
| ⚠ Incomplete | Some variables missing | Orange |
| ✓ variable | Provided by another field | Green (lighter) |
| ❌ variable | Needs input from user | Red |
| ✓ variable | Input has been provided | Green (bold) |

### Sections

**Provided by other fields:**
- Variables that match field names in your template
- No user input needed
- Shown with ✓ badge in green
- Informational only (helps understand dependencies)

**Requires input:**
- Variables NOT found in any field
- Need manual input in the form
- Shown with ❌ or ✓ badge (depending on whether filled)
- Input fields appear below in "Input Fields" section

---

## Field Matching Rules

Variables are matched to fields using **exact name matching**:

```javascript
// Expression: {totalPrice + discount}

Template with these fields:
├── totalPrice (Text) — ✓ MATCH
├── Total_Price (Text) — ✗ NO MATCH (case sensitive)
├── total_price (Text) — ✗ NO MATCH (case sensitive)
├── discount (Text) — ✓ MATCH
└── discountCode (Text) — ✗ NO MATCH (exact match only)
```

### Case Sensitivity

Variable matching is **case-sensitive**:
- `{price}` matches field named `price` ✓
- `{price}` does NOT match field named `Price` ✗
- `{price}` does NOT match field named `PRICE` ✗

### Exact Naming

Variable matching requires **exact field names**:
- `{quantity}` matches field `quantity` ✓
- `{quantity}` does NOT match field `qty` ✗
- `{quantity}` does NOT match field `quantities` ✗

---

## Field Types Considered

### ✅ Input Fields (Provide Variables)

These field types are considered when matching variables:
- Text
- MultiVariableText
- Date
- DateTime
- Time
- Select
- Checkbox
- RadioGroup
- Image
- SVG
- Signature

### ❌ Non-Input Fields (Ignored)

These field types do NOT provide variables:
- Line (static shape)
- Rectangle (static shape)
- Ellipse (static shape)
- Table (static content)
- NestedTable (static content)
- ExpressionField (calculated, not input)

---

## Common Patterns

### Pattern 1: Calculated Fields Chain

```javascript
// Fields: itemPrice, itemCount
// Expression Field 1: subtotal = {Number(itemPrice) * Number(itemCount)}
// Expression Field 2: tax = {subtotal * 0.1}
// Expression Field 3: total = {subtotal + tax}
```

**Problem:** Expression Field 2 uses `subtotal` which is another expression field, not an input field.

**Template Tester Shows:**
```
subtotal        ✓ Ready (all inputs provided)
tax             ⚠ Incomplete
  ❌ subtotal (not an input field)

total           ⚠ Incomplete
  ❌ subtotal, ❌ tax (not input fields)
```

**Solution:** Expression fields can't reference each other. Use a single complex expression:

```javascript
{(Number(itemPrice) * Number(itemCount)) * 1.1}  // subtotal + tax in one expression
```

---

### Pattern 2: Optional Variables

```javascript
// Fields: price, couponCode
// Expression: {couponCode ? Number(price) * 0.9 : Number(price)}
```

**Template Tester Shows:**
```
discountedPrice        ⚠ Incomplete
{couponCode ? Number(price) * 0.9 : Number(price)}

Provided:  ✓ price
Requires:  ❌ couponCode
```

**Note:** Both `price` and `couponCode` are required, even if conditional. To make `couponCode` truly optional, provide a default value or handle it differently.

---

### Pattern 3: Complex Calculations

```javascript
// Fields: principal, rate, years
// Expression: {Math.round(principal * Math.pow(1 + rate/100, years) * 100) / 100}
```

**Template Tester Shows:**
```
futureValue        ✓ Ready
{Math.round(...)}

Provided:  ✓ principal   ✓ rate   ✓ years
Requires:  (none - all satisfied!)
```

---

## Implementation Details

### New Utility Functions

**`playground/src/utils/expressionVariableExtractor.ts`**

```typescript
// Get all available field names that can provide variable values
getAvailableFieldNames(schemas: Schema[]): Set<string>

// Categorize required variables
categorizeVariables(
  requiredVariables: string[],
  availableFieldNames: Set<string>
): { provided: string[], missing: string[] }

// Check if single variable is provided
isVariableProvidedByField(variableName: string, availableFieldNames: Set<string>): boolean
```

### Updated Interface

**`ExpressionFieldInfo`**
```typescript
interface ExpressionFieldInfo {
  fieldName: string;
  requiredVariables: string[];           // All variables used in expression
  providedVariables: string[];           // Variables found in other fields
  missingVariables: string[];            // Variables needing input
  expression: string;
}
```

### Template Tester Display Logic

1. **Fetch template** → Collect all schemas
2. **Identify input fields** → Get all field names
3. **Parse expressions** → Extract required variables
4. **Categorize variables** → Match against field names
5. **Display status**:
   - Provided variables in green
   - Missing variables in red/orange
   - Real-time update as user fills inputs

---

## Testing Checklist

### Test 1: Full Satisfaction
```
✓ Create Text field "price"
✓ Create Text field "quantity"
✓ Create Expression Field: {Number(price) * quantity}
✓ Open Template Tester
✓ Verify: "price" and "quantity" show as ✓ Provided
✓ Verify: Status shows "✓ Ready"
✓ Enter values and generate PDF → Works!
```

### Test 2: Partial Satisfaction
```
✓ Create Text field "baseAmount"
✓ Create Expression Field: {baseAmount * factor}
✓ Open Template Tester
✓ Verify: "baseAmount" shows as ✓ Provided
✓ Verify: "factor" shows as ❌ Requires input
✓ Fill "factor" input field
✓ Verify: "factor" badge changes to ✓
✓ Verify: Status changes to "✓ Ready"
✓ Generate PDF → Works!
```

### Test 3: No Satisfaction
```
✓ Create Expression Field: {a + b + c}
✓ Open Template Tester
✓ Verify: All three variables show as ❌ Requires input
✓ Verify: Status shows "⚠ Incomplete"
✓ Fill all three input fields
✓ Verify: Status changes to "✓ Ready"
✓ Generate PDF → Works!
```

### Test 4: Case Sensitivity
```
✓ Create Text field "Price" (capital P)
✓ Create Expression Field: {price * 2}
✓ Open Template Tester
✓ Verify: "price" shows as ❌ Requires input (not matched to "Price")
✓ Fill "price" input
✓ Verify: Status shows "✓ Ready"
✓ Generate PDF → Works!
```

### Test 5: Ignored Fields
```
✓ Create Text field "price"
✓ Create Line shape
✓ Create Rectangle shape
✓ Create Expression Field: {price * 2 + lineSize}
✓ Open Template Tester
✓ Verify: "price" shows as ✓ Provided
✓ Verify: "lineSize" shows as ❌ Requires input (Line ignored)
✓ NOT asking for "line" variable
```

---

## Benefits

✅ **Clearer Data Flow** — See exactly what data your expressions depend on
✅ **Less Confusion** — Don't ask for input that's already provided
✅ **Faster Testing** — Quickly identify what's missing
✅ **Better UX** — Only required inputs shown in form
✅ **Documentation** — Template Tester documents variable dependencies
✅ **Error Prevention** — Catch missing variables before generating PDF

---

## Limitations & Edge Cases

⚠️ **Expression-to-Expression References** — Expression fields can't reference other expression fields (yet)
⚠️ **Dynamic Property Access** — `obj[variableName]` won't match `variableName` field
⚠️ **Nested Variables** — Only top-level variables detected (not `this.price` or `obj.price`)
⚠️ **Template Strings** — Only works in `{expression}` format, not JavaScript template literals

---

## Future Enhancements

🔮 **Smart Suggestions** — "Did you mean field 'Price' instead of 'price'?"
🔮 **Variable Linking** — Visual graph showing which fields feed which expressions
🔮 **Type Checking** — Verify variable types match expected usage
🔮 **Cross-Expression** — Allow safe references between expression fields
🔮 **Default Values** — Set defaults for optional variables

