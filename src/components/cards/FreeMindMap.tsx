import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, GripVertical, Trash2, ZoomIn, ZoomOut, Maximize2, Save } from 'lucide-react';
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

const NODE_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ef4444', // red
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#ec4899', // pink
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_ROOT_NODE: MindMapNode = {
  id: 'root',
  text: 'Comece aqui 👋',
  x: 300,
  y: 250,
  parentId: null,
  color: '#3b82f6',
};

// Storage key prefix
const STORAGE_KEY_PREFIX = 'mindmap-nodes-';

// Load nodes from localStorage
const loadNodesFromStorage = (viewId: string): MindMapNode[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + viewId);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading mindmap from storage:', e);
  }
  return null;
};

// Save nodes to localStorage
const saveNodesToStorage = (viewId: string, nodes: MindMapNode[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + viewId, JSON.stringify(nodes));
  } catch (e) {
    console.error('Error saving mindmap to storage:', e);
  }
};

export const FreeMindMap: React.FC<FreeMindMapProps> = ({ viewId = 'default', onSave, initialNodes }) => {
  const { toast } = useToast();
  
  // Initialize nodes from storage or props
  const [nodes, setNodes] = useState<MindMapNode[]>(() => {
    if (initialNodes && initialNodes.length > 0) {
      return initialNodes;
    }
    const stored = loadNodesFromStorage(viewId);
    if (stored) {
      return stored;
    }
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

  // Tracks which viewId the current `nodes` state belongs to (prevents overwriting storage when viewId changes)
  const nodesViewIdRef = useRef(viewId);
  
  // Use ref to prevent stale closures
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Auto-save to localStorage when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      saveNodesToStorage(nodesViewIdRef.current, nodes);
      setHasUnsavedChanges(true);
    }
  }, [nodes]);

  // When viewId changes, load nodes for that view instead of overwriting its storage key
  useEffect(() => {
    if (nodesViewIdRef.current === viewId) return;

    const stored = loadNodesFromStorage(viewId);
    const nextNodes: MindMapNode[] =
      stored && stored.length > 0
        ? stored
        : initialNodes && initialNodes.length > 0
          ? initialNodes
          : [{ ...DEFAULT_ROOT_NODE }];

    // Switch the active storage key only when we've loaded the corresponding document
    nodesViewIdRef.current = viewId;
    setNodes(nextNodes);

    // Reset per-document UI state
    setSelectedNodeId(null);
    setEditingNodeId(null);
    setEditText('');
    setDraggingNodeId(null);
    setIsPanning(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHasUnsavedChanges(false);
  }, [viewId, initialNodes]);

  // Get all descendants of a node
  const getDescendants = useCallback((nodeId: string): string[] => {
    const currentNodes = nodesRef.current;
    const children = currentNodes.filter(n => n.parentId === nodeId);
    return children.flatMap(child => [child.id, ...getDescendants(child.id)]);
  }, []);

  // Add child node
  const addChildNode = useCallback((parentId: string) => {
    const currentNodes = nodesRef.current;
    const parent = currentNodes.find(n => n.id === parentId);
    if (!parent) return;

    const siblings = currentNodes.filter(n => n.parentId === parentId);
    const yOffset = siblings.length * 70 - (siblings.length * 70) / 2;
    
    const newNode: MindMapNode = {
      id: generateId(),
      text: 'Novo nó',
      x: parent.x + 220,
      y: parent.y + yOffset,
      parentId,
      color: NODE_COLORS[currentNodes.length % NODE_COLORS.length],
    };

    setNodes(prev => [...prev, newNode]);
    setEditingNodeId(newNode.id);
    setEditText('Novo nó');
    setHasUnsavedChanges(true);
  }, []);

  // Delete node and all descendants
  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    const descendants = getDescendants(nodeId);
    setNodes(prev => prev.filter(n => n.id !== nodeId && !descendants.includes(n.id)));
    setSelectedNodeId(null);
    setHasUnsavedChanges(true);
  }, [getDescendants]);

  // Start editing node
  const startEditing = useCallback((nodeId: string) => {
    const currentNodes = nodesRef.current;
    const node = currentNodes.find(n => n.id === nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(node.text);
    }
  }, []);

  // Save edit
  const saveEdit = useCallback(() => {
    if (editingNodeId && editText.trim()) {
      setNodes(prev => prev.map(n => 
        n.id === editingNodeId ? { ...n, text: editText.trim() } : n
      ));
      setHasUnsavedChanges(true);
    }
    setEditingNodeId(null);
    setEditText('');
  }, [editingNodeId, editText]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const currentNodes = nodesRef.current;
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y,
    });
  }, [zoom, pan]);

  // Handle drag move
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      setNodes(prev => prev.map(n => 
        n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n
      ));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [draggingNodeId, dragOffset, zoom, pan, isPanning, panStart]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (draggingNodeId) {
      setHasUnsavedChanges(true);
    }
    setDraggingNodeId(null);
    setIsPanning(false);
  }, [draggingNodeId]);

  // Handle pan start (only on background)
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === containerRef.current || target.tagName === 'svg') {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
      setSelectedNodeId(null);
    }
  }, [pan]);

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.min(2, Math.max(0.25, prev + delta)));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Manual save (to database via onSave callback)
  const handleManualSave = useCallback(() => {
    saveNodesToStorage(nodesViewIdRef.current, nodes);
    onSave?.(nodes);
    setHasUnsavedChanges(false);
    toast({
      title: 'Mapa salvo!',
      description: onSave ? 'Seu mapa mental foi salvo no servidor.' : 'Salvo localmente.',
    });
  }, [nodes, onSave, toast]);

  // Handle wheel zoom
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

  // Render bezier connections between nodes
  const renderConnections = () => {
    return nodes
      .filter(node => node.parentId)
      .map(node => {
        const parent = nodes.find(n => n.id === node.parentId);
        if (!parent) return null;

        const startX = parent.x;
        const startY = parent.y;
        const endX = node.x;
        const endY = node.y;

        const controlOffset = Math.abs(endX - startX) * 0.5;

        return (
          <path
            key={`${parent.id}-${node.id}`}
            d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
            stroke={node.color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        );
      });
  };

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-card border rounded-lg shadow-sm p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleZoom(0.1)}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleZoom(-0.1)}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="sm"
          onClick={resetView}
          title="Resetar visualização"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualSave}
          title="Salvar mapa"
          className={cn(hasUnsavedChanges && "text-primary")}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Node count indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-card/80 backdrop-blur-sm border rounded-lg px-3 py-1 text-xs text-muted-foreground">
        {nodes.length} {nodes.length === 1 ? 'nó' : 'nós'}
      </div>

      {/* Selected node actions */}
      {selectedNodeId && selectedNodeId !== 'root' && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-card border rounded-lg shadow-sm p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteNode(selectedNodeId)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handlePanStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* SVG layer for connections */}
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {renderConnections()}
        </svg>

        {/* Nodes layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {nodes.map(node => (
            <div
              key={node.id}
              className={cn(
                "absolute flex items-center gap-1 cursor-move select-none pointer-events-auto",
                "transition-shadow duration-200",
                selectedNodeId === node.id && "z-10"
              )}
              style={{
                left: node.x,
                top: node.y,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditing(node.id);
              }}
              onMouseDown={(e) => handleDragStart(e, node.id)}
            >
              {/* Node content */}
              <div
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full bg-card border-2 shadow-sm",
                  "hover:shadow-md transition-all whitespace-nowrap",
                  selectedNodeId === node.id && "ring-2 ring-primary ring-offset-2",
                  node.parentId === null && "bg-primary text-primary-foreground border-primary"
                )}
                style={{
                  borderColor: node.parentId ? node.color : undefined,
                }}
              >
                <GripVertical className="h-3 w-3 opacity-40 flex-shrink-0" />
                
                {editingNodeId === node.id ? (
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') {
                        setEditingNodeId(null);
                        setEditText('');
                      }
                    }}
                    className="h-6 text-sm min-w-[100px] bg-transparent border-none p-0 focus-visible:ring-0"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-sm font-medium">{node.text}</span>
                )}
              </div>

              {/* Add child button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addChildNode(node.id);
                }}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full ml-1",
                  "bg-foreground text-background shadow-sm hover:scale-110 transition-transform",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-20 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm border rounded-lg p-3 space-y-1">
        <p><strong>Clique</strong> para selecionar • <strong>Duplo clique</strong> para editar</p>
        <p><strong>Arraste</strong> o nó para mover • <strong>+</strong> para adicionar filho</p>
        <p><strong>Ctrl + Scroll</strong> para zoom • Salva automaticamente</p>
      </div>
    </div>
  );
};
