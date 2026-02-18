import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X, Copy, FileText, Plus, Minus } from "lucide-react";
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

// Shapes that are always static and have no meaningful input
const STATIC_TYPES = new Set(["line", "rectangle", "ellipse"]);

function getLeafColumns(nodes: { label: string; children?: any[] }[]): string[] {
  const leaves: string[] = [];
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      leaves.push(node.label);
    } else {
      leaves.push(...getLeafColumns(node.children));
    }
  }
  return leaves;
}

function parseTableContent(content: string, colCount: number): string[][] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((row: string[]) =>
        Array.isArray(row)
          ? row.map((c) => (typeof c === "string" ? c : String(c ?? "")))
          : Array(colCount).fill("")
      );
    }
  } catch {
    // ignore
  }
  return [Array(colCount).fill("")];
}

/* ------------------------------------------------------------------ */
/*  Table Editor                                                      */
/* ------------------------------------------------------------------ */
function TableEditor({
  columns,
  value,
  onChange,
}: {
  columns: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [rows, setRows] = useState<string[][]>(() =>
    parseTableContent(value, columns.length)
  );

  const sync = useCallback(
    (next: string[][]) => {
      setRows(next);
      onChange(JSON.stringify(next));
    },
    [onChange]
  );

  const updateCell = (r: number, c: number, v: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = v;
    sync(next);
  };

  const addRow = () => sync([...rows, Array(columns.length).fill("")]);

  const removeRow = () => {
    if (rows.length > 1) sync(rows.slice(0, -1));
  };

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className="border border-gray-300 bg-gray-100 px-2 py-1 text-left font-medium text-xs"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-gray-300 p-0">
                  <input
                    className="w-full px-2 py-1 text-sm outline-none"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          className="flex items-center gap-1 text-xs px-2 py-0.5 border rounded hover:bg-gray-50"
          onClick={addRow}
        >
          <Plus size={12} /> Add Row
        </button>
        <button
          type="button"
          className="flex items-center gap-1 text-xs px-2 py-0.5 border rounded hover:bg-gray-50"
          onClick={removeRow}
          disabled={rows.length <= 1}
        >
          <Minus size={12} /> Remove Row
        </button>
      </div>
    </div>
  );
}

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

    const meta: FieldMeta[] = [];
    const seen = new Set<string>();
    for (const page of template.schemas) {
      for (const schema of page) {
        if (schema.readOnly) continue;
        if (STATIC_TYPES.has(schema.type)) continue;
        if (seen.has(schema.name)) continue;
        seen.add(schema.name);
        meta.push({ name: schema.name, type: schema.type, schema });
      }
    }

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

  const getColumnsForSchema = (schema: Schema): string[] | null => {
    const s = schema as any;
    if (schema.type === "table" && Array.isArray(s.head)) {
      return s.head as string[];
    }
    if (schema.type === "nestedTable" && Array.isArray(s.headerTree)) {
      return getLeafColumns(s.headerTree);
    }
    return null;
  };

  const renderField = (field: FieldMeta) => {
    const value = inputs[field.name] ?? "";

    // Table / Nested Table
    const columns = getColumnsForSchema(field.schema);
    if (columns && columns.length > 0) {
      return (
        <TableEditor
          columns={columns}
          value={value}
          onChange={(v) => updateField(field.name, v)}
        />
      );
    }

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
    if (field.type === "multiVariableText" || value.length > 80) {
      return (
        <textarea
          className="w-full border rounded px-2 py-1 text-sm resize-y"
          rows={3}
          value={value}
          onChange={(e) => updateField(field.name, e.target.value)}
        />
      );
    }

    // Default: text input
    return (
      <input
        type="text"
        className="w-full border rounded px-2 py-1 text-sm"
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
