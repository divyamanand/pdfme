import type { Schema } from '@pdfme/common';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface AISchemaResponse {
  schemas: Schema[] | null;
  raw: string;
  error: string | null;
  validationErrors: ValidationError[] | null;
}

/**
 * Calls the AI API to generate PDFme schemas from a natural language prompt.
 * Always sends the current page schemas so the LLM can edit/modify them.
 */
export async function generateSchemaFromPrompt(
  messages: ChatMessage[],
  currentSchemas: Schema[]
): Promise<AISchemaResponse> {
  const res = await fetch('/api/ai/generate-schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, currentSchemas }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Check if the AI backend is available and configured.
 */
export async function checkAIHealth(): Promise<{
  status: string;
  hasApiKey: boolean;
  hasDocumentation: boolean;
}> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('AI server not available');
  return res.json();
}
