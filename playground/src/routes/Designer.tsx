import React, { useRef, useEffect, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from 'react-toastify';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { cloneDeep, Template, checkTemplate, Lang, isBlankPdf } from "@pdfme/common";
import { Designer } from "@pdfme/ui";
import { Globe, FileText, Upload, Download, Pencil, Braces, Copy, Play, RotateCcw } from 'lucide-react';
import {
  getFontsData,
  getTemplateById,
  getBlankTemplate,
  readFile,
  handleLoadTemplate,
  translations,
} from "../helper";
import { getPlugins } from '../plugins';
import { NavBar, NavItem } from "../components/NavBar";
import { PageSettings } from "../components/PageSettings";
import { SchemaEditor } from "../components/SchemaEditor";
import { TemplateTester } from "../components/TemplateTester";

function DesignerApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const designerRef = useRef<HTMLDivElement | null>(null);
  const designer = useRef<Designer | null>(null);

  const [editingStaticSchemas, setEditingStaticSchemas] = useState(false);
  const [originalTemplate, setOriginalTemplate] = useState<Template | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [schemaJson, setSchemaJson] = useState<string>('[]');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const isUpdatingFromEditor = useRef(false);
  const schemaChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSchemaJson = useCallback((template: Template, page: number) => {
    setCurrentPage(page);
    setTotalPages(template.schemas.length);
    setSchemaJson(JSON.stringify(template.schemas[page] ?? [], null, 2));
    setSchemaError(null);
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
          labels: {
            'signature.clear': "🗑️",
          },
          theme: {
            token: { colorPrimary: "#25c2a0" },
          },
          icons: {
            multiVariableText:
              '<svg fill="#000000" width="24px" height="24px" viewBox="0 0 24 24"><path d="M6.643,13.072,17.414,2.3a1.027,1.027,0,0,1,1.452,0L20.7,4.134a1.027,1.027,0,0,1,0,1.452L9.928,16.357,5,18ZM21,20H3a1,1,0,0,0,0,2H21a1,1,0,0,0,0-2Z"/></svg>',
          },
          maxZoom: 250,
        },
        plugins: getPlugins(),
      });
      designer.current.onSaveTemplate(onSaveTemplate);
      designer.current.onChangeTemplate((template) => {
        localStorage.setItem("template", JSON.stringify(template));
        if (isUpdatingFromEditor.current) {
          isUpdatingFromEditor.current = false;
          return;
        }
        const page = designer.current?.getPageCursor() ?? 0;
        syncSchemaJson(template, page);
      });
      designer.current.onPageChange(({ currentPage: page, totalPages: total }) => {
        setCurrentPage(page);
        setTotalPages(total);
        const template = designer.current?.getTemplate();
        if (template) {
          syncSchemaJson(template, page);
        }
      });
      const initTemplate = designer.current.getTemplate();
      setTotalPages(initTemplate.schemas.length);
      setSchemaJson(JSON.stringify(initTemplate.schemas[0] ?? [], null, 2));

    } catch (error) {
      localStorage.removeItem("template");
      console.error(error);
    }
  }, [searchParams, setSearchParams, syncSchemaJson]);

  const onChangeBasePDF = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      readFile(e.target.files[0], "dataURL").then(async (basePdf) => {
        if (designer.current) {
          const newTemplate = cloneDeep(designer.current.getTemplate());
          newTemplate.basePdf = basePdf;
          designer.current.updateTemplate(newTemplate);
        }
      });
    }
  };

  const onSaveTemplate = (template?: Template) => {
    if (designer.current) {
      localStorage.setItem(
        "template",
        JSON.stringify(template || designer.current.getTemplate())
      );
      toast.success("Saved");
    }
  };

  const onResetTemplate = () => {
    localStorage.removeItem("template");
    if (designer.current) {
      designer.current.updateTemplate(getBlankTemplate());
    }
    setShowResetConfirm(false);
  };

  const handleSchemaChange = (json: string) => {
    setSchemaJson(json);

    if (schemaChangeTimerRef.current) clearTimeout(schemaChangeTimerRef.current);

    schemaChangeTimerRef.current = setTimeout(() => {
      if (!designer.current) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        setSchemaError(`JSON parse error: ${(e as Error).message}`);
        return;
      }

      if (!Array.isArray(parsed)) {
        setSchemaError('schemas must be an array (Schema[])');
        return;
      }

      const currentTemplate = cloneDeep(designer.current.getTemplate());
      const page = designer.current.getPageCursor();
      const newSchemas = [...currentTemplate.schemas];
      newSchemas[page] = parsed as Template['schemas'][number];

      const candidateTemplate: Template = {
        ...currentTemplate,
        schemas: newSchemas,
      };

      try {
        checkTemplate(candidateTemplate);
      } catch (e) {
        setSchemaError(`Validation error: ${(e as Error).message}`);
        return;
      }

      setSchemaError(null);
      isUpdatingFromEditor.current = true;
      designer.current.updateTemplate(candidateTemplate);
    }, 400);
  };

  const openSchemaModal = () => {
    if (designer.current) {
      const template = designer.current.getTemplate();
      const page = designer.current.getPageCursor();
      syncSchemaJson(template, page);
    }
    setShowSchemaModal(true);
  };

  const toggleEditingStaticSchemas = () => {
    if (!designer.current) return;

    if (!editingStaticSchemas) {
      const currentTemplate = cloneDeep(designer.current.getTemplate());
      if (!isBlankPdf(currentTemplate.basePdf)) {
        toast.error(<div>
          <p>The current template cannot edit the static schema.</p>
          <a
            className="text-blue-500 underline"
            target="_blank"
            rel="noopener noreferrer"
            href="https://pdfme.com/docs/headers-and-footers"
          >
            See: Headers and Footers
          </a>
        </div>);
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
      if (!isBlankPdf(merged.basePdf)) {
        toast.error("Invalid basePdf format");
        return;
      }

      merged.basePdf.staticSchema = editedTemplate.schemas[0];
      designer.current.updateTemplate(merged);

      setOriginalTemplate(null);
      setEditingStaticSchemas(false);
    }
  };

  useEffect(() => {
    if (designerRef.current) {
      buildDesigner();
    }
    return () => {
      designer.current?.destroy();
    };
  }, [designerRef, buildDesigner]);

  const navItems: NavItem[] = [
    // Left side - controls with dropdowns
    {
      label: "Page Settings",
      content: (
        <PageSettings
          disabled={editingStaticSchemas}
          designer={designer}
        />
      ),
    },
    {
      label: "Language",
      content: (
        <select
          disabled={editingStaticSchemas}
          className={`border rounded px-2 py-1 text-sm ${editingStaticSchemas ? "opacity-50 cursor-not-allowed" : ""}`}
          onChange={(e) => {
            designer.current?.updateOptions({ lang: e.target.value as Lang });
          }}
        >
          {translations.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      ),
    },

    // Right side - icon buttons
    {
      label: "Load Template",
      tooltip: "Load Template",
      icon: <Download size={18} />,
      isIconOnly: true,
      disabled: editingStaticSchemas,
      fileAccept: "application/json",
      onFileChange: (e) => handleLoadTemplate(e, designer.current),
    },
    {
      label: "Change BasePDF",
      tooltip: "Change BasePDF",
      icon: <Upload size={18} />,
      isIconOnly: true,
      disabled: editingStaticSchemas,
      fileAccept: "application/pdf",
      onFileChange: onChangeBasePDF,
    },
    {
      label: "Schema Editor",
      tooltip: "Schema Editor",
      icon: <Braces size={18} />,
      isIconOnly: true,
      disabled: editingStaticSchemas,
      onClick: openSchemaModal,
    },
    {
      label: editingStaticSchemas ? "End Editing" : "Edit Static Schema",
      tooltip: editingStaticSchemas ? "End Editing" : "Edit Static Schema",
      icon: <Pencil size={18} />,
      isIconOnly: true,
      onClick: toggleEditingStaticSchemas,
    },
    {
      label: "Copy Template",
      tooltip: "Copy Template",
      icon: <Copy size={18} />,
      isIconOnly: true,
      disabled: editingStaticSchemas,
      onClick: () => {
        if (!designer.current) return;
        const template = designer.current.getTemplate();
        const json = JSON.stringify(template, null, 2);
        navigator.clipboard.writeText(json).then(() => {
          toast.success("Template copied to clipboard");
        });
      },
    },
    {
      label: "Test Template",
      tooltip: "Test Template",
      icon: <Play size={18} />,
      isIconOnly: true,
      disabled: editingStaticSchemas,
      onClick: () => setShowTester(true),
    },
    {
      label: "Reset",
      tooltip: "Reset Template",
      icon: <RotateCcw size={18} />,
      isIconOnly: true,
      disabled: editingStaticSchemas,
      onClick: () => setShowResetConfirm(true),
    },
  ];

  return (
    <>
      <NavBar items={navItems} />
      <div ref={designerRef} className="flex-1 w-full" />

      {/* Schema Editor Modal */}
      <Dialog open={showSchemaModal} onClose={() => setShowSchemaModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-4 flex items-center justify-center">
          <DialogPanel className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col" style={{ height: '85vh' }}>
            <SchemaEditor
              schemaJson={schemaJson}
              onSchemaChange={handleSchemaChange}
              error={schemaError}
              currentPage={currentPage}
              totalPages={totalPages}
              onClose={() => setShowSchemaModal(false)}
            />
          </DialogPanel>
        </div>
      </Dialog>

      {/* Template Tester Modal */}
      <TemplateTester
        open={showTester}
        onClose={() => setShowTester(false)}
        designer={designer}
      />

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirm} onClose={() => setShowResetConfirm(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-5 py-4">
              <DialogTitle className="text-base font-semibold">Reset Template</DialogTitle>
              <p className="mt-2 text-sm text-gray-600">
                This will discard all changes and reset the template to a blank page. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-lg">
              <button
                className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                onClick={onResetTemplate}
              >
                Reset
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}

export default DesignerApp;
