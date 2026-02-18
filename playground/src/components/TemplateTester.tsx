import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, Copy, FileText } from "lucide-react";
import { getInputFromTemplate, Schema } from "@pdfme/common";
import { generate } from "@pdfme/generator";
import { Designer } from "@pdfme/ui";
import { toast } from "react-toastify";
import { getFontsData } from "../helper";
import { getPlugins } from "../plugins";

interface TemplateTesterProps {
  open: boolean;
  onClose: () => void;
  designer: React.RefObject<Designer | null>;
}

interface FieldMeta {
  name: string;
  type: string;
  schema: Schema;
}

// Shapes and table types that are always static (no input needed)
const STATIC_TYPES = new Set(["line", "rectangle", "ellipse", "table", "nestedTable"]);

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */
export function TemplateTester({ open, onClose, designer }: TemplateTesterProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [fieldMeta, setFieldMeta] = useState<FieldMeta[]>([]);
  const [generating, setGenerating] = useState(false);

  // Build fields when dialog opens
  useEffect(() => {
    if (!open || !designer.current) return;

    const template = designer.current.getTemplate();
    const defaultInputs = getInputFromTemplate(template)[0] ?? {};

    console.log("Template structure:", {
      pages: template.schemas.length,
      staticSchemas: template.staticSchemas?.length ?? 0,
      totalSchemas: template.schemas.reduce((sum, page) => sum + page.length, 0),
    });

    const meta: FieldMeta[] = [];
    const seen = new Set<string>();

    // Extract fields from static schemas (appear on all pages)
    if (template.staticSchemas) {
      console.log("Processing staticSchemas:", template.staticSchemas.length);
      for (const schema of template.staticSchemas) {
        if (schema.readOnly) continue;
        if (STATIC_TYPES.has(schema.type)) continue;
        if (seen.has(schema.name)) continue;
        seen.add(schema.name);
        meta.push({ name: schema.name, type: schema.type, schema });
      }
    }

    // Extract fields from page-specific schemas
    template.schemas.forEach((page, pageIndex) => {
      console.log(`Processing page ${pageIndex + 1}: ${page.length} schemas`);
      for (const schema of page) {
        if (schema.readOnly) continue;
        if (STATIC_TYPES.has(schema.type)) continue;
        if (seen.has(schema.name)) continue;
        seen.add(schema.name);
        meta.push({ name: schema.name, type: schema.type, schema });
      }
    });

    console.log("Final extracted fields:", meta.map(m => ({ name: m.name, type: m.type })));

    setFieldMeta(meta);
    setInputs(defaultInputs);
  }, [open, designer]);

  const updateField = (name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyJson = async () => {
    const json = JSON.stringify([inputs], null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Input JSON copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleGenerate = async () => {
    if (!designer.current) return;
    setGenerating(true);
    try {
      const template = designer.current.getTemplate();
      const font = getFontsData();
      const pdf = await generate({
        template,
        inputs: [inputs],
        options: { font, lang: "en", title: "pdfme" },
        plugins: getPlugins(),
      });
      const blob = new Blob([pdf.buffer], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(`PDF generation failed: ${e}`);
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };


  const renderField = (field: FieldMeta) => {
    const value = inputs[field.name] ?? "";

    // Checkbox
    if (field.type === "checkbox") {
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) =>
              updateField(field.name, e.target.checked ? "true" : "false")
            }
          />
          <span className="text-sm text-gray-600">
            {value === "true" ? "Checked" : "Unchecked"}
          </span>
        </label>
      );
    }

    // RadioGroup — render as select with options from schema
    if (field.type === "radioGroup") {
      const s = field.schema as any;
      const group = s.group;
      // Find all radioGroup schemas in the same group to use as options
      const options = group
        ? fieldMeta
            .filter((f) => f.type === "radioGroup" && (f.schema as any).group === group)
            .map((f) => f.name)
        : [field.name];
      return (
        <select
          className="w-full border rounded px-2 py-1 text-sm"
          value={value}
          onChange={(e) => updateField(field.name, e.target.value)}
        >
          <option value="">-- Select --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // Select
    if (field.type === "select") {
      const opts: string[] = (field.schema as any).options ?? [];
      return (
        <select
          className="w-full border rounded px-2 py-1 text-sm"
          value={value}
          onChange={(e) => updateField(field.name, e.target.value)}
        >
          <option value="">-- Select --</option>
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    // Image / SVG / Signature — file input
    if (["image", "svg", "signature"].includes(field.type)) {
      return (
        <div className="space-y-1">
          <input
            type="file"
            accept={field.type === "svg" ? ".svg,image/svg+xml" : "image/*"}
            className="w-full text-sm border rounded"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  updateField(field.name, reader.result);
                }
              };
              reader.readAsDataURL(file);
            }}
          />
          {value && (
            <p className="text-xs text-gray-500 truncate">
              {value.slice(0, 60)}...
            </p>
          )}
        </div>
      );
    }

    // Multiline for multiVariableText or long default content
    if (field.type === "multiVariableText") {
      return (
        <textarea
          className="w-full border rounded px-2 py-1 text-sm resize-y"
          rows={3}
          placeholder="Enter text with variables like {firstName} {lastName}"
          value={value}
          onChange={(e) => updateField(field.name, e.target.value)}
        />
      );
    }

    // Default: text input for all other types
    return (
      <input
        type="text"
        className="w-full border rounded px-2 py-1 text-sm"
        placeholder={`Enter ${field.name}...`}
        value={value}
        onChange={(e) => updateField(field.name, e.target.value)}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-4 flex items-center justify-center">
        <DialogPanel
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText size={18} />
              Template Tester
            </DialogTitle>
            <button
              className="p-1 hover:bg-gray-100 rounded"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {fieldMeta.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No variable fields in this template.
              </p>
            ) : (
              fieldMeta.map((field) => (
                <div key={field.name}>
                  <label className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{field.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      {field.type}
                    </span>
                  </label>
                  {renderField(field)}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50 rounded-b-lg">
            <div className="flex gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm hover:bg-gray-100"
                onClick={handleCopyJson}
              >
                <Copy size={14} />
                Copy Input JSON
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                onClick={handleGenerate}
                disabled={generating}
              >
                <FileText size={14} />
                {generating ? "Generating..." : "Generate PDF"}
              </button>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
