import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Bold, Italic, Palette, Type, SmilePlus,
  ChevronDown, X, GripHorizontal, Copy, Trash2,
  StickyNote, Link2, Link2Off, Paperclip, Loader2,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const ToolBtn: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  variant?: 'default' | 'danger';
}> = ({ active, onClick, children, title, variant = 'default' }) => (
  <button
    title={title}
    onClick={onClick}
    className={cn(
      "h-7 w-7 flex items-center justify-center rounded-md transition-all duration-150",
      "hover:bg-accent active:scale-90",
      active && "bg-accent text-primary",
      variant === 'danger' && "hover:bg-destructive/10 hover:text-destructive"
    )}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-border mx-0.5" />;

const normalizeLink = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const NodeFormatToolbar: React.FC<Props> = ({
  node,
  onUpdateNode,
  onDeselect,
  onDuplicate,
  onDelete,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const isBold = node.fontWeight === 'bold';
  const isItalic = node.fontStyle === 'italic';
  const currentSize = node.fontSize ?? 13;

  // Draggable state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes/Link state
  const [notesText, setNotesText] = useState(node.notes || '');
  const [linkText, setLinkText] = useState(node.link || '');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Sync state when selected node changes
  useEffect(() => {
    setNotesText(node.notes || '');
    setLinkText(node.link || '');
  }, [node.id, node.notes, node.link]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos]);

  const handleFileUpload = useCallback(async (file?: File) => {
    if (!file) return;
    if (!user?.id) {
      toast({ title: 'Você precisa estar logado para enviar arquivos.' });
      return;
    }

    try {
      setIsUploadingFile(true);
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `mindmap/${user.id}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      const nextNotes = node.notes ? `${node.notes}\n📎 ${file.name}` : `📎 ${file.name}`;

      onUpdateNode({ link: publicUrl, notes: nextNotes });
      setLinkText(publicUrl);
      setNotesText(nextNotes);

      toast({ title: 'Arquivo anexado ao nó.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Não foi possível enviar o arquivo.' });
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [user?.id, node.notes, onUpdateNode, toast]);

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "absolute z-50 pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        isDragging && "opacity-90"
      )}
      style={{
        bottom: 16,
        left: '50%',
        transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`,
      }}
    >
      <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl px-1.5 py-1">
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="h-7 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-md hover:bg-accent/50 mr-0.5"
          title="Arraste para mover"
        >
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {/* Node name */}
        <span className="text-[11px] text-muted-foreground font-medium px-1.5 max-w-[100px] truncate border-r border-border mr-0.5">
          {node.text}
        </span>

        {/* Bold */}
        <ToolBtn active={isBold} onClick={() => onUpdateNode({ fontWeight: isBold ? 'normal' : 'bold' })} title="Negrito">
          <Bold className="h-3.5 w-3.5" strokeWidth={isBold ? 3 : 2} />
        </ToolBtn>

        {/* Italic */}
        <ToolBtn active={isItalic} onClick={() => onUpdateNode({ fontStyle: isItalic ? 'normal' : 'italic' })} title="Itálico">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>

        <Divider />

        {/* Font Size */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              title="Tamanho da fonte"
              className="h-7 px-1.5 flex items-center gap-0.5 rounded-md hover:bg-accent transition-all text-[11px] font-medium text-muted-foreground"
            >
              <Type className="h-3 w-3" />
              <span className="tabular-nums">{currentSize}</span>
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-48 p-3" sideOffset={8}>
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
                      "flex-1 py-1 rounded-md text-[10px] font-medium transition-colors",
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

        <Divider />

        {/* Color */}
        <Popover>
          <PopoverTrigger asChild>
            <button title="Cor" className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-all">
              <div className="relative">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card"
                  style={{ backgroundColor: node.customColor || node.color }}
                />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-auto p-3" sideOffset={8}>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Cor do nó</span>
              <div className="grid grid-cols-10 gap-1.5">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => onUpdateNode({ customColor: c })}
                    className={cn(
                      "w-5 h-5 rounded-full transition-all hover:scale-125 active:scale-90",
                      (node.customColor || node.color) === c && "ring-2 ring-primary ring-offset-1 ring-offset-card"
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
            <button title="Ícone" className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-all">
              {node.icon ? (
                <span className="text-xs">{node.icon}</span>
              ) : (
                <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-auto p-3" sideOffset={8}>
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
                      "w-7 h-7 rounded-md flex items-center justify-center text-sm hover:bg-accent transition-all hover:scale-110 active:scale-90",
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

        <Divider />

        {/* Notes */}
        <Popover onOpenChange={(open) => { if (!open) onUpdateNode({ notes: notesText.trim() || undefined }); }}>
          <PopoverTrigger asChild>
            <ToolBtn active={!!node.notes} title="Notas">
              <StickyNote className="h-3.5 w-3.5" />
            </ToolBtn>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-64 p-3" sideOffset={8}>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Notas do nó</span>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Adicione notas ou descrição..."
                className="w-full h-24 text-xs bg-muted/50 border border-border rounded-lg p-2 resize-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
              />
              {notesText && (
                <button
                  onClick={() => { setNotesText(''); onUpdateNode({ notes: undefined }); }}
                  className="text-[10px] text-destructive hover:underline"
                >
                  Limpar notas
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Link */}
        <Popover onOpenChange={(open) => { if (!open) onUpdateNode({ link: linkText.trim() || undefined }); }}>
          <PopoverTrigger asChild>
            <ToolBtn active={!!node.link} title="Link">
              {node.link ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
            </ToolBtn>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-64 p-3" sideOffset={8}>
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Link externo</span>
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onUpdateNode({ link: linkText.trim() || undefined }); }}
                placeholder="https://..."
                className="w-full text-xs bg-muted/50 border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
              />
              {linkText && (
                <div className="flex items-center justify-between">
                  <a
                    href={linkText}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary hover:underline truncate max-w-[180px]"
                  >
                    {linkText}
                  </a>
                  <button
                    onClick={() => { setLinkText(''); onUpdateNode({ link: undefined }); }}
                    className="text-[10px] text-destructive hover:underline ml-2"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Divider />

        {/* Duplicate */}
        {onDuplicate && node.id !== 'root' && (
          <ToolBtn title="Duplicar nó" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </ToolBtn>
        )}

        {/* Delete */}
        {onDelete && node.id !== 'root' && (
          <ToolBtn title="Excluir nó" onClick={onDelete} variant="danger">
            <Trash2 className="h-3.5 w-3.5" />
          </ToolBtn>
        )}

        {/* Close */}
        <ToolBtn title="Fechar" onClick={onDeselect}>
          <X className="h-3 w-3 text-muted-foreground" />
        </ToolBtn>
      </div>
    </div>
  );
};
