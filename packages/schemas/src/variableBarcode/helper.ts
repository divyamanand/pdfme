/** Regex matching only simple JS identifiers: {name}, {orderId} — not expressions like {a * 1.1} */
export const SIMPLE_VAR_REGEX = /\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g;

/** Known JS globals/keywords that should NOT be treated as user-defined variables */
const RESERVED_NAMES = new Set([
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in',
  'void', 'delete', 'new', 'this', 'NaN', 'Infinity',
  'Math', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Date', 'JSON',
  'isNaN', 'parseFloat', 'parseInt', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'date', 'dateTime',
  'currentPage', 'totalPages',
]);

/**
 * Extract user-defined identifiers from an expression string.
 * Skips member-access properties (after `.`), string literals, and reserved names.
 */
const extractIdentifiers = (expr: string): string[] => {
  const cleaned = expr.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
  const tokenRegex = /\.?[a-zA-Z_$][a-zA-Z0-9_$]*/g;
  const ids = new Set<string>();
  let m;
  while ((m = tokenRegex.exec(cleaned)) !== null) {
    const token = m[0];
    if (token.startsWith('.')) continue;
    if (!RESERVED_NAMES.has(token)) ids.add(token);
  }
  return Array.from(ids);
};

/**
 * Scans `text` for all {...} blocks and extracts user-defined identifiers.
 * Handles both simple {varName} and expressions like {price * 1.1}.
 * Adds new variables (default value = uppercased name), removes deleted ones.
 * Returns true if anything changed.
 */
export function updateVariablesFromText(text: string, variables: Record<string, string>): boolean {
  const blockRegex = /\{([^{}]+)\}/g;
  const allVarNames = new Set<string>();
  let blockMatch;
  while ((blockMatch = blockRegex.exec(text)) !== null) {
    for (const id of extractIdentifiers(blockMatch[1])) {
      allVarNames.add(id);
    }
  }

  let changed = false;
  for (const varName of allVarNames) {
    if (!(varName in variables)) {
      variables[varName] = varName.toUpperCase();
      changed = true;
    }
  }
  for (const varName of Object.keys(variables)) {
    if (!allVarNames.has(varName)) {
      delete variables[varName];
      changed = true;
    }
  }
  return changed;
}
