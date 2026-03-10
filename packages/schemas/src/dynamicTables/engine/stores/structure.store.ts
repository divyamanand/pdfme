import { IStructureStore } from "../interfaces";
import { Region } from "../types";

export class StructureStore implements IStructureStore {
    private headerRoots: Map<Region, string[]>
    private childrenMap: Map<string, string[]>
    private parentMap: Map<string, string>
    private body: string[][]

    constructor() {
        this.headerRoots = new Map()
        this.body = []
        this.parentMap = new Map()
        this.childrenMap = new Map()
    }

    private setRegionStructure(region: Region, arr: string[]): void {
        this.headerRoots.set(region, arr)
    }

    isLeafCell(cellId: string): boolean {
        return !this.childrenMap.has(cellId) || this.childrenMap.get(cellId)?.length === 0
    }

    getLeafCells(cellId: string): string[] {
        const children = this.childrenMap.get(cellId) || []

        if (children.length === 0) return [cellId]

        const res = []

        for (const child of children) {
            if (this.isLeafCell(child)) {
                res.push(child)
            } else {
                res.push(...this.getLeafCells(child))
            }
        }

        return res
    }

    getBodyIndexForHeaderLeafCell(region: Region, cellId: string): number {
        let index = 0
        const headers = this.headerRoots.get(region) || []

        for (const header of headers) {
            const leafCells = this.getLeafCells(header)
            if (leafCells.includes(cellId)) {
                const cellIndex = leafCells.indexOf(cellId)
                return index + cellIndex
            } else {
                index += leafCells.length
            }
        }
        return -1
    }

    private getTotalLeafCount(region: Region): number {
        return (this.headerRoots.get(region) || [])
            .reduce((sum, root) => sum + this.getLeafCells(root).length, 0)
    }

    getHeightOfCell(cellId: string): number {
        if (this.isLeafCell(cellId)) return 1
        const children = this.childrenMap.get(cellId) || []

        let maxHeight = 0

        for (const child of children) {
            const height = this.getHeightOfCell(child)
            maxHeight = Math.max(maxHeight, height)
        }

        return 1 + maxHeight
    }

    getLeafCount(region: Region): number {
        return this.getTotalLeafCount(region)
    }

    addRootCell(cellId: string, region: Region): void {
        const cellRegion = this.headerRoots.get(region) || []
        this.setRegionStructure(region, [...cellRegion, cellId])
    }

    removeRootCell(cellId: string, region: Region): void {
        const cellRegion = this.headerRoots.get(region)
        const children = this.childrenMap.get(cellId) || []
        const filteredRegion = cellRegion?.filter((id) => id !== cellId) || []
        this.setRegionStructure(region, [...filteredRegion, ...children])

        if (this.childrenMap.has(cellId)) {
            this.childrenMap.delete(cellId)
        }
        for (const child of children) {
            this.parentMap.delete(child)
        }
    }

    getRoots(region: Region): readonly string[] | undefined {
        return this.headerRoots.get(region)
    }

    addChildCell(parentId: string, region: Region, childId: string, index?: number): void {
        this.parentMap.set(childId, parentId)
        let children = this.childrenMap.get(parentId)
        if (!children) {
            children = []
            this.childrenMap.set(parentId, children)
        }
        if (index !== undefined) {
            children.splice(index, 0, childId)
        } else {
            children.push(childId)
        }
    }

    getChildren(parentId: string): readonly string[] | undefined {
        return this.childrenMap.get(parentId)
    }

    insertBodyRow(rowIndex: number, cellIds: string[]): void {
        this.body.splice(rowIndex, 0, cellIds)
    }

    removeBodyRow(rowIndex: number): string[] {
        if (rowIndex >= 0 && rowIndex < this.body.length) {
            return this.body.splice(rowIndex, 1)[0]
        }
        return []
    }

    insertBodyCol(colIndex: number, cellIds: string[]): void {
        this.body = this.body.map((bodyRow, rowIdx) => {
            const updatedRow = [...bodyRow]
            updatedRow.splice(colIndex, 0, cellIds[rowIdx])
            return updatedRow
        })
    }

    removeBodyCol(colIndex: number): string[] {
        const removed: string[] = []
        this.body = this.body.map((bodyRow) => {
            removed.push(bodyRow[colIndex])
            return bodyRow.filter((_, idx) => colIndex !== idx)
        })
        return removed
    }

    removeChildCell(parentId: string, childId: string, region: Region): void {
        const children = this.childrenMap.get(childId) || []
        const childrenOfParent = this.childrenMap.get(parentId) || []
        const filteredChildren = childrenOfParent.filter(id => id !== childId)
        const updatedChildren = [...filteredChildren, ...children]

        if (this.childrenMap.has(childId)) {
            this.childrenMap.delete(childId)
        }
        this.childrenMap.set(parentId, updatedChildren)
        this.parentMap.delete(childId)
        for (const child of children) {
            this.parentMap.set(child, parentId)
        }
    }

    getBodyCell(rowIndex: number, colIndex: number): string | undefined {
        const row = this.body[rowIndex]
        if (row) {
            return row[colIndex]
        }
        return undefined
    }

    getBody(): readonly (readonly string[])[] {
        return this.body
    }

    countTotalCols(): number {
        return this.headerRoots.get("theader")?.length ?? 0
    }

    countTotalRows(): number {
        let maxTHeaderRows = 0

        for (const header of this.headerRoots.get("theader") || []) {
            maxTHeaderRows = Math.max(maxTHeaderRows, this.getHeightOfCell(header))
        }
        return this.body.length + maxTHeaderRows
    }

    reorderHeaderCell(region: Region, fromIndex: number, toIndex: number, withChildren?: boolean): void {

    }
}
