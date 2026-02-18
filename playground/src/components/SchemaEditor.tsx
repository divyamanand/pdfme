interface SchemaEditorProps {
  schemaJson: string;
  onSchemaChange: (json: string) => void;
  error: string | null;
  currentPage: number;
  totalPages: number;
}

export function SchemaEditor({
  schemaJson,
  onSchemaChange,
  error,
  currentPage,
  totalPages,
}: SchemaEditorProps) {
  return (
    <div className="flex flex-col h-full bg-white border-l">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Schema JSON</h3>
          <p className="text-xs text-gray-600">
            Page {currentPage + 1} of {totalPages} &mdash;{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">template.schemas[{currentPage}]</code>
          </p>
        </div>
      </div>

      {/* Error bar (conditional) */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 font-mono text-xs shrink-0 break-words">
          {error}
        </div>
      )}

      {/* Textarea */}
      <textarea
        className={`flex-1 p-3 font-mono text-xs resize-none outline-none border-0 overflow-auto ${
          error ? 'bg-red-50' : 'bg-white'
        }`}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        value={schemaJson}
        onChange={(e) => onSchemaChange(e.target.value)}
      />
    </div>
  );
}
