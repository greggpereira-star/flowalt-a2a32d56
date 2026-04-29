import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Plus, Minus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MindMapNode as NodeType } from './types';
import { getBranchPalette, getNodeDepth } from './utils';

const normalizeNodeLink = (value?: string) => {
  if (!value) return '#';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
  return `https://${value}`;
};

interface AutoGrowEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
  style?: React.CSSProperties;
  minWidth?: number;
  maxWidth?: number;
  placeholderColor?: string;
}

/**
 * Auto-growing textarea for inline node editing.
 * - Expands width to fit text up to maxWidth, then wraps and grows height.
 * - Enter saves; Shift+Enter inserts a newline; Escape cancels.
 */
const AutoGrowEditor: React.FC<AutoGrowEditorProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
  className,
  style,
  minWidth = 120,
  maxWidth = 360,
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, []);

  useLayoutEffect(() => {
    const ta = taRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    // Measure with mirror to get the desired width.
    mirror.textContent = value || ' ';
    const measured = Math.ceil(mirror.getBoundingClientRect().width) + 4;
    const w = Math.max(minWidth, Math.min(maxWidth, measured));
    ta.style.width = `${w}px`;
    // Reset height then grow to scrollHeight for wrapped lines.
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value, minWidth, maxWidth]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <>
      <textarea
        ref={taRef}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'bg-transparent border-none outline-none resize-none overflow-hidden align-middle',
          className
        )}
        style={{ ...style, lineHeight: 1.35 }}
      />
      {/* Hidden mirror for width measurement (matches textarea typography) */}
      <span
        ref={mirrorRef}
        aria-hidden
        className={cn('invisible absolute whitespace-pre pointer-events-none', className)}
        style={{ ...style, position: 'absolute', left: -9999, top: -9999, whiteSpace: 'pre' }}
      />
    </>
  );
};

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
        data-mindmap-node
        data-mindmap-node-id={node.id}
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

            {isEditing ? (
              <AutoGrowEditor
                value={editText}
                onChange={onEditChange}
                onSave={onEditSave}
                onCancel={onEditCancel}
                className="text-lg font-bold text-white placeholder:text-white/30"
                style={textStyle}
                minWidth={180}
                maxWidth={420}
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
        data-mindmap-node
        data-mindmap-node-id={node.id}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
        onMouseDown={(e) => onDragStart(e, node.id)}
      >
        <div className="flex items-center gap-2.5" style={node.nodeWidth ? { width: `${node.nodeWidth}px` } : undefined}>
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

            {isEditing ? (
              <AutoGrowEditor
                value={editText}
                onChange={onEditChange}
                onSave={onEditSave}
                onCancel={onEditCancel}
                className="text-[13px] font-semibold tracking-wide text-white placeholder:text-white/40"
                style={textStyle}
                minWidth={120}
                maxWidth={360}
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
      data-mindmap-node
      data-mindmap-node-id={node.id}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
      onMouseDown={(e) => onDragStart(e, node.id)}
    >
      <div className={cn(
        "flex items-start gap-2 py-1.5 px-2 -ml-2 rounded-lg transition-all duration-150",
        isSelected ? "bg-card shadow-sm border border-border" : "bg-card/95 hover:bg-card hover:shadow-sm"
      )}>
        {/* Icon or colored dot */}
        <div className="mt-[3px]">
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
        </div>

        <div className="flex flex-col gap-0.5" style={{ minWidth: '100px', maxWidth: node.nodeWidth ? `${node.nodeWidth}px` : '240px', width: node.nodeWidth ? `${node.nodeWidth}px` : undefined }}>
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
                "text-[13px] transition-colors duration-150 leading-[1.5]",
                isSelected ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
              )}
              style={{ ...textStyle, overflowWrap: 'break-word' }}
            >
              {node.text}
            </span>
          )}

          {/* Notes & Link indicators */}
          {(node.notes || node.link) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {node.notes && (
                <span className="text-[10px] text-muted-foreground/60" title={node.notes}>📝</span>
              )}
              {node.link && (
                <a
                  href={normalizeNodeLink(node.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-primary/60 hover:text-primary"
                  title={node.link}
                >🔗</a>
              )}
            </div>
          )}
        </div>

        {/* Action buttons - vertically centered */}
        <div className="flex items-center gap-0.5 mt-[3px] flex-shrink-0">
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
    </div>
  );
};
