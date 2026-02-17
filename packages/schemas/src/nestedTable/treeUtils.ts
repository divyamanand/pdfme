import type { NestedHeaderNode, HeaderCell } from './types.js';

// Form-render may strip the `children` array when storing/retrieving tree data.
// All functions must treat missing `children` as an empty array (leaf node).
const ch = (node: NestedHeaderNode): NestedHeaderNode[] => node.children || [];

export function getLeafNodes(nodes: NestedHeaderNode[]): NestedHeaderNode[] {
  const leaves: NestedHeaderNode[] = [];

  function walk(node: NestedHeaderNode) {
    if (ch(node).length === 0) {
      leaves.push(node);
    } else {
      ch(node).forEach(walk);
    }
  }

  nodes.forEach(walk);
  return leaves;
}

export function getTreeDepth(nodes: NestedHeaderNode[]): number {
  if (nodes.length === 0) return 0;

  function getNodeDepth(node: NestedHeaderNode): number {
    if (ch(node).length === 0) return 1;
    return 1 + Math.max(...ch(node).map(getNodeDepth));
  }

  return Math.max(...nodes.map(getNodeDepth));
}

export function getColspan(node: NestedHeaderNode): number {
  if (ch(node).length === 0) return 1;
  return ch(node).reduce((sum, child) => sum + getColspan(child), 0);
}

export function getRowspan(node: NestedHeaderNode, nodeDepth: number, maxDepth: number): number {
  if (ch(node).length === 0) {
    return maxDepth - nodeDepth;
  }
  return 1;
}

export function buildHeaderRows(nodes: NestedHeaderNode[]): HeaderCell[][] {
  const maxDepth = getTreeDepth(nodes);
  const rows: HeaderCell[][] = Array.from({ length: maxDepth }, () => []);
  let leafIndex = 0;

  function walk(node: NestedHeaderNode, depth: number) {
    const startLeaf = leafIndex;
    const cell: HeaderCell = {
      node,
      label: node.label,
      colspan: getColspan(node),
      rowspan: getRowspan(node, depth, maxDepth),
      row: depth,
      colStart: startLeaf,
    };
    rows[depth].push(cell);

    if (ch(node).length === 0) {
      leafIndex++;
    } else {
      ch(node).forEach((child) => walk(child, depth + 1));
    }
  }

  nodes.forEach((node) => walk(node, 0));
  return rows;
}

export function getLeafWidthPercentages(nodes: NestedHeaderNode[]): number[] {
  const leaves = getLeafNodes(nodes);
  const totalWidth = leaves.reduce((sum, leaf) => sum + (leaf.width || 0), 0);

  if (totalWidth === 0) {
    return leaves.map(() => 100 / leaves.length);
  }

  return leaves.map((leaf) => ((leaf.width || 0) / totalWidth) * 100);
}

export function generateNodeId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `nh_${timestamp}_${random}`;
}

export function addChildToNode(
  nodes: NestedHeaderNode[],
  parentId: string,
  newChild: NestedHeaderNode
): NestedHeaderNode[] {
  return JSON.parse(JSON.stringify(nodes), (_key, value) => {
    if (value && typeof value === 'object' && value.id === parentId) {
      const children = value.children || [];
      if (children.length === 0 && value.width !== undefined) {
        newChild.width = value.width;
        value.width = undefined;
      }
      value.children = [...children, newChild];
    }
    return value;
  });
}

export function removeNode(nodes: NestedHeaderNode[], targetId: string): NestedHeaderNode[] {
  const cloned = JSON.parse(JSON.stringify(nodes));

  function walk(nodeList: NestedHeaderNode[]): boolean {
    const index = nodeList.findIndex((n) => n.id === targetId);
    if (index !== -1) {
      nodeList.splice(index, 1);
      return true;
    }
    for (const node of nodeList) {
      if (walk(node.children || [])) return true;
    }
    return false;
  }

  function promoteLeafIfNeeded(nodeList: NestedHeaderNode[]) {
    for (const node of nodeList) {
      const children = node.children || [];
      if (children.length === 0) continue;
      const remainingChildren = children.filter((c: NestedHeaderNode) => c.id !== targetId);
      if (remainingChildren.length === 0) {
        node.children = [];
      } else {
        node.children = remainingChildren;
      }
      promoteLeafIfNeeded(node.children || []);
    }
  }

  walk(cloned);
  promoteLeafIfNeeded(cloned);

  return cloned.filter((n: NestedHeaderNode) => n.id !== targetId);
}

export function renameNode(
  nodes: NestedHeaderNode[],
  targetId: string,
  newLabel: string
): NestedHeaderNode[] {
  return JSON.parse(JSON.stringify(nodes), (_key, value) => {
    if (value && typeof value === 'object' && value.id === targetId) {
      value.label = newLabel;
    }
    return value;
  });
}

export function updateLeafWidth(
  nodes: NestedHeaderNode[],
  leafId: string,
  newPercent: number
): NestedHeaderNode[] {
  return JSON.parse(JSON.stringify(nodes), (_key, value) => {
    if (value && typeof value === 'object' && value.id === leafId && (value.children || []).length === 0) {
      value.width = newPercent;
    }
    return value;
  });
}

export function findNodeById(nodes: NestedHeaderNode[], id: string): NestedHeaderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children || [], id);
    if (found) return found;
  }
  return null;
}

export function walkTreeForEachNode(
  nodes: NestedHeaderNode[],
  callback: (node: NestedHeaderNode) => void
): void {
  nodes.forEach((node: NestedHeaderNode) => {
    callback(node);
    if ((node.children || []).length > 0) {
      walkTreeForEachNode(node.children || [], callback);
    }
  });
}
