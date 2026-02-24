const express = require('express');
const cors = require('cors');
const OpenAI = require('openai').default;
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.API_PORT || 3001;


// ---------------------------------------------------------------------------
// Load documentation at startup
// ---------------------------------------------------------------------------

const DOCS_PATH = path.resolve(__dirname, '..', '..', 'PDFME_COMPLETE_DOCUMENTATION.md');
let documentation = '';
try {
  documentation = fs.readFileSync(DOCS_PATH, 'utf-8');
  console.log(`Loaded documentation (${documentation.length} chars)`);
} catch (err) {
  console.error('WARNING: Could not load PDFME_COMPLETE_DOCUMENTATION.md:', err.message);
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// System prompt — teaches the LLM the exact schema structure
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert PDFme schema generator that reads STRICTLY from the documentation provided below.
Your ONLY job is to produce valid PDFme Schema arrays (Schema[]) in JSON.

═══════════════════════════════════════════════════════════════
SCHEMA STRUCTURE (this is the exact Zod definition used in the app):

  Schema = z.object({
    name:     z.string(),          // unique field name per page
    type:     z.string(),          // one of the AVAILABLE TYPES below
    content:  z.string().optional(), // default / placeholder value
    position: z.object({ x: z.number(), y: z.number() }),  // in MM
    width:    z.number(),          // in MM
    height:   z.number(),          // in MM
    rotate:   z.number().optional(),
    opacity:  z.number().optional(), // 0–1
    readOnly: z.boolean().optional(),
    required: z.boolean().optional(),
  }).passthrough();  // allows extra type-specific properties

Template.schemas is Schema[][] — a 2D array where each inner array
is one page of schemas. You produce a SINGLE page: Schema[].

═══════════════════════════════════════════════════════════════
AVAILABLE TYPES:
  text, multiVariableText, image, table,
  qrcode, code128, ean13, ean8, code39, nw7, itf14, upca, upce,
  japanpost, gs1datamatrix, pdf417,
  line, rectangle, ellipse,
  checkbox, radioGroup, select,
  date, dateTime, time,
  svg, signature

═══════════════════════════════════════════════════════════════
COORDINATE SYSTEM:
  • Units are MILLIMETERS (mm).
  • A4 page: 210 mm × 297 mm.
  • Default padding: [top=20, right=10, bottom=20, left=10].
  • Usable area: x ∈ [10, 200], y ∈ [20, 277].

═══════════════════════════════════════════════════════════════
CRITICAL RULES:
1. Respond with ONLY a valid JSON array (Schema[]). No markdown, no code fences, no explanation.
2. Every object MUST have: name, type, position {x,y}, width, height.
3. Field names MUST be unique within the page.
4. For static/label text: set readOnly: true and content: "the text".
5. For input/dynamic fields: set readOnly: false (or omit) and content: "" or a placeholder like "John Doe".
6. Type-specific properties (fontSize, alignment, fontName, head, bodyStyles, etc.) may be added as needed.
7. Do NOT wrap the array in an object. Output: [...] not { schemas: [...] }.
8. Avoid overlapping fields — lay them out logically.

═══════════════════════════════════════════════════════════════
EDITING EXISTING SCHEMAS:
When CURRENT PAGE SCHEMAS are provided below, you have two modes:
  • If the user says "add", "insert", or "append" → output ONLY the new schemas (they will be appended).
  • If the user says "edit", "modify", "update", "change", "move", "resize", "rename", or "redesign" → output the COMPLETE updated page (all schemas, including modified + unchanged ones).
  • If the user says "remove" or "delete" → output the COMPLETE page WITHOUT the removed schemas.
  • If ambiguous, output the COMPLETE page with the changes applied.

═══════════════════════════════════════════════════════════════
REFERENCE DOCUMENTATION:
${documentation}

Remember: Output ONLY a valid JSON array. Nothing else.`;

// ---------------------------------------------------------------------------
// POST /api/ai/generate-schema
// ---------------------------------------------------------------------------

app.post('/api/ai/generate-schema', async (req, res) => {
  try {
    const { messages, currentSchemas } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    // ── Build current-schemas context ──
    let schemasContext = '';
    if (currentSchemas && currentSchemas.length > 0) {
      schemasContext =
        `\n\n═══ CURRENT PAGE SCHEMAS (${currentSchemas.length} field(s)) ═══\n` +
        JSON.stringify(currentSchemas, null, 2) +
        '\n═══ END CURRENT PAGE SCHEMAS ═══';
    } else {
      schemasContext = '\n\nCURRENT PAGE SCHEMAS: (empty — no schemas on this page yet)';
    }

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT + schemasContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // ── Call OpenAI ──
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.3,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || '[]';

    // ── Parse raw JSON ──
    let rawParsed;
    try {
      let cleaned = responseText;
      // Strip markdown code fences if the model added them
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      rawParsed = JSON.parse(cleaned);

      if (!Array.isArray(rawParsed)) {
        throw new Error('Response is not a JSON array');
      }
    } catch (parseErr) {
      return res.json({
        schemas: null,
        raw: responseText,
        error: `LLM returned unparseable JSON: ${parseErr.message}`,
        validationErrors: null,
      });
    }

    // ── Success ──
    res.json({
      schemas: rawParsed,
      raw: responseText,
      error: null,
      validationErrors: null,
    });
  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate schema',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.OPENAI_API_KEY,
    hasDocumentation: documentation.length > 0,
  });
});

app.listen(PORT, () => {
  console.log(`PDFme AI API server running on http://localhost:${PORT}`);
  console.log(`OpenAI key: ${process.env.OPENAI_API_KEY ? 'configured' : 'MISSING'}`);
});
