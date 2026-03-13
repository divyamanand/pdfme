import React, { useRef, useEffect, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { cloneDeep, Template, checkTemplate, isBlankPdf } from "@pdfme/common";
import { Designer } from "@pdfme/ui";
import {
  getFontsData,
  getTemplateById,
  getBlankTemplate,
  readFile,
  generatePDF,
} from "../helper";
import { getPlugins } from '../plugins';
import { NavBar, NavItem } from "../components/NavBar";

// ---------------------------------------------------------------------------
// Version history helpers (stored per-template in localStorage)
// ---------------------------------------------------------------------------
type VersionEntry = { label: string; timestamp: number; template: Template };

function loadVersions(): VersionEntry[] {
  try {
    const raw = localStorage.getItem("template-versions");
    return raw ? (JSON.parse(raw) as VersionEntry[]) : [];
  } catch { return []; }
}
function saveVersions(v: VersionEntry[]) {
  localStorage.setItem("template-versions", JSON.stringify(v));
}
function pushVersion(template: Template): VersionEntry[] {
  const versions = loadVersions();
  const entry: VersionEntry = {
    label: `v${versions.length + 1}`,
    timestamp: Date.now(),
    template: cloneDeep(template),
  };
  versions.push(entry);
  saveVersions(versions);
  return versions;
}

// ---------------------------------------------------------------------------
// Page-size presets
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function DesignerApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const designerRef = useRef<HTMLDivElement | null>(null);
  const designer = useRef<Designer | null>(null);

  const [editingStaticSchemas, setEditingStaticSchemas] = useState(false);
  const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null);
  const [viewerMode, setViewerMode] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>(loadVersions());

  // Auto-save: persists on every template change
  const autoSave = useCallback((template: Template) => {
    localStorage.setItem("template", JSON.stringify(template));
  }, []);

  const buildDesigner = useCallback(async () => {
    if (!designerRef.current) return;
    try {
      let template: Template = getBlankTemplate();
      const templateIdFromQuery = searchParams.get("template");
      searchParams.delete("template");
      setSearchParams(searchParams, { replace: true });
      const templateFromLocal = localStorage.getItem("template");

      if (templateIdFromQuery) {
        const templateJson = await getTemplateById(templateIdFromQuery);
        checkTemplate(templateJson);
        template = templateJson;
        if (!templateFromLocal) {
          localStorage.setItem("template", JSON.stringify(templateJson));
        }
      } else if (templateFromLocal) {
        const templateJson = JSON.parse(templateFromLocal) as Template;
        checkTemplate(templateJson);
        template = templateJson;
      }

      designer.current = new Designer({
        domContainer: designerRef.current,
        template,
        options: {
          font: getFontsData(),
          lang: 'en',
          labels: { 'signature.clear': "🗑️" },
          theme: { token: { colorPrimary: "#25c2a0" } },
          icons: {
            multiVariableText:
              '<svg fill="#000000" width="24px" height="24px" viewBox="0 0 24 24"><path d="M6.643,13.072,17.414,2.3a1.027,1.027,0,0,1,1.452,0L20.7,4.134a1.027,1.027,0,0,1,0,1.452L9.928,16.357,5,18ZM21,20H3a1,1,0,0,0,0,2H21a1,1,0,0,0,0-2Z"/></svg>',
          },
          maxZoom: 250,
        },
        plugins: getPlugins(),
      });
      designer.current.onSaveTemplate(onSaveTemplate);
      designer.current.onChangeTemplate(autoSave);
    } catch (error) {
      localStorage.removeItem("template");
      console.error(error);
    }
  }, [searchParams, setSearchParams, autoSave]);

  // --- BasePDF ---
  const onChangeBasePDF = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      readFile(e.target.files[0], "dataURL").then(async (basePdf) => {
        if (designer.current) {
          const t = cloneDeep(designer.current.getTemplate());
          t.basePdf = basePdf;
          designer.current.updateTemplate(t);
        }
      });
    }
  };

  const onRemoveBasePDF = () => {
    if (!designer.current) return;
    const t = cloneDeep(designer.current.getTemplate());
    t.basePdf = { width: 210, height: 297, padding: [20, 10, 20, 10] };
    designer.current.updateTemplate(t);
    toast.info("Base PDF removed — blank page restored");
  };

  // --- Save / Reset ---
  const onSaveTemplate = (template?: Template) => {
    if (designer.current) {
      const t = template || designer.current.getTemplate();
      localStorage.setItem("template", JSON.stringify(t));
      const v = pushVersion(t);
      setVersions(v);
      toast.success("Saved & version snapshot created");
    }
  };

  const onResetTemplate = () => {
    localStorage.removeItem("template");
    if (designer.current) {
      designer.current.updateTemplate(getBlankTemplate());
    }
  };

  // --- Viewer toggle ---
  const toggleViewerMode = () => {
    if (!designer.current) return;
    const next = !viewerMode;
    setViewerMode(next);
    // readOnly on all schemas = viewer behaviour inside the designer shell
    const t = cloneDeep(designer.current.getTemplate());
    t.schemas = t.schemas.map(page =>
      page.map(s => ({ ...s, readOnly: next }))
    );
    designer.current.updateTemplate(t);
  };

  // --- Static schema editing ---
  const toggleEditingStaticSchemas = () => {
    if (!designer.current) return;
    if (!editingStaticSchemas) {
      const currentTemplate = cloneDeep(designer.current.getTemplate());
      if (!isBlankPdf(currentTemplate.basePdf)) {
        toast.error("Static schema editing requires a blank base PDF");
        return;
      }
      setOriginalTemplate(currentTemplate);
      const { width, height } = currentTemplate.basePdf;
      const staticSchema = currentTemplate.basePdf.staticSchema || [];
      designer.current.updateTemplate({
        ...currentTemplate,
        schemas: [staticSchema],
        basePdf: { width, height, padding: [0, 0, 0, 0] },
      });
      setEditingStaticSchemas(true);
    } else {
      const editedTemplate = designer.current.getTemplate();
      if (!originalTemplate) return;
      const merged = cloneDeep(originalTemplate);
      if (!isBlankPdf(merged.basePdf)) { toast.error("Invalid basePdf format"); return; }
      merged.basePdf.staticSchema = editedTemplate.schemas[0];
      designer.current.updateTemplate(merged);
      setOriginalTemplate(null);
      setEditingStaticSchemas(false);
    }
  };

  // --- Version restore ---
  const restoreVersion = (idx: number) => {
    if (!designer.current) return;
    const entry = versions[idx];
    if (!entry) return;
    designer.current.updateTemplate(cloneDeep(entry.template));
    localStorage.setItem("template", JSON.stringify(entry.template));
    toast.info(`Restored ${entry.label}`);
  };

  useEffect(() => {
    if (designerRef.current) { buildDesigner(); }
    return () => { designer.current?.destroy(); };
  }, [designerRef, buildDesigner]);

  // Get current basePdf info for UI
  const currentTemplate = designer.current?.getTemplate();
  const currentBasePdf = currentTemplate?.basePdf;
  const isBlank = currentBasePdf ? isBlankPdf(currentBasePdf) : true;
  const dis = editingStaticSchemas;
  const btn = (extra = "") =>
    `px-1.5 py-0.5 border rounded hover:bg-gray-100 text-xs whitespace-nowrap ${dis ? "opacity-50 cursor-not-allowed" : ""} ${extra}`;

  // -----------------------------------------------------------------------
  // NavBar items — compact inline controls
  // -----------------------------------------------------------------------
  const navItems: NavItem[] = [
    // --- Base PDF ---
    {
      label: "Base PDF",
      content: (
        <div className="flex items-center gap-1">
          <input disabled={dis} type="file" accept="application/pdf"
            className={`text-xs w-28 ${dis ? "opacity-50 cursor-not-allowed" : ""}`}
            onChange={onChangeBasePDF} />
          {!isBlank && (
            <button disabled={dis} className={btn("text-red-600")} onClick={onRemoveBasePDF}>
              Remove
            </button>
          )}
        </div>
      ),
    },
    // --- Divider ---
    { label: "", content: <div className="h-5 w-px bg-gray-300" /> },
    // --- Version History ---
    {
      label: "Version",
      content: (
        <select className="border rounded px-1 py-0.5 text-xs w-28" value=""
          onChange={(e) => { const idx = Number(e.target.value); if (!isNaN(idx)) restoreVersion(idx); }}>
          <option value="" disabled>{versions.length ? `${versions.length} saved` : "None"}</option>
          {versions.map((v, i) => (
            <option key={i} value={i}>{v.label} — {new Date(v.timestamp).toLocaleTimeString()}</option>
          ))}
        </select>
      ),
    },
    // --- Static Schema ---
    {
      label: "Static",
      content: (
        <button className={btn(editingStaticSchemas ? "bg-yellow-50 border-yellow-400" : "")}
          onClick={toggleEditingStaticSchemas}>
          {editingStaticSchemas ? "Done" : "Edit"}
        </button>
      ),
    },
    // --- Viewer toggle ---
    {
      label: "",
      content: (
        <button disabled={dis}
          className={btn(viewerMode ? "bg-blue-100 border-blue-400" : "")}
          onClick={toggleViewerMode}>
          {viewerMode ? "Exit Viewer" : "Viewer"}
        </button>
      ),
    },
    // --- Divider ---
    { label: "", content: <div className="h-5 w-px bg-gray-300" /> },
    // --- Reset + View Sample + Download Template ---
    {
      label: "",
      content: (
        <div className="flex items-center gap-1">
          <button disabled={dis} className={btn()} onClick={onResetTemplate}>Reset</button>
          <button disabled={dis} className={btn("bg-green-50 border-green-400")}
            onClick={async () => {
              const t0 = performance.now();
              await generatePDF(designer.current);
              toast.info(`Generated in ${Math.round(performance.now() - t0)}ms`);
            }}>View Sample</button>
          <button disabled={dis} className={btn("bg-blue-50 border-blue-400")}
            onClick={() => {
              if (!designer.current) return;
              const t = designer.current.getTemplate();
              const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `template-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.info("Template downloaded");
            }}>Download Template</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <NavBar items={navItems} />
      <div ref={designerRef} className="flex-1 w-full" />
    </>
  );
}

export default DesignerApp;
