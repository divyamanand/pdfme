import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';

interface SchemaEditorProps {
  schemaJson: string;
  onSchemaChange: (json: string) => void;
  error: string | null;
  currentPage: number;
  totalPages: number;
}

const jsonExtensions = [json()];

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

      {/* CodeMirror Editor */}
      <div className={`flex-1 overflow-auto ${error ? 'bg-red-50' : ''}`}>
        <CodeMirror
          value={schemaJson}
          extensions={jsonExtensions}
          onChange={onSchemaChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            highlightActiveLine: true,
            autocompletion: false,
          }}
          style={{ height: '100%', fontSize: 12 }}
        />
      </div>
    </div>
  );
}
