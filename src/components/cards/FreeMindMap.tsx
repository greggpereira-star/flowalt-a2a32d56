import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ZoomIn, ZoomOut, Maximize2, Save, Undo2, Redo2 } from 'lucide-react';
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

const BRANCH_COLORS = [
  { bg: '#f59e0b', fg: '#ffffff' }, // amber
  { bg: '#8b5cf6', fg: '#ffffff' }, // purple
  { bg: '#06b6d4', fg: '#ffffff' }, // cyan
  { bg: '#ec4899', fg: '#ffffff' }, // pink
  { bg: '#3b82f6', fg: '#ffffff' }, // blue
  { bg: '#22c55e', fg: '#ffffff' }, // green
  { bg: '#ef4444', fg: '#ffffff' }, // red
  { bg: '#f97316', fg: '#ffffff' }, // orange
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
  } catch (e) {
    console.error('Error loading mindmap from storage:', e);
  }
  return null;
};

const saveNodesToStorage = (viewId: string, nodes: MindMapNode[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + viewId, JSON.stringify(nodes));
  } catch (e) {
    console.error('Error saving mindmap to storage:', e);
  }
};

/** Get the branch color for a node by tracing up to the root's direct child */
const getBranchColor = (nodeId: string, nodes: MindMapNode[]): { bg: string; fg: string } => {
  let current = nodes.find(n => n.id === nodeId);
  if (!current) return BRANCH_COLORS[0];
  
  // Walk up to find the direct child of root
  while (current && current.parentId && current.parentId !== 'root') {
    current = nodes.find(n => n.id === current!.parentId);
  }
  
  if (!current) return BRANCH_COLORS[0];
  
  // Find index among root's children
  const rootChildren = nodes.filter(n => n.parentId === 'root');
  const idx = rootChildren.findIndex(n => n.id === current!.id);
  return BRANCH_COLORS[(idx >= 0 ? idx : 0) % BRANCH_COLORS.length];
};

/** Determine node depth */
const getNodeDepth = (nodeId: string, nodes: MindMapNode[]): number => {
  let depth = 0;
  let current = nodes.find(n => n.id === nodeId);
  while (current?.parentId) {
    depth++;
    current = nodes.find(n => n.id === current!.parentId);
  }
  return depth;
};

