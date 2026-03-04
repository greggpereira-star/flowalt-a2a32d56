import React, { useRef, useEffect } from 'react';
import { Plus, ChevronRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MindMapNode as NodeType } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

interface Props {
  node: NodeType;
  allNodes: NodeType[];
  isSelected: boolean;
  isDragging: boolean;
  editingNodeId: string | null;
  editText: string;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  onAddChild: (parentId: string) => void;
  onToggleCollapse: (id: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const MindMapNodeComponent: React.FC<Props> = ({
  node,
  allNodes,
  isSelected,
  isDragging,
  editingNodeId,
  editText,
  onSelect,
  onDoubleClick,
  onDragStart,
  onAddChild,
  onToggleCollapse,
  onEditChange,
  onEditSave,
  onEditCancel,
}) => {
  const depth = getNodeDepth(node.id, allNodes);
  const palette = getBranchPalette(node.id, allNodes);
  const isRoot = node.id === 'root';
  const isBranch = depth === 1;
  const isLeaf = depth >= 2;
  const isEditing = editingNodeId === node.id;
  const hasChildren = allNodes.some(n => n.parentId === node.id);
  const childCount = allNodes.filter(n => n.parentId === node.id).length;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onEditSave();
    if (e.key === 'Escape') onEditCancel();
  };

  // ===== ROOT NODE =====
  if (isRoot) {
    return (
      <div
        className={cn(
          "absolute pointer-events-auto select-none",
          isDragging ? "cursor-grabbing z-50" : "cursor-grab"
        )}
        style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
        onMouseDown={(e) => onDragStart(e, node.id)}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative flex items-center gap-3 px-7 py-4 rounded-2xl transition-all duration-200",
              "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.15)]",
              isSelected && "ring-2 ring-offset-2 ring-offset-transparent"
            )}
            style={{
              backgroundColor: '#1e293b',
              color: '#fff',
              ...(isSelected ? { ringColor: '#3b82f6' } : {}),
            }}
          >
            {/* Decorative icon */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <span className="text-base">💡</span>
            </div>

            {isEditing ? (
              <input
                ref={inputRef}
                value={editText}
                onChange={(e) => onEditChange(e.target.value)}
                onBlur={onEditSave}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-xl font-bold text-white min-w-[180px] placeholder:text-white/40"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xl font-bold tracking-tight whitespace-nowrap">{node.text}</span>
            )}
          </div>

          {/* Add child FAB */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
            className="flex items-center justify-center w-8 h-8 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all duration-150"
            style={{ backgroundColor: '#3b82f6', color: '#fff' }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // ===== BRANCH NODE (depth 1) =====
  if (isBranch) {
    return (
      <div
        className={cn(
          "absolute pointer-events-auto select-none group/branch",
          isDragging ? "cursor-grabbing z-50" : "cursor-grab"
        )}
        style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
        onMouseDown={(e) => onDragStart(e, node.id)}
      >
        <div className="flex items-center gap-3">
          {/* Card */}
          <div
            className={cn(
              "relative flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl transition-all duration-200",
              "shadow-[0_2px_12px_-2px_rgba(0,0,0,0.12)]",
              isSelected && "ring-2 ring-offset-2 ring-offset-transparent"
            )}
            style={{
              backgroundColor: palette.bg,
              color: '#fff',
            }}
          >
            {/* Icon circle */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <span className="text-white text-lg font-bold">{node.text.charAt(0).toUpperCase()}</span>
            </div>

            {isEditing ? (
              <input
                ref={inputRef}
                value={editText}
                onChange={(e) => onEditChange(e.target.value)}
                onBlur={onEditSave}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-sm font-semibold text-white min-w-[80px] max-w-[160px] placeholder:text-white/50"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-semibold whitespace-nowrap">{node.text}</span>
            )}

            {/* Collapse indicator */}
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                className="ml-1 flex items-center justify-center w-5 h-5 rounded-full transition-all hover:bg-white/20"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                {node.collapsed ? (
                  <span className="text-[10px] font-bold text-white/90">{childCount}</span>
                ) : (
                  <Minus className="h-3 w-3 text-white/80" strokeWidth={2} />
                )}
              </button>
            )}
          </div>

          {/* Add child */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full shadow-md",
              "opacity-0 group-hover/branch:opacity-100 hover:scale-110 active:scale-95 transition-all duration-150"
            )}
            style={{ backgroundColor: palette.bg, color: '#fff' }}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // ===== LEAF NODE (depth 2+) =====
  return (
    <div
      className={cn(
        "absolute pointer-events-auto select-none group/leaf",
        isDragging ? "cursor-grabbing z-50" : "cursor-grab"
      )}
      style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
      onMouseDown={(e) => onDragStart(e, node.id)}
    >
      <div className="flex items-center gap-2">
        {/* Colored dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: palette.bg }}
        />

        {isEditing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none outline-none text-[13px] min-w-[100px] text-foreground"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              "text-[13px] whitespace-nowrap transition-colors leading-none",
              isSelected ? "font-semibold text-foreground" : "font-normal text-foreground/70"
            )}
          >
            {node.text}
          </span>
        )}

        {/* Collapse badge */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
            className="flex items-center justify-center w-4 h-4 rounded-full transition-all"
            style={{ backgroundColor: `${palette.bg}20`, color: palette.bg }}
          >
            {node.collapsed ? (
              <span className="text-[9px] font-bold">{childCount}</span>
            ) : (
              <Minus className="h-2.5 w-2.5" strokeWidth={2} />
            )}
          </button>
        )}

        {/* Add child */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
          className={cn(
            "flex items-center justify-center w-4.5 h-4.5 rounded-full transition-all",
            "opacity-0 group-hover/leaf:opacity-100 hover:scale-125 active:scale-95"
          )}
          style={{ backgroundColor: palette.bg, color: '#fff' }}
        >
          <Plus className="h-2.5 w-2.5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
