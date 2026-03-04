import { MindMapNode, BRANCH_PALETTES, BranchPalette } from './types';

/** Get the root-level branch ancestor of a node */
export const getRootBranchId = (nodeId: string, nodes: MindMapNode[]): string | null => {
  let current = nodes.find(n => n.id === nodeId);
  if (!current || !current.parentId) return null;
  while (current && current.parentId && current.parentId !== 'root') {
    current = nodes.find(n => n.id === current!.parentId);
  }
  return current?.id ?? null;
};

/** Get palette for a node based on which root branch it belongs to */
export const getBranchPalette = (nodeId: string, nodes: MindMapNode[]): BranchPalette => {
  const branchId = getRootBranchId(nodeId, nodes);
  if (!branchId) return BRANCH_PALETTES[0];
  const rootChildren = nodes.filter(n => n.parentId === 'root');
  const idx = rootChildren.findIndex(n => n.id === branchId);
  return BRANCH_PALETTES[(idx >= 0 ? idx : 0) % BRANCH_PALETTES.length];
};

/** Get depth of a node in the tree */
export const getNodeDepth = (nodeId: string, nodes: MindMapNode[]): number => {
  let depth = 0;
  let current = nodes.find(n => n.id === nodeId);
  while (current?.parentId) { depth++; current = nodes.find(n => n.id === current!.parentId); }
  return depth;
};

/** Get all descendant IDs */
export const getDescendants = (nodeId: string, nodes: MindMapNode[]): string[] => {
  const children = nodes.filter(n => n.parentId === nodeId);
  return children.flatMap(c => [c.id, ...getDescendants(c.id, nodes)]);
};

/** Get visible nodes (respecting collapsed state) */
export const getVisibleNodes = (nodes: MindMapNode[]): MindMapNode[] => {
  const collapsedIds = new Set<string>();
  // Find all collapsed nodes and collect their descendants
  nodes.forEach(n => {
    if (n.collapsed) {
      getDescendants(n.id, nodes).forEach(id => collapsedIds.add(id));
    }
  });
  return nodes.filter(n => !collapsedIds.has(n.id));
};

/** Auto-layout: arrange nodes in a radial tree */
export const autoLayout = (nodes: MindMapNode[]): MindMapNode[] => {
  const root = nodes.find(n => n.id === 'root');
  if (!root) return nodes;

  const updated = new Map<string, { x: number; y: number }>();
  updated.set('root', { x: 0, y: 0 });

  const getChildren = (parentId: string) =>
    nodes.filter(n => n.parentId === parentId && !nodes.find(p => p.id === parentId)?.collapsed);

  const layoutBranch = (parentId: string, parentX: number, parentY: number, depth: number) => {
    const children = getChildren(parentId);
    if (children.length === 0) return;

    const xGap = depth === 0 ? 320 : depth === 1 ? 260 : 200;
    const ySpacing = depth === 0 ? 180 : depth === 1 ? 100 : 60;

    const totalHeight = children.length * ySpacing;
    const startY = parentY - totalHeight / 2 + ySpacing / 2;

    children.forEach((child, i) => {
      const cx = parentX + xGap;
      const cy = startY + i * ySpacing;
      updated.set(child.id, { x: cx, y: cy });
      layoutBranch(child.id, cx, cy, depth + 1);
    });
  };

  layoutBranch('root', 0, 0, 0);

  return nodes.map(n => {
    const pos = updated.get(n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : n;
  });
};

/** Storage helpers */
const STORAGE_KEY_PREFIX = 'mindmap-nodes-';

export const loadNodesFromStorage = (viewId: string): MindMapNode[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + viewId);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { console.error('Error loading mindmap:', e); }
  return null;
};

export const saveNodesToStorage = (viewId: string, nodes: MindMapNode[]) => {
  try { localStorage.setItem(STORAGE_KEY_PREFIX + viewId, JSON.stringify(nodes)); }
  catch (e) { console.error('Error saving mindmap:', e); }
};
