import React, { useRef, useEffect } from 'react';
import { Plus, Minus, GripVertical } from 'lucide-react';
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
  const isEditing = editingNodeId === node.id;
  const hasChildren = allNodes.some(n => n.parentId === node.id);
  const childCount = allNodes.filter(n => n.parentId === node.id).length;
  const nodeColor = node.customColor || palette.bg;
  const textStyle: React.CSSProperties = {
    fontSize: node.fontSize ? `${node.fontSize}px` : undefined,
    fontWeight: node.fontWeight || undefined,
    fontStyle: node.fontStyle || undefined,
  };
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
          "absolute pointer-events-auto select-none transition-transform duration-150",
          isDragging ? "cursor-grabbing z-50 scale-105" : "cursor-grab"
        )}
        style={{ left: node.x, top: node.y, transform: `translate(-50%, -50%)${isDragging ? ' scale(1.03)' : ''}` }}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
        onMouseDown={(e) => onDragStart(e, node.id)}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative flex items-center gap-3 px-6 py-3.5 rounded-2xl transition-all duration-200",
              "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.2)]",
              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
            style={{ backgroundColor: node.customColor || '#1e293b', color: '#fff' }}
          >
            {node.icon && (
              <span className="text-lg">{node.icon}</span>
            )}
            {!node.icon && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))' }}
              >
                <span className="text-lg">💡</span>
              </div>
            )}

            {node.imageUrl && (
              <img src={node.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
            )}

            {isEditing ? (
              <input
                ref={inputRef}
                value={editText}
                onChange={(e) => onEditChange(e.target.value)}
                onBlur={onEditSave}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-lg font-bold text-white min-w-[160px] placeholder:text-white/30"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-lg font-bold tracking-tight whitespace-nowrap" style={textStyle}>{node.text}</span>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
            className="flex items-center justify-center w-8 h-8 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all duration-150 bg-primary text-primary-foreground"
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
          "absolute pointer-events-auto select-none group/branch transition-transform duration-150",
          isDragging ? "cursor-grabbing z-50" : "cursor-grab"
        )}
        style={{ left: node.x, top: node.y, transform: `translate(0%, -50%)${isDragging ? ' scale(1.03)' : ''}` }}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
        onMouseDown={(e) => onDragStart(e, node.id)}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "relative flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl transition-all duration-200",
              "shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12)]",
              isSelected && "ring-2 ring-offset-2 ring-offset-background"
            )}
            style={{
              backgroundColor: nodeColor,
              ...(isSelected ? { '--tw-ring-color': nodeColor } as React.CSSProperties : {}),
            }}
          >
            {/* Grip handle on hover */}
            <div className="opacity-0 group-hover/branch:opacity-40 transition-opacity -ml-1 mr-0">
              <GripVertical className="h-3.5 w-3.5 text-white" />
            </div>

            {node.icon ? (
              <span className="text-base">{node.icon}</span>
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08))' }}
              >
                <span className="text-white text-xs font-bold">{node.text.charAt(0).toUpperCase()}</span>
              </div>
            )}

            {node.imageUrl && (
              <img src={node.imageUrl} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0" />
            )}

            {isEditing ? (
              <input
                ref={inputRef}
                value={editText}
                onChange={(e) => onEditChange(e.target.value)}
                onBlur={onEditSave}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-[13px] font-semibold tracking-wide text-white min-w-[60px] max-w-[180px] placeholder:text-white/40"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-[13px] font-semibold tracking-wide whitespace-nowrap text-white drop-shadow-sm" style={textStyle}>
                {node.text}
              </span>
            )}

            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full transition-all hover:bg-white/25 active:scale-90"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                {node.collapsed ? (
                  <span className="text-[10px] font-bold text-white/90">{childCount}</span>
                ) : (
                  <Minus className="h-3 w-3 text-white/80" strokeWidth={2.5} />
                )}
              </button>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full shadow-md",
              "opacity-0 group-hover/branch:opacity-100 hover:scale-110 active:scale-90 transition-all duration-150"
            )}
            style={{ backgroundColor: nodeColor, color: '#fff' }}
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
        "absolute pointer-events-auto select-none group/leaf transition-transform duration-150",
        isDragging ? "cursor-grabbing z-50" : "cursor-grab"
      )}
      style={{ left: node.x, top: node.y, transform: `translate(0%, -50%)${isDragging ? ' scale(1.05)' : ''}` }}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
      onMouseDown={(e) => onDragStart(e, node.id)}
    >
      <div className={cn(
        "flex items-center gap-2 py-1 px-2 -ml-2 rounded-lg transition-all duration-150",
        isSelected ? "bg-accent/60" : "hover:bg-accent/30"
      )}>
        {/* Icon or colored dot */}
        {node.icon ? (
          <span className="text-sm flex-shrink-0">{node.icon}</span>
        ) : (
          <div className="relative flex-shrink-0">
            <div
              className={cn("w-2.5 h-2.5 rounded-full transition-transform duration-200", isSelected && "scale-125")}
              style={{ backgroundColor: nodeColor }}
            />
            {isSelected && (
              <div
                className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: nodeColor }}
              />
            )}
          </div>
        )}

        {node.imageUrl && (
          <img src={node.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none outline-none text-[13px] min-w-[80px] text-foreground"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              "text-[13px] whitespace-nowrap transition-all duration-150 leading-none",
              isSelected ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
            )}
            style={textStyle}
          >
            {node.text}
          </span>
        )}

        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
            className="flex items-center justify-center w-4 h-4 rounded-full transition-all hover:scale-110 active:scale-90"
            style={{ backgroundColor: `${nodeColor}18`, color: nodeColor }}
          >
            {node.collapsed ? (
              <span className="text-[9px] font-bold">{childCount}</span>
            ) : (
              <Minus className="h-2.5 w-2.5" strokeWidth={2} />
            )}
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
          className={cn(
            "flex items-center justify-center w-4 h-4 rounded-full transition-all",
            "opacity-0 group-hover/leaf:opacity-100 hover:scale-125 active:scale-90"
          )}
          style={{ backgroundColor: nodeColor, color: '#fff' }}
        >
          <Plus className="h-2.5 w-2.5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
