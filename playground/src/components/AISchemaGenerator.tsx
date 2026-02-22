import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { X, Send, Loader2, Sparkles, Copy, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import type { Schema } from '@pdfme/common';
import {
  ChatMessage,
  ValidationError,
  generateSchemaFromPrompt,
  AISchemaResponse,
} from '../utils/aiService';

const jsonExtensions = [json()];

interface AISchemaGeneratorProps {
  open: boolean;
  onClose: () => void;
  /** Current schemas on the active page — always sent to the LLM */
  currentSchemas: Schema[];
  /** Called when user clicks "Apply" on a generated schema */
  onApplySchemas: (schemas: Schema[], mode: 'replace' | 'merge') => void;
}

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  schemas?: Schema[] | null;
  error?: string | null;
  validationErrors?: ValidationError[] | null;
}

const EXAMPLE_PROMPTS = [
  'Create an invoice layout with company logo, billing info, and items table',
  'Add a QR code in the bottom-right corner linking to a URL',
  'Design a certificate with name, date, and signature fields',
  'Add a header with title "Monthly Report" and a horizontal line below it',
  'Create a form with name, email, phone, and date of birth fields',
];

export function AISchemaGenerator({
  open,
  onClose,
  currentSchemas,
  onApplySchemas,
}: AISchemaGeneratorProps) {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showCurrentSchemas, setShowCurrentSchemas] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation, scrollToBottom]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userEntry: ConversationEntry = { role: 'user', content: prompt };
    setConversation((prev) => [...prev, userEntry]);
    setInput('');
    setLoading(true);

    // Build message history for OpenAI
    const messages: ChatMessage[] = [
      ...conversation
        .filter((c) => c.role === 'user' || (c.role === 'assistant' && !c.error))
        .map((c) => ({
          role: c.role as 'user' | 'assistant',
          content:
            c.role === 'assistant' && c.schemas
              ? JSON.stringify(c.schemas)
              : c.content,
        })),
      { role: 'user', content: prompt },
    ];

    try {
      const result: AISchemaResponse = await generateSchemaFromPrompt(
        messages,
        currentSchemas
      );

      const assistantEntry: ConversationEntry = {
        role: 'assistant',
        content: result.raw,
        schemas: result.schemas,
        error: result.error,
        validationErrors: result.validationErrors,
      };
      setConversation((prev) => [...prev, assistantEntry]);
    } catch (err) {
      const assistantEntry: ConversationEntry = {
        role: 'assistant',
        content: '',
        schemas: null,
        error: (err as Error).message,
      };
      setConversation((prev) => [...prev, assistantEntry]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (schemasJson: string, index: number) => {
    navigator.clipboard.writeText(schemasJson).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const handleClear = () => {
    setConversation([]);
    setInput('');
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <DialogPanel className="w-screen max-w-lg transform transition-all">
          <div className="flex h-full flex-col bg-white shadow-xl">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-emerald-600" />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    AI Schema Generator
                  </h2>
                  <p className="text-xs text-gray-500">
                    Describe your layout in natural language
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClear}
                  className="p-1.5 rounded hover:bg-white/60 text-gray-500 hover:text-gray-800"
                  title="Clear conversation"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded hover:bg-white/60 text-gray-500 hover:text-gray-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {/* Current schemas context banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowCurrentSchemas(!showCurrentSchemas)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium">
                    Current page: {currentSchemas.length} schema{currentSchemas.length !== 1 ? 's' : ''}
                    {currentSchemas.length > 0 && (
                      <span className="font-normal text-blue-500 ml-1">
                        ({currentSchemas.map((s) => s.name).join(', ')})
                      </span>
                    )}
                  </span>
                  {currentSchemas.length > 0 && (
                    showCurrentSchemas ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </button>
                {showCurrentSchemas && currentSchemas.length > 0 && (
                  <div className="border-t border-blue-200 max-h-48 overflow-auto">
                    <CodeMirror
                      value={JSON.stringify(currentSchemas, null, 2)}
                      extensions={jsonExtensions}
                      readOnly
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        highlightActiveLine: false,
                      }}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                )}
                <p className="px-3 py-1.5 text-[10px] text-blue-500 border-t border-blue-100">
                  These schemas are sent with every prompt so the AI can edit them
                </p>
              </div>

              {conversation.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 text-center mt-4">
                    Tell me what you want on your PDF page and I&apos;ll generate
                    the schema JSON for you.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Examples
                    </p>
                    {EXAMPLE_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(p)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 text-gray-600 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {conversation.map((entry, i) => (
                <div key={i}>
                  {entry.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="bg-emerald-600 text-white px-3 py-2 rounded-lg rounded-br-sm max-w-[85%] text-sm whitespace-pre-wrap">
                        {entry.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {entry.error ? (
                        <div className="bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-sm text-red-700">
                          <p className="font-medium">Validation Error</p>
                          <p className="text-xs mt-1">{entry.error}</p>
                          {entry.validationErrors && entry.validationErrors.length > 0 && (
                            <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                              {entry.validationErrors.map((ve, vi) => (
                                <li key={vi}>
                                  {ve.path && <code className="bg-red-100 px-1 rounded text-[10px]">{ve.path}</code>}{' '}
                                  {ve.message}
                                </li>
                              ))}
                            </ul>
                          )}
                          {entry.content && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer">
                                Raw response
                              </summary>
                              <pre className="text-xs mt-1 overflow-x-auto whitespace-pre-wrap">
                                {entry.content}
                              </pre>
                            </details>
                          )}
                        </div>
                      ) : entry.schemas ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 border-b bg-gray-100 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600">
                              Generated {entry.schemas.length} schema
                              {entry.schemas.length !== 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  handleCopy(
                                    JSON.stringify(entry.schemas, null, 2),
                                    i
                                  )
                                }
                                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                title="Copy JSON"
                              >
                                {copiedIndex === i ? (
                                  <Check size={14} className="text-green-600" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="max-h-64 overflow-auto">
                            <CodeMirror
                              value={JSON.stringify(entry.schemas, null, 2)}
                              extensions={jsonExtensions}
                              readOnly
                              basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                highlightActiveLine: false,
                              }}
                              style={{ fontSize: 11 }}
                            />
                          </div>
                          <div className="px-3 py-2 border-t bg-gray-50 flex gap-2">
                            <button
                              onClick={() =>
                                onApplySchemas(entry.schemas!, 'replace')
                              }
                              className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                            >
                              Replace Page Schemas
                            </button>
                            <button
                              onClick={() =>
                                onApplySchemas(entry.schemas!, 'merge')
                              }
                              className="flex-1 px-3 py-1.5 border border-emerald-600 text-emerald-700 text-xs font-medium rounded hover:bg-emerald-50 transition-colors"
                            >
                              Add to Page
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Generating schemas...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t px-4 py-3 shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want on the page..."
                  className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="self-end px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Press Enter to send, Shift+Enter for new line. Schemas are
                generated using your documentation as reference.
              </p>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
