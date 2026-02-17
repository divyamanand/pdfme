import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';

interface SchemaEditorProps {
  open: boolean;
  onClose: () => void;
  schemaJson: string;
  onSchemaChange: (json: string) => void;
  error: string | null;
}

export function SchemaEditor({
  open,
  onClose,
  schemaJson,
  onSchemaChange,
  error,
}: SchemaEditorProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
      />
      <div className="fixed inset-0 z-10 flex flex-col">
        <DialogPanel className="flex flex-col w-full h-full bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-lg font-semibold">Edit Schema JSON</DialogTitle>
              <p className="text-xs text-gray-600">
                Editing <code className="bg-gray-100 px-1 py-0.5 rounded">template.schemas</code>
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-100 font-medium"
            >
              Close
            </button>
          </div>

          {/* Error bar (conditional) */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 font-mono text-xs shrink-0">
              {error}
            </div>
          )}

          {/* Textarea */}
          <textarea
            className={`flex-1 p-4 font-mono text-sm resize-none outline-none border-2 ${
              error ? 'border-red-400 bg-red-50' : 'border-transparent'
            }`}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={schemaJson}
            onChange={(e) => onSchemaChange(e.target.value)}
          />
        </DialogPanel>
      </div>
    </Dialog>
  );
}
