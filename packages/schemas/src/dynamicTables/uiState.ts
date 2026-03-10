/**
 * Shared mutable UI state for the dynamic table plugin.
 * Module-level singletons — same pattern as tables/uiRender.ts editing positions.
 */

export const state = {
  editingCellId: null as string | null,
  selectedCells: new Set<string>(),
  selectionAnchor: null as { row: number; col: number; region: string } | null,
  contextMenuEl: null as HTMLDivElement | null,
};

export function resetState(): void {
  state.editingCellId = null;
  state.selectedCells.clear();
  state.selectionAnchor = null;
  dismissContextMenu();
}

export function dismissContextMenu(): void {
  if (state.contextMenuEl) {
    state.contextMenuEl.remove();
    state.contextMenuEl = null;
  }
}
