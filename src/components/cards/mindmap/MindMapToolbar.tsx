import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn, ZoomOut, Maximize2, Save, Trash2, LayoutGrid,
  Keyboard, MousePointer2, Image, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  zoom: number;
  hasUnsavedChanges: boolean;
  selectedNodeId: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSave: () => void;
  onDelete: () => void;
  onAutoLayout: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
}> = ({ onClick, title, children, variant }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-lg",
            variant === 'destructive'
              ? "text-destructive hover:text-destructive hover:bg-destructive/10"
              : "hover:bg-accent"
          )}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const MindMapToolbar: React.FC<Props> = ({
  zoom,
  hasUnsavedChanges,
  selectedNodeId,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSave,
  onDelete,
  onAutoLayout,
  onExportPng,
  onExportPdf,
}) => {
  return (
    <>
      {/* Bottom-left: Zoom controls */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg px-1 py-0.5 gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-accent" onClick={onZoomOut}>
          <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <span className="text-[11px] text-muted-foreground min-w-[36px] text-center font-medium select-none tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-accent" onClick={onZoomIn}>
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Right-side floating toolbar */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-0.5 bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg p-1">
        <ToolbarButton onClick={onSave} title="Salvar (Ctrl+S)">
          <Save className={cn("h-4 w-4", hasUnsavedChanges ? "text-primary" : "text-muted-foreground")} />
        </ToolbarButton>

        <ToolbarButton onClick={onAutoLayout} title="Reorganizar layout">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        </ToolbarButton>

        <ToolbarButton onClick={onResetView} title="Centralizar vista">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </ToolbarButton>

        <div className="h-px bg-border mx-1 my-0.5" />

        <ToolbarButton onClick={onExportPng} title="Exportar como PNG">
          <Image className="h-4 w-4 text-muted-foreground" />
        </ToolbarButton>

        <ToolbarButton onClick={onExportPdf} title="Exportar como PDF">
          <FileDown className="h-4 w-4 text-muted-foreground" />
        </ToolbarButton>

        {selectedNodeId && selectedNodeId !== 'root' && (
          <>
            <div className="h-px bg-border mx-1 my-0.5" />
            <ToolbarButton onClick={onDelete} title="Excluir nó" variant="destructive">
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
      </div>

      {/* Bottom-right: shortcuts hint */}
      <div className="absolute bottom-4 right-4 z-30">
        <div className="group/help relative">
          <button className="h-7 w-7 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Keyboard className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/help:block bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl p-3 text-[11px] text-muted-foreground w-56 space-y-1.5">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <MousePointer2 className="h-3 w-3" /> Atalhos
            </p>
            <div className="space-y-1">
              <div className="flex justify-between"><span>Selecionar</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Clique</kbd></div>
              <div className="flex justify-between"><span>Editar</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd></div>
              <div className="flex justify-between"><span>Novo filho</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Tab</kbd></div>
              <div className="flex justify-between"><span>Excluir</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Del</kbd></div>
              <div className="flex justify-between"><span>Zoom</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+Scroll</kbd></div>
              <div className="flex justify-between"><span>Mover canvas</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Arrastar</kbd></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
