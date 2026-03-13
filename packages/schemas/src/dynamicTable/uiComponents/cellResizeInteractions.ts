import type { RenderableTableInstance, RenderableRow, Table, Region } from '../engine/index.js'

const MIN_CELL_SIZE = 3   // mm

/**
 * Attaches scroll + right-click resize interactions to all table cells in designer mode.
 * Uses event delegation on the root element to bypass child elements created by cellUiRender.
 *
 * - Shift + Scroll: resize column width (shared for non-footer; per-cell for footer)
 * - Alt + Scroll: resize row height
 * - Right-click: context menu with numeric Width/Height inputs
 *
 * Scroll direction: UP = increase, DOWN = decrease (fixed 1mm step)
 */
/** Key for storing AbortController on root element to clean up previous listeners */
const ABORT_KEY = Symbol('resizeAbort')

export function attachCellResizeInteractions(
    root: HTMLElement & { [ABORT_KEY]?: AbortController },
    snapshot: RenderableTableInstance,
    table: Table,
    commit: () => void,
): void {
    // Clean up listeners from previous render to prevent accumulation
    root[ABORT_KEY]?.abort()
    const controller = new AbortController()
    root[ABORT_KEY] = controller
    const { signal } = controller

    // Build a lookup: cellID → { row, region } for fast access on event
    const cellMap = new Map<string, { row: RenderableRow; region: Region; colIdx: number }>()

    const REGIONS = ['theader', 'lheader', 'rheader', 'body', 'footer'] as const
    for (const region of REGIONS) {
        for (const row of snapshot.getRowsInRegion(region)) {
            for (const [, cell] of row.cells) {
                cellMap.set(cell.cellID, { row, region, colIdx: cell.layout.col })
            }
        }
    }

    // Walk up from event target to find the nearest [data-cellId] element
    function getCellIdFromTarget(target: EventTarget | null): string | null {
        let el = target as HTMLElement | null
        while (el && el !== root) {
            if (el.dataset?.cellId) return el.dataset.cellId
            el = el.parentElement
        }
        return null
    }

    // Single delegated wheel listener on root
    root.addEventListener('wheel', (e: WheelEvent) => {
        if (!e.shiftKey && !e.altKey) return

        const cellId = getCellIdFromTarget(e.target)
        if (!cellId) return

        const entry = cellMap.get(cellId)
        if (!entry) return

        e.preventDefault()
        e.stopPropagation()

        const { row, region, colIdx } = entry
        const isFooter = region === 'footer'
        const step = e.deltaY > 0 ? -1 : 1  // scroll up = increase

        if (e.shiftKey) {
            const currentWidth = isFooter
                ? (table.getFooterCellWidths()[row.rowIndex]?.[colIdx] ?? 30)
                : (table.getColumnWidths()[colIdx] ?? 30)
            const newWidth = Math.max(MIN_CELL_SIZE, currentWidth + step)
            if (isFooter) table.setFooterCellWidth(row.rowIndex, colIdx, newWidth)
            else table.setColumnWidth(colIdx, newWidth)
            commit()
        } else {
            const currentHeight = isFooter
                ? (table.getFooterRowHeights()[row.rowIndex] ?? 10)
                : (table.getRowHeights()[row.globalRowIndex] ?? 10)
            const newHeight = Math.max(MIN_CELL_SIZE, currentHeight + step)
            if (isFooter) table.setFooterRowHeight(row.rowIndex, newHeight)
            else table.setRowHeight(row.globalRowIndex, newHeight)
            commit()
        }
    }, { passive: false, capture: true, signal })

    // Single delegated contextmenu listener on root
    root.addEventListener('contextmenu', (e: MouseEvent) => {
        const cellId = getCellIdFromTarget(e.target)
        if (!cellId) return

        const entry = cellMap.get(cellId)
        if (!entry) return

        e.preventDefault()
        e.stopPropagation()

        const { row, region, colIdx } = entry
        const isFooter = region === 'footer'

        const currentWidth = isFooter
            ? (table.getFooterCellWidths()[row.rowIndex]?.[colIdx] ?? 30)
            : (table.getColumnWidths()[colIdx] ?? 30)
        const currentHeight = isFooter
            ? (table.getFooterRowHeights()[row.rowIndex] ?? 10)
            : (table.getRowHeights()[row.globalRowIndex] ?? 10)

        showResizeMenu(
            e,
            currentWidth,
            currentHeight,
            (w) => {
                if (isFooter) table.setFooterCellWidth(row.rowIndex, colIdx, w)
                else table.setColumnWidth(colIdx, w)
                commit()
            },
            (h) => {
                if (isFooter) table.setFooterRowHeight(row.rowIndex, h)
                else table.setRowHeight(row.globalRowIndex, h)
                commit()
            },
        )
    }, { capture: true, signal })
}

function showResizeMenu(
    e: MouseEvent,
    currentWidth: number,
    currentHeight: number,
    onWidth: (v: number) => void,
    onHeight: (v: number) => void,
): void {
    document.getElementById('cell-resize-menu')?.remove()

    const menu = document.createElement('div')
    menu.id = 'cell-resize-menu'
    Object.assign(menu.style, {
        position: 'fixed',
        top: `${e.clientY}px`,
        left: `${e.clientX}px`,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: '6px',
        padding: '10px 12px',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontSize: '12px',
        minWidth: '180px',
    })

    const title = document.createElement('div')
    title.textContent = 'Resize Cell'
    Object.assign(title.style, { fontWeight: '600', marginBottom: '8px', color: '#333' })
    menu.appendChild(title)

    const makeField = (label: string, value: number, onApply: (v: number) => void) => {
        const fieldRow = document.createElement('div')
        Object.assign(fieldRow.style, {
            display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px',
        })
        const lbl = document.createElement('label')
        lbl.textContent = label
        Object.assign(lbl.style, { flex: '0 0 60px', color: '#555' })
        const inp = document.createElement('input')
        inp.type = 'number'
        inp.value = String(Math.round(value * 100) / 100)
        inp.min = String(MIN_CELL_SIZE)
        inp.step = '0.5'
        Object.assign(inp.style, {
            width: '60px', padding: '2px 4px',
            border: '1px solid #ccc', borderRadius: '3px',
        })
        const unit = document.createElement('span')
        unit.textContent = 'mm'
        unit.style.color = '#888'
        fieldRow.appendChild(lbl)
        fieldRow.appendChild(inp)
        fieldRow.appendChild(unit)

        const apply = () => {
            const v = Math.max(MIN_CELL_SIZE, parseFloat(inp.value) || MIN_CELL_SIZE)
            onApply(Math.round(v * 100) / 100)
        }
        inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { apply(); menu.remove(); cleanup() }
        })
        inp.addEventListener('change', apply)
        menu.appendChild(fieldRow)
    }

    makeField('Width:', currentWidth, onWidth)
    makeField('Height:', currentHeight, onHeight)

    const close = (ev: Event) => {
        if (!menu.contains(ev.target as Node)) { menu.remove(); cleanup() }
    }
    const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') { menu.remove(); cleanup() }
    }
    const cleanup = () => {
        document.removeEventListener('click', close)
        document.removeEventListener('keydown', onKey)
    }
    setTimeout(() => document.addEventListener('click', close), 0)
    document.addEventListener('keydown', onKey)

    document.body.appendChild(menu)
}
