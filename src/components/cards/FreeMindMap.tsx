import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ZoomIn, ZoomOut, Maximize2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId: string | null;
  color: string;
}

interface FreeMindMapProps {
  viewId?: string;
  onSave?: (nodes: MindMapNode[]) => void;
  initialNodes?: MindMapNode[];
}

const BRANCH_PALETTES = [
  { bg: '#f59e0b', line: '#f59e0b', dot: '#f59e0b' }, // amber
  { bg: '#8b5cf6', line: '#8b5cf6', dot: '#8b5cf6' }, // purple
  { bg: '#06b6d4', line: '#06b6d4', dot: '#06b6d4' }, // cyan
  { bg: '#ec4899', line: '#ec4899', dot: '#ec4899' }, // pink
  { bg: '#3b82f6', line: '#3b82f6', dot: '#3b82f6' }, // blue
  { bg: '#22c55e', line: '#22c55e', dot: '#22c55e' }, // green
  { bg: '#ef4444', line: '#ef4444', dot: '#ef4444' }, // red
  { bg: '#f97316', line: '#f97316', dot: '#f97316' }, // orange
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_ROOT_NODE: MindMapNode = {
  id: 'root',
  text: 'Ideia Central',
  x: 500,
  y: 350,
  parentId: null,
  color: '#1e293b',
};

const STORAGE_KEY_PREFIX = 'mindmap-nodes-';

const loadNodesFromStorage = (viewId: string): MindMapNode[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + viewId);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { console.error('Error loading mindmap:', e); }
  return null;
};

const saveNodesToStorage = (viewId: string, nodes: MindMapNode[]) => {
  try { localStorage.setItem(STORAGE_KEY_PREFIX + viewId, JSON.stringify(nodes)); }
  catch (e) { console.error('Error saving mindmap:', e); }
};

/** Trace up to root's direct child to get branch palette */
const getBranchPalette = (nodeId: string, nodes: MindMapNode[]) => {
  let current = nodes.find(n => n.id === nodeId);
  if (!current) return BRANCH_PALETTES[0];
  while (current && current.parentId && current.parentId !== 'root') {
    current = nodes.find(n => n.id === current!.parentId);
  }
  if (!current) return BRANCH_PALETTES[0];
  const rootChildren = nodes.filter(n => n.parentId === 'root');
  const idx = rootChildren.findIndex(n => n.id === current!.id);
  return BRANCH_PALETTES[(idx >= 0 ? idx : 0) % BRANCH_PALETTES.length];
};

const getNodeDepth = (nodeId: string, nodes: MindMapNode[]): number => {
  let depth = 0;
  let current = nodes.find(n => n.id === nodeId);
  while (current?.parentId) { depth++; current = nodes.find(n => n.id === current!.parentId); }
  return depth;
};

