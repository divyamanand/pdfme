/**
 * Thin Table cache — avoids reconstructing from JSON on every pdfme render call.
 *
 * pdfme may call pdf() or ui() many times in rapid succession (e.g., during
 * drag/resize in the designer). This cache ensures we only reconstruct when
 * the value actually changes. Table instance is preserved across renders so
 * transient UI state (editing, selection) survives re-renders.
 */

import { Table } from './engine/index.js';

const cache = new Map<string, { table: Table; value: string }>();

/**
 * Get a cached Table for the given schema key, or create one from JSON.
 * Returns the same Table instance as long as the value string hasn't changed.
 */
export function getTable(key: string, json: string): Table {
  const cached = cache.get(key);
  if (cached && cached.value === json) return cached.table;

  const table = Table.fromJSON(json);
  cache.set(key, { table, value: json });
  return table;
}

/**
 * After mutating a Table, call this to update the cache and get the new JSON.
 */
export function commitTable(key: string, table: Table): string {
  const json = table.toJSON();
  cache.set(key, { table, value: json });
  return json;
}
