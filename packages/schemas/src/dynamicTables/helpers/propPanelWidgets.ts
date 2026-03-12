/**
 * Re-exports for backward compatibility.
 * The implementations have been split into focused files:
 *   - helpers/domUtils.ts           — shared DOM helpers + getTableAndCommit
 *   - helpers/regionStyleControls.ts — renderRegionStyleControls
 *   - helpers/cellStyleControls.ts  — renderCellStyleControls
 *   - helpers/widgets/settingsWidgets.ts — headerVisibilityWidget, constraintsWidget, overflowWidget
 *   - helpers/widgets/styleWidgets.ts   — tableStyleWidget, regionStyleSelectWidget, cellStyleWidget
 *   - helpers/widgets/structureWidget.ts — structureWidget
 */

export { headerVisibilityWidget, constraintsWidget, overflowWidget } from './widgets/settingsWidgets.js';
export { tableStyleWidget, regionStyleSelectWidget, cellStyleWidget } from './widgets/styleWidgets.js';
export { structureWidget } from './widgets/structureWidget.js';
