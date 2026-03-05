import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bold, Italic, Palette, Type, SmilePlus, ImagePlus,
  ChevronDown, X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { MindMapNode } from './types';

const COLOR_SWATCHES = [
  '#1e293b', '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#db2777', '#374151', '#a3a3a3',
];

const ICON_OPTIONS = [
  '💡', '⭐', '🎯', '🚀', '📌', '✅', '❤️', '🔥',
  '💎', '📊', '🎨', '🔑', '⚡', '📝', '🏆', '🎉',
  '📁', '🔔', '💬', '👤', '🌍', '📅', '🛠️', '❌',
];

interface Props {
  node: MindMapNode;
  onUpdateNode: (updates: Partial<MindMapNode>) => void;
  onDeselect: () => void;
}

const ToolBtn: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ active, onClick, children, title }) => (
  <button
    title={title}
    onClick={onClick}
    className={cn(
      "h-8 w-8 flex items-center justify-center rounded-lg transition-all duration-150",
      "hover:bg-accent active:scale-90",
      active && "bg-accent text-primary"
    )}
  >
    {children}
  </button>
);

export const NodeFormatToolbar: React.FC<Props> = ({
  node,
  onUpdateNode,
  onDeselect,
}) => {
  const isBold = node.fontWeight === 'bold';
  const isItalic = node.fontStyle === 'italic';
  const currentSize = node.fontSize ?? 13;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl px-2 py-1">
        {/* Node name indicator */}
        <span className="text-xs text-muted-foreground font-medium px-2 max-w-[120px] truncate border-r border-border mr-1">
          {node.text}
        </span>

        {/* Bold */}
        <ToolBtn active={isBold} onClick={() => onUpdateNode({ fontWeight: isBold ? 'normal' : 'bold' })} title="Negrito">
          <Bold className="h-4 w-4" strokeWidth={isBold ? 3 : 2} />
        </ToolBtn>

        {/* Italic */}
        <ToolBtn active={isItalic} onClick={() => onUpdateNode({ fontStyle: isItalic ? 'normal' : 'italic' })} title="Itálico">
          <Italic className="h-4 w-4" />
        </ToolBtn>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Font Size */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              title="Tamanho da fonte"
              className="h-8 px-2 flex items-center gap-1 rounded-lg hover:bg-accent transition-all text-xs font-medium text-muted-foreground"
            >
              <Type className="h-3.5 w-3.5" />
              <span className="tabular-nums">{currentSize}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-52 p-3" sideOffset={8}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tamanho</span>
                <span className="text-xs font-bold tabular-nums text-foreground">{currentSize}px</span>
              </div>
              <Slider
                value={[currentSize]}
                min={10}
                max={28}
                step={1}
                onValueChange={([v]) => onUpdateNode({ fontSize: v })}
              />
              <div className="flex gap-1">
                {[11, 13, 16, 20, 24].map(s => (
                  <button
                    key={s}
                    onClick={() => onUpdateNode({ fontSize: s })}
                    className={cn(
                      "flex-1 py-1 rounded-md text-[11px] font-medium transition-colors",
                      currentSize === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Color */}
        <Popover>
          <PopoverTrigger asChild>
            <button title="Cor" className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
              <div className="relative">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card"
                  style={{ backgroundColor: node.customColor || node.color }}
                />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-auto p-3" sideOffset={8}>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Cor do nó</span>
              <div className="grid grid-cols-10 gap-1.5">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => onUpdateNode({ customColor: c })}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all hover:scale-125 active:scale-90",
                      (node.customColor || node.color) === c && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Icon */}
        <Popover>
          <PopoverTrigger asChild>
            <button title="Ícone" className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
              {node.icon ? (
                <span className="text-sm">{node.icon}</span>
              ) : (
                <SmilePlus className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-auto p-3" sideOffset={8}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Ícone</span>
                {node.icon && (
                  <button
                    onClick={() => onUpdateNode({ icon: undefined })}
                    className="text-[10px] text-destructive hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
              <div className="grid grid-cols-8 gap-1">
                {ICON_OPTIONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => onUpdateNode({ icon: ic })}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-accent transition-all hover:scale-110 active:scale-90",
                      node.icon === ic && "bg-accent ring-1 ring-primary"
                    )}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Image */}
        <ToolBtn
          title="Adicionar imagem"
          onClick={() => {
            const url = prompt('Cole a URL da imagem:');
            if (url?.trim()) onUpdateNode({ imageUrl: url.trim() });
          }}
        >
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        </ToolBtn>

        {/* Close */}
        <div className="w-px h-5 bg-border mx-0.5" />
        <ToolBtn title="Fechar" onClick={onDeselect}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </ToolBtn>
      </div>
    </div>
  );
};