export const FreeMindMap: React.FC<FreeMindMapProps> = ({ viewId = 'default', onSave, initialNodes }) => {
  const { toast } = useToast();
  
  const [nodes, setNodes] = useState<MindMapNode[]>(() => {
    if (initialNodes && initialNodes.length > 0) return initialNodes;
    const stored = loadNodesFromStorage(viewId);
    if (stored) return stored;
    return [{ ...DEFAULT_ROOT_NODE }];
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
    if (nodes.length > 0) {
      saveNodesToStorage(nodesViewIdRef.current, nodes);
      setHasUnsavedChanges(true);
    }
  }, [nodes]);

  useEffect(() => {
    if (nodesViewIdRef.current === viewId) return;
    const stored = loadNodesFromStorage(viewId);
    const nextNodes = stored?.length ? stored : initialNodes?.length ? initialNodes : [{ ...DEFAULT_ROOT_NODE }];
    nodesViewIdRef.current = viewId;
    setNodes(nextNodes);
    setSelectedNodeId(null);
    setEditingNodeId(null);
    setEditText('');
    setDraggingNodeId(null);
    setIsPanning(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHasUnsavedChanges(false);
  }, [viewId, initialNodes]);

  const getDescendants = useCallback((nodeId: string): string[] => {
    const currentNodes = nodesRef.current;
    const children = currentNodes.filter(n => n.parentId === nodeId);
    return children.flatMap(child => [child.id, ...getDescendants(child.id)]);
  }, []);

  const addChildNode = useCallback((parentId: string) => {
    const currentNodes = nodesRef.current;
    const parent = currentNodes.find(n => n.id === parentId);
    if (!parent) return;

    const siblings = currentNodes.filter(n => n.parentId === parentId);
    const depth = getNodeDepth(parentId, currentNodes);
    const spacing = depth === 0 ? 180 : 150;
    const yOffset = siblings.length * 70 - (siblings.length * 70) / 2;
    
    const branchColor = parentId === 'root' 
      ? BRANCH_COLORS[siblings.length % BRANCH_COLORS.length]
      : getBranchColor(parentId, currentNodes);

    const newNode: MindMapNode = {
      id: generateId(),
      text: 'Novo tópico',
      x: parent.x + spacing + 80,
      y: parent.y + yOffset,
      parentId,
      color: branchColor.bg,
    };

    setNodes(prev => [...prev, newNode]);
    setEditingNodeId(newNode.id);
    setEditText('Novo tópico');
    setHasUnsavedChanges(true);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    const descendants = getDescendants(nodeId);
    setNodes(prev => prev.filter(n => n.id !== nodeId && !descendants.includes(n.id)));
    setSelectedNodeId(null);
    setHasUnsavedChanges(true);
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
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText]);

  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y,
    });
  }, [zoom, pan]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [draggingNodeId, dragOffset, zoom, pan, isPanning, panStart]);

  const handleDragEnd = useCallback(() => {
    if (draggingNodeId) setHasUnsavedChanges(true);
    setDraggingNodeId(null);
    setIsPanning(false);
  }, [draggingNodeId]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNodeId(null);
    }
  }, [pan]);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.min(2, Math.max(0.25, prev + delta)));
  }, []);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const handleManualSave = useCallback(() => {
    saveNodesToStorage(nodesViewIdRef.current, nodes);
    onSave?.(nodes);
    setHasUnsavedChanges(false);
    toast({
      title: 'Mapa salvo!',
      description: onSave ? 'Seu mapa mental foi salvo no servidor.' : 'Salvo localmente.',
    });
  }, [nodes, onSave, toast]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleZoom]);

  // Render curved connections
  const renderConnections = () => {
    return nodes.filter(n => n.parentId).map(node => {
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent) return null;

      const depth = getNodeDepth(node.id, nodes);
      const branchColor = getBranchColor(node.id, nodes);
      const strokeWidth = depth === 1 ? 3 : 2;

      const sx = parent.x, sy = parent.y;
      const ex = node.x, ey = node.y;
      const cpx = (sx + ex) / 2;

      return (
        <path
          key={`${parent.id}-${node.id}`}
          d={`M ${sx} ${sy} C ${cpx} ${sy}, ${cpx} ${ey}, ${ex} ${ey}`}
          stroke={branchColor.bg}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      );
    });
  };

  // Render a node based on its depth
  const renderNode = (node: MindMapNode) => {
    const depth = getNodeDepth(node.id, nodes);
    const branchColor = getBranchColor(node.id, nodes);
    const isSelected = selectedNodeId === node.id;
    const isRoot = node.id === 'root';
    const isBranch = depth === 1;
    const isLeaf = depth >= 2;

    return (
      <div
        key={node.id}
        className={cn(
          "absolute flex items-center gap-1.5 cursor-move select-none pointer-events-auto",
          "transition-shadow duration-200",
          isSelected && "z-10"
        )}
        style={{
          left: node.x,
          top: node.y,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); startEditing(node.id); }}
        onMouseDown={(e) => handleDragStart(e, node.id)}
      >
        {/* Root node */}
        {isRoot && (
          <div className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg transition-all",
            "bg-foreground text-background",
            isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}>
            {editingNodeId === node.id ? (
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') { setEditingNodeId(null); setEditText(''); }
                }}
                className="h-7 text-base font-bold min-w-[150px] bg-transparent border-none p-0 focus-visible:ring-0 text-background placeholder:text-background/50"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-base font-bold tracking-tight">{node.text}</span>
            )}
          </div>
        )}

        {/* Branch node (direct child of root) — colored rounded square */}
        {isBranch && (
          <div className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                "flex items-center justify-center w-[72px] h-[72px] rounded-2xl shadow-md transition-all",
                isSelected && "ring-2 ring-offset-2 ring-offset-background"
              )}
              style={{
                backgroundColor: branchColor.bg,
                color: branchColor.fg,
                ...(isSelected ? { ringColor: branchColor.bg } : {}),
              }}
            >
              {editingNodeId === node.id ? (
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') { setEditingNodeId(null); setEditText(''); }
                  }}
                  className="h-6 text-xs font-semibold min-w-[50px] max-w-[60px] bg-transparent border-none p-0 focus-visible:ring-0 text-center"
                  style={{ color: branchColor.fg }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-xs font-bold text-center leading-tight px-1 max-w-[64px] truncate">
                  {node.text}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Leaf node — simple text with colored dot */}
        {isLeaf && (
          <div className={cn(
            "flex items-center gap-2 transition-all",
            isSelected && "scale-105"
          )}>
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: branchColor.bg }}
            />
            {editingNodeId === node.id ? (
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') { setEditingNodeId(null); setEditText(''); }
                }}
                className="h-6 text-sm min-w-[100px] bg-transparent border-none p-0 focus-visible:ring-0"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={cn(
                "text-sm font-medium whitespace-nowrap",
                isSelected ? "text-foreground" : "text-foreground/80"
              )}>
                {node.text}
              </span>
            )}
          </div>
        )}

        {/* Add child button */}
        <button
          onClick={(e) => { e.stopPropagation(); addChildNode(node.id); }}
          className={cn(
            "flex items-center justify-center rounded-full transition-all",
            "opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-110",
            isRoot ? "w-7 h-7 ml-2" : isBranch ? "w-5 h-5 mt-1" : "w-5 h-5 ml-1",
          )}
          style={{
            backgroundColor: isRoot ? 'hsl(var(--primary))' : branchColor.bg,
            color: isRoot ? 'hsl(var(--primary-foreground))' : branchColor.fg,
            opacity: isSelected ? 1 : undefined,
          }}
        >
          <Plus className={cn(isRoot ? "h-4 w-4" : "h-3 w-3")} />
        </button>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-background overflow-hidden group">
      {/* Bottom-left toolbar — MindMeister style */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-0.5 bg-card border rounded-full shadow-sm px-1 py-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleZoom(-0.1)}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[36px] text-center font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleZoom(0.1)}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Right-side floating actions */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-card border rounded-xl shadow-sm p-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={handleManualSave}
          title="Salvar mapa"
        >
          <Save className={cn("h-4 w-4", hasUnsavedChanges && "text-primary")} />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={resetView} title="Resetar view">
          <Maximize2 className="h-4 w-4" />
        </Button>
        {selectedNodeId && selectedNodeId !== 'root' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
            onClick={() => deleteNode(selectedNodeId)}
            title="Excluir nó"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handlePanStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.4) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* SVG connections */}
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {renderConnections()}
        </svg>

        {/* Nodes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {nodes.map(renderNode)}
        </div>
      </div>

      {/* Help tooltip — bottom right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="group/help relative">
          <button className="w-8 h-8 rounded-full bg-card border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-sm font-medium">?</span>
          </button>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/help:block bg-card border rounded-lg shadow-lg p-3 text-xs text-muted-foreground w-56 space-y-1">
            <p><strong>Clique</strong> para selecionar</p>
            <p><strong>Duplo clique</strong> para editar</p>
            <p><strong>Arraste</strong> para mover</p>
            <p><strong>+</strong> para adicionar filho</p>
            <p><strong>Ctrl + Scroll</strong> para zoom</p>
          </div>
        </div>
      </div>
    </div>
  );
};
