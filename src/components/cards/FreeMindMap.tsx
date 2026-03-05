import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  MindMapNode,
  BRANCH_PALETTES,
  generateId,
  DEFAULT_ROOT_NODE,
} from './mindmap/types';
import {
  getBranchPalette,
  getNodeDepth,
  getDescendants,
  getVisibleNodes,
  autoLayout,
  loadNodesFromStorage,
  saveNodesToStorage,
} from './mindmap/utils';
import { MindMapConnections } from './mindmap/MindMapConnections';
import { MindMapNodeComponent } from './mindmap/MindMapNode';
import { MindMapToolbar } from './mindmap/MindMapToolbar';
import { NodeFormatToolbar } from './mindmap/NodeFormatToolbar';

// Re-export type for backward compatibility
export type { MindMapNode } from './mindmap/types';

interface FreeMindMapProps {
  viewId?: string;
  onSave?: (nodes: MindMapNode[]) => void;
  initialNodes?: MindMapNode[];
}

export const FreeMindMap: React.FC<FreeMindMapProps> = ({ viewId = 'default', onSave, initialNodes }) => {
  const { toast } = useToast();

  const [nodes, setNodes] = useState<MindMapNode[]>(() => {
    if (initialNodes?.length) return initialNodes;
    const stored = loadNodesFromStorage(viewId);
    if (stored) return stored;
    // Auto-layout the default
    return autoLayout([{ ...DEFAULT_ROOT_NODE }]);
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragDescendantOffsets, setDragDescendantOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewIdRef = useRef(viewId);
  const nodesRef = useRef(nodes);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Auto-save to localStorage
  useEffect(() => {
    if (nodes.length > 0) {
      saveNodesToStorage(viewIdRef.current, nodes);
      setHasUnsavedChanges(true);
    }
  }, [nodes]);

  // Center canvas on mount
  useEffect(() => {
    const c = containerRef.current;
    if (c) {
      const rect = c.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, []);

  // Handle viewId changes
  useEffect(() => {
    if (viewIdRef.current === viewId) return;
    const stored = loadNodesFromStorage(viewId);
    viewIdRef.current = viewId;
    const newNodes = stored?.length ? stored : initialNodes?.length ? initialNodes : autoLayout([{ ...DEFAULT_ROOT_NODE }]);
    setNodes(newNodes);
    setSelectedNodeId(null);
    setEditingNodeId(null);
    setZoom(1);
    setHasUnsavedChanges(false);
    // Re-center
    const c = containerRef.current;
    if (c) {
      const rect = c.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, [viewId, initialNodes]);

  // ===== NODE OPERATIONS =====

  /** Check if a node (or its branch) is on the left side of root */
  const isOnLeftSide = useCallback((nodeId: string, allNodes: MindMapNode[]): boolean => {
    const root = allNodes.find(n => n.id === 'root');
    if (!root) return false;
    
    // If this node IS root, not left
    if (nodeId === 'root') return false;
    
    // Walk up to find the direct child of root (branch ancestor)
    let current = allNodes.find(n => n.id === nodeId);
    if (!current) return false;
    
    while (current && current.parentId && current.parentId !== 'root') {
      current = allNodes.find(n => n.id === current!.parentId);
    }
    
    // current is now the direct child of root — check its x vs root's x
    if (current) return current.x < root.x;
    
    // Fallback: check the node itself
    const node = allNodes.find(n => n.id === nodeId);
    return node ? node.x < root.x : false;
  }, []);

  const addChildNode = useCallback((parentId: string) => {
    const parent = nodesRef.current.find(n => n.id === parentId);
    if (!parent) return;

    // Uncollapse parent if collapsed
    if (parent.collapsed) {
      setNodes(prev => prev.map(n => n.id === parentId ? { ...n, collapsed: false } : n));
    }

    const siblings = nodesRef.current.filter(n => n.parentId === parentId);
    const depth = getNodeDepth(parentId, nodesRef.current);
    const xGap = depth === 0 ? 320 : depth === 1 ? 260 : 200;
    const ySpacing = depth === 0 ? 180 : depth === 1 ? 100 : 60;

    const palette = parentId === 'root'
      ? BRANCH_PALETTES[siblings.length % BRANCH_PALETTES.length]
      : getBranchPalette(parentId, nodesRef.current);

    // Place new node below the last sibling, or at parent.y if no siblings
    let newY = parent.y;
    if (siblings.length > 0) {
      const maxY = Math.max(...siblings.map(s => s.y));
      newY = maxY + ySpacing;
    }

    // Determine direction: if parent is on the left side of root, children go further left
    const leftSide = isOnLeftSide(parentId, nodesRef.current);
    const newX = leftSide ? parent.x - xGap : parent.x + xGap;

    const newNode: MindMapNode = {
      id: generateId(),
      text: 'Novo tópico',
      x: newX,
      y: newY,
      parentId,
      color: palette.bg,
    };

    setNodes(prev => [...prev, newNode]);

    setEditingNodeId(newNode.id);
    setEditText('Novo tópico');
    setHasUnsavedChanges(true);
  }, [isOnLeftSide]);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    const desc = getDescendants(nodeId, nodesRef.current);
    setNodes(prev => prev.filter(n => n.id !== nodeId && !desc.includes(n.id)));
    setSelectedNodeId(null);
    setHasUnsavedChanges(true);
  }, []);

  const toggleCollapse = useCallback((nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n));
    setHasUnsavedChanges(true);
  }, []);

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

  const cancelEdit = useCallback(() => {
    setEditingNodeId(null);
    setEditText('');
  }, []);

  // ===== DRAG =====

  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodesRef.current.find(n => n.id === nodeId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!node || !rect) return;
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - node.x,
      y: (e.clientY - rect.top - pan.y) / zoom - node.y,
    });

    // Store relative offsets of all descendants so they move together
    const descIds = getDescendants(nodeId, nodesRef.current);
    const offsets = new Map<string, { dx: number; dy: number }>();
    descIds.forEach(id => {
      const desc = nodesRef.current.find(n => n.id === id);
      if (desc) {
        offsets.set(id, { dx: desc.x - node.x, dy: desc.y - node.y });
      }
    });
    setDragDescendantOffsets(offsets);
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      setNodes(prev => prev.map(n => {
        if (n.id === draggingNodeId) return { ...n, x: newX, y: newY };
        const offset = dragDescendantOffsets.get(n.id);
        if (offset) return { ...n, x: newX + offset.dx, y: newY + offset.dy };
        return n;
      }));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [draggingNodeId, dragOffset, dragDescendantOffsets, zoom, pan, isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    if (draggingNodeId) setHasUnsavedChanges(true);
    setDraggingNodeId(null);
    setIsPanning(false);
  }, [draggingNodeId]);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    // Don't pan if clicking on interactive elements (buttons, inputs, nodes)
    if (t.closest('button') || t.closest('input') || t.closest('[data-mindmap-node]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setSelectedNodeId(null);
  }, [pan]);

  // ===== ZOOM =====

  const handleZoom = useCallback((d: number) => setZoom(p => Math.min(4, Math.max(0.2, p + d))), []);
  
  const fitToContent = useCallback(() => {
    const c = containerRef.current;
    if (!c || nodes.length === 0) return;
    const rect = c.getBoundingClientRect();
    
    // Find bounds of all nodes
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 150;
    const maxX = Math.max(...xs) + 250;
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 80;
    
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.85, 0.2), 2);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    setZoom(newZoom);
    setPan({
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    });
  }, [nodes]);
  
  const resetView = useCallback(() => {
    fitToContent();
  }, [fitToContent]);

  // Ctrl+Scroll zoom
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const h = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
      }
    };
    c.addEventListener('wheel', h, { passive: false });
    return () => c.removeEventListener('wheel', h);
  }, [handleZoom]);

  // ===== KEYBOARD SHORTCUTS =====

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (editingNodeId) return; // Don't capture when editing

      if (e.key === 'Tab' && selectedNodeId) {
        e.preventDefault();
        addChildNode(selectedNodeId);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && selectedNodeId !== 'root') {
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
      if (e.key === 'Enter' && selectedNodeId) {
        e.preventDefault();
        startEditing(selectedNodeId);
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedNodeId, editingNodeId, addChildNode, deleteNode, startEditing]);

  // ===== SAVE =====

  const handleManualSave = useCallback(() => {
    saveNodesToStorage(viewIdRef.current, nodes);
    onSave?.(nodes);
    setHasUnsavedChanges(false);
    toast({ title: 'Mapa salvo!', description: onSave ? 'Salvo no servidor.' : 'Salvo localmente.' });
  }, [nodes, onSave, toast]);

  const handleAutoLayout = useCallback(() => {
    setNodes(prev => autoLayout(prev));
    setHasUnsavedChanges(true);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
    setHasUnsavedChanges(true);
  }, []);

  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || !node.parentId) return;
    const newNode: MindMapNode = {
      ...node,
      id: generateId(),
      text: node.text + ' (cópia)',
      y: node.y + 60,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setHasUnsavedChanges(true);
  }, []);

  const addAttachmentNode = useCallback((parentId: string, fileName: string, fileUrl: string, icon: string) => {
    const parent = nodesRef.current.find(n => n.id === parentId);
    if (!parent) return;

    if (parent.collapsed) {
      setNodes(prev => prev.map(n => n.id === parentId ? { ...n, collapsed: false } : n));
    }

    const siblings = nodesRef.current.filter(n => n.parentId === parentId);
    const depth = getNodeDepth(parentId, nodesRef.current);
    const xGap = depth === 0 ? 320 : depth === 1 ? 260 : 200;
    const ySpacing = depth === 0 ? 180 : depth === 1 ? 100 : 60;

    const palette = parentId === 'root'
      ? BRANCH_PALETTES[siblings.length % BRANCH_PALETTES.length]
      : getBranchPalette(parentId, nodesRef.current);

    let newY = parent.y;
    if (siblings.length > 0) {
      const maxY = Math.max(...siblings.map(s => s.y));
      newY = maxY + ySpacing;
    }

    const leftSide = isOnLeftSide(parentId, nodesRef.current);
    const newX = leftSide ? parent.x - xGap : parent.x + xGap;

    const newNode: MindMapNode = {
      id: generateId(),
      text: fileName,
      x: newX,
      y: newY,
      parentId,
      color: palette.bg,
      icon,
      link: fileUrl,
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setHasUnsavedChanges(true);
  }, []);

  // ===== RENDER =====

  const visibleNodes = getVisibleNodes(nodes);
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Toolbar */}
      <MindMapToolbar
        zoom={zoom}
        hasUnsavedChanges={hasUnsavedChanges}
        selectedNodeId={selectedNodeId}
        onZoomIn={() => handleZoom(0.1)}
        onZoomOut={() => handleZoom(-0.1)}
        onResetView={resetView}
        onSave={handleManualSave}
        onDelete={() => selectedNodeId && deleteNode(selectedNodeId)}
        onAutoLayout={handleAutoLayout}
      />

      {/* Node Format Toolbar */}
      {selectedNode && !editingNodeId && (
        <NodeFormatToolbar
          node={selectedNode}
          onUpdateNode={(updates) => handleUpdateNode(selectedNode.id, updates)}
          onDeselect={() => setSelectedNodeId(null)}
          onDuplicate={() => duplicateNode(selectedNode.id)}
          onDelete={() => deleteNode(selectedNode.id)}
          onAddAttachmentNode={(fileName, fileUrl, icon) => addAttachmentNode(selectedNode.id, fileName, fileUrl, icon)}
        />
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="mindmap-canvas w-full h-full cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handlePanStart}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.15) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* SVG connections */}
        <svg
          className="mindmap-canvas absolute inset-0 pointer-events-none overflow-visible"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <MindMapConnections nodes={visibleNodes} />
        </svg>

        {/* Nodes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {visibleNodes.map(node => (
            <MindMapNodeComponent
              key={node.id}
              node={node}
              allNodes={nodes}
              isSelected={selectedNodeId === node.id}
              isDragging={draggingNodeId === node.id}
              editingNodeId={editingNodeId}
              editText={editText}
              onSelect={setSelectedNodeId}
              onDoubleClick={startEditing}
              onDragStart={handleDragStart}
              onAddChild={addChildNode}
              onToggleCollapse={toggleCollapse}
              onEditChange={setEditText}
              onEditSave={saveEdit}
              onEditCancel={cancelEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