export const FreeMindMap: React.FC<FreeMindMapProps> = ({ viewId = 'default', onSave, initialNodes }) => {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<MindMapNode[]>(() => {
    if (initialNodes?.length) return initialNodes;
    return loadNodesFromStorage(viewId) || [{ ...DEFAULT_ROOT_NODE }];
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesViewIdRef = useRef(viewId);
  const nodesRef = useRef(nodes);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => {
    if (nodes.length > 0) { saveNodesToStorage(nodesViewIdRef.current, nodes); setHasUnsavedChanges(true); }
  }, [nodes]);

  useEffect(() => {
    if (nodesViewIdRef.current === viewId) return;
    const stored = loadNodesFromStorage(viewId);
    nodesViewIdRef.current = viewId;
    setNodes(stored?.length ? stored : initialNodes?.length ? initialNodes : [{ ...DEFAULT_ROOT_NODE }]);
    setSelectedNodeId(null); setEditingNodeId(null); setEditText('');
    setDraggingNodeId(null); setIsPanning(false); setZoom(1); setPan({ x: 0, y: 0 }); setHasUnsavedChanges(false);
  }, [viewId, initialNodes]);

  const getDescendants = useCallback((nodeId: string): string[] => {
    const children = nodesRef.current.filter(n => n.parentId === nodeId);
    return children.flatMap(c => [c.id, ...getDescendants(c.id)]);
  }, []);

  const addChildNode = useCallback((parentId: string) => {
    const parent = nodesRef.current.find(n => n.id === parentId);
    if (!parent) return;
    const siblings = nodesRef.current.filter(n => n.parentId === parentId);
    const depth = getNodeDepth(parentId, nodesRef.current);
    const xGap = depth === 0 ? 280 : 200;
    const ySpacing = depth === 0 ? 160 : 80;
    const totalHeight = (siblings.length) * ySpacing;
    const yOffset = totalHeight / 2;
    const palette = parentId === 'root'
      ? BRANCH_PALETTES[siblings.length % BRANCH_PALETTES.length]
      : getBranchPalette(parentId, nodesRef.current);
    const newNode: MindMapNode = {
      id: generateId(), text: 'Novo tópico',
      x: parent.x + xGap, y: parent.y + yOffset - totalHeight / 2 + ySpacing / 2,
      parentId, color: palette.bg,
    };
    // Rebalance siblings vertically
    const allSiblings = [...siblings, newNode];
    const centerY = parent.y;
    const total = allSiblings.length * ySpacing;
    const startY = centerY - total / 2 + ySpacing / 2;
    const updates = new Map<string, number>();
    allSiblings.forEach((s, i) => { updates.set(s.id, startY + i * ySpacing); });

    setNodes(prev => {
      const next = prev.map(n => updates.has(n.id) ? { ...n, y: updates.get(n.id)! } : n);
      return [...next, { ...newNode, y: updates.get(newNode.id) ?? newNode.y }];
    });
    setEditingNodeId(newNode.id); setEditText('Novo tópico'); setHasUnsavedChanges(true);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    const desc = getDescendants(nodeId);
    setNodes(prev => prev.filter(n => n.id !== nodeId && !desc.includes(n.id)));
    setSelectedNodeId(null); setHasUnsavedChanges(true);
  }, [getDescendants]);

  const startEditing = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) { setEditingNodeId(nodeId); setEditText(node.text); }
  }, []);

  const saveEdit = useCallback(() => {
    if (editingNodeId && editText.trim()) {
      setNodes(prev => prev.map(n => n.id === editingNodeId ? { ...n, text: editText.trim() } : n));
      setHasUnsavedChanges(true);
    }
    setEditingNodeId(null); setEditText('');
  }, [editingNodeId, editText]);

  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodesRef.current.find(n => n.id === nodeId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!node || !rect) return;
    setDraggingNodeId(nodeId);
    setDragOffset({ x: (e.clientX - rect.left - pan.x) / zoom - node.x, y: (e.clientY - rect.top - pan.y) / zoom - node.y });
  }, [zoom, pan]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setNodes(prev => prev.map(n => n.id === draggingNodeId ? {
        ...n, x: (e.clientX - rect.left - pan.x) / zoom - dragOffset.x,
        y: (e.clientY - rect.top - pan.y) / zoom - dragOffset.y
      } : n));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [draggingNodeId, dragOffset, zoom, pan, isPanning, panStart]);

  const handleDragEnd = useCallback(() => {
    if (draggingNodeId) setHasUnsavedChanges(true);
    setDraggingNodeId(null); setIsPanning(false);
  }, [draggingNodeId]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t === containerRef.current || t.tagName === 'svg' || t.classList.contains('mindmap-bg')) {
      setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); setSelectedNodeId(null);
    }
  }, [pan]);

  const handleZoom = useCallback((d: number) => setZoom(p => Math.min(2, Math.max(0.25, p + d))), []);
  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const handleManualSave = useCallback(() => {
    saveNodesToStorage(nodesViewIdRef.current, nodes);
    onSave?.(nodes); setHasUnsavedChanges(false);
    toast({ title: 'Mapa salvo!', description: onSave ? 'Salvo no servidor.' : 'Salvo localmente.' });
  }, [nodes, onSave, toast]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const h = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); handleZoom(e.deltaY > 0 ? -0.1 : 0.1); } };
    c.addEventListener('wheel', h, { passive: false });
    return () => c.removeEventListener('wheel', h);
  }, [handleZoom]);

  /** Render organic curved connections like MindMeister */
  const renderConnections = () => {
    return nodes.filter(n => n.parentId).map(node => {
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent) return null;
      const palette = getBranchPalette(node.id, nodes);
      const depth = getNodeDepth(node.id, nodes);
      const strokeW = depth === 1 ? 3.5 : 2.5;

      const sx = parent.x, sy = parent.y;
      const ex = node.x, ey = node.y;
      const dx = ex - sx;
      const dy = ey - sy;

      // MindMeister-style organic curves with wide horizontal control points
      const cpOffset = Math.abs(dx) * 0.55;
      const cp1x = sx + cpOffset;
      const cp1y = sy;
      const cp2x = ex - cpOffset;
      const cp2y = ey;

      return (
        <path
          key={`conn-${parent.id}-${node.id}`}
          d={`M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${ey}`}
          stroke={palette.line}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          opacity={0.65}
        />
      );
    });
  };

  /** Render connection dots at leaf nodes */
  const renderConnectionDots = () => {
    return nodes.filter(n => n.parentId).map(node => {
      const depth = getNodeDepth(node.id, nodes);
      if (depth < 2) return null;
      const palette = getBranchPalette(node.id, nodes);
      const hasChildren = nodes.some(n => n.parentId === node.id);
      return (
        <g key={`dot-${node.id}`}>
          {/* Dot at node position for leaf connections */}
          <circle
            cx={node.x - 80}
            cy={node.y}
            r={5}
            fill="white"
            stroke={palette.dot}
            strokeWidth={2}
          />
        </g>
      );
    });
  };

  const renderNode = (node: MindMapNode) => {
    const depth = getNodeDepth(node.id, nodes);
    const palette = getBranchPalette(node.id, nodes);
    const isSelected = selectedNodeId === node.id;
    const isRoot = node.id === 'root';
    const isBranch = depth === 1;
    const isLeaf = depth >= 2;
    const hasChildren = nodes.some(n => n.parentId === node.id);

    return (
      <div
        key={node.id}
        className={cn(
          "absolute pointer-events-auto select-none",
          draggingNodeId === node.id ? "cursor-grabbing" : "cursor-grab",
          isSelected && "z-10"
        )}
        style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
        onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); startEditing(node.id); }}
        onMouseDown={(e) => handleDragStart(e, node.id)}
      >
        {/* ===== ROOT NODE ===== */}
        {isRoot && (
          <div className="flex items-center gap-3">
            <div className={cn(
              "relative px-8 py-4 rounded-2xl transition-all",
              "bg-foreground text-background shadow-xl",
              isSelected && "ring-3 ring-primary ring-offset-2 ring-offset-background"
            )}>
              {editingNodeId === node.id ? (
                <Input
                  value={editText} onChange={(e) => setEditText(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingNodeId(null); setEditText(''); } }}
                  className="h-8 text-xl font-bold min-w-[200px] bg-transparent border-none p-0 focus-visible:ring-0 text-background"
                  autoFocus onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-xl font-bold tracking-tight whitespace-nowrap">{node.text}</span>
              )}
            </div>
            {/* Add child button */}
            <button
              onClick={(e) => { e.stopPropagation(); addChildNode(node.id); }}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-transform"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* ===== BRANCH NODE (depth 1) — colored rounded square with label below ===== */}
        {isBranch && (
          <div className="flex flex-col items-center gap-2 group/branch">
            <div className="relative">
              {/* Colored square */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-[20px] shadow-lg transition-all",
                  "w-[100px] h-[100px]",
                  isSelected && "ring-3 ring-offset-2 ring-offset-background"
                )}
                style={{
                  backgroundColor: palette.bg,
                  ...(isSelected ? { boxShadow: `0 0 0 3px ${palette.bg}40` } : {}),
                }}
              >
                {/* Icon placeholder — first letter large */}
                <span className="text-white text-3xl font-bold opacity-90 select-none">
                  {node.text.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Add child button - appears on hover, positioned to the right */}
              <button
                onClick={(e) => { e.stopPropagation(); addChildNode(node.id); }}
                className={cn(
                  "absolute -right-3 top-1/2 -translate-y-1/2 flex items-center justify-center",
                  "w-6 h-6 rounded-full shadow-md transition-all",
                  "opacity-0 group-hover/branch:opacity-100 hover:scale-110",
                )}
                style={{ backgroundColor: palette.bg, color: '#fff' }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Label below the square */}
            {editingNodeId === node.id ? (
              <Input
                value={editText} onChange={(e) => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingNodeId(null); setEditText(''); } }}
                className="h-6 text-sm font-semibold min-w-[80px] max-w-[140px] bg-card border rounded-md px-2 text-center focus-visible:ring-1"
                autoFocus onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-sm font-semibold text-foreground max-w-[140px] text-center leading-tight"
                style={{ color: palette.bg }}
              >
                {node.text}
              </span>
            )}
          </div>
        )}

        {/* ===== LEAF NODE (depth 2+) — text with colored dot ===== */}
        {isLeaf && (
          <div className="flex items-center gap-2.5 group/leaf">
            {/* Connection dot */}
            <div
              className="w-3 h-3 rounded-full border-2 flex-shrink-0"
              style={{ borderColor: palette.dot, backgroundColor: 'white' }}
            />
            {editingNodeId === node.id ? (
              <Input
                value={editText} onChange={(e) => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingNodeId(null); setEditText(''); } }}
                className="h-6 text-sm min-w-[120px] bg-card border rounded-md px-2 focus-visible:ring-1"
                autoFocus onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={cn(
                "text-sm whitespace-nowrap transition-colors",
                isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/75"
              )}>
                {node.text}
              </span>
            )}
            {/* Add child mini button */}
            <button
              onClick={(e) => { e.stopPropagation(); addChildNode(node.id); }}
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full transition-all",
                "opacity-0 group-hover/leaf:opacity-100 hover:scale-110",
              )}
              style={{ backgroundColor: palette.dot, color: '#fff' }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* ===== Bottom-left zoom toolbar (MindMeister style pill) ===== */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center bg-card border rounded-full shadow-md px-1 py-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleZoom(-0.1)}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center font-medium select-none">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleZoom(0.1)}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ===== Right-side floating actions (MindMeister style) ===== */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 bg-card border rounded-2xl shadow-md p-1.5">
        <Button
          variant="ghost" size="icon" className="h-9 w-9 rounded-xl"
          onClick={handleManualSave} title="Salvar"
        >
          <Save className={cn("h-4 w-4", hasUnsavedChanges && "text-primary")} />
        </Button>
        <div className="h-px bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={resetView} title="Centralizar">
          <Maximize2 className="h-4 w-4" />
        </Button>
        {selectedNodeId && selectedNodeId !== 'root' && (
          <>
            <div className="h-px bg-border mx-1" />
            <Button
              variant="ghost" size="icon"
              className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => deleteNode(selectedNodeId)} title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* ===== Canvas ===== */}
      <div
        ref={containerRef}
        className="mindmap-bg w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handlePanStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.3) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* SVG connections */}
        <svg
          className="mindmap-bg absolute inset-0 pointer-events-none overflow-visible"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {renderConnections()}
        </svg>

        {/* Nodes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {nodes.map(renderNode)}
        </div>
      </div>

      {/* ===== Help button — bottom right ===== */}
      <div className="absolute bottom-5 right-5 z-20">
        <div className="group/help relative">
          <button className="w-9 h-9 rounded-full bg-card border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-sm font-semibold">?</span>
          </button>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/help:block bg-card border rounded-xl shadow-xl p-4 text-xs text-muted-foreground w-60 space-y-1.5">
            <p><strong className="text-foreground">Clique</strong> para selecionar</p>
            <p><strong className="text-foreground">Duplo clique</strong> para editar</p>
            <p><strong className="text-foreground">Arraste</strong> para mover nó</p>
            <p><strong className="text-foreground">+</strong> para adicionar filho</p>
            <p><strong className="text-foreground">Ctrl + Scroll</strong> para zoom</p>
          </div>
        </div>
      </div>
    </div>
  );
};
