import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn, ZoomOut, Maximize2, Save, Trash2, LayoutGrid, Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

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
}) => {
  return (
    <>
      {/* Bottom-left: Zoom pill */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center bg-card border border-border rounded-full shadow-lg px-1 py-0.5 gap-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={onZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] text-muted-foreground min-w-[38px] text-center font-medium select-none tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={onZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Right-side floating actions */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-card border border-border rounded-xl shadow-lg p-1.5">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 rounded-lg hover:bg-muted"
          onClick={onSave} title="Salvar"
        >
          <Save className={cn("h-4 w-4", hasUnsavedChanges && "text-primary")} />
        </Button>

        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 rounded-lg hover:bg-muted"
          onClick={onAutoLayout} title="Auto layout"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>

        <div className="h-px bg-border mx-0.5" />

        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 rounded-lg hover:bg-muted"
          onClick={onResetView} title="Centralizar"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        {selectedNodeId && selectedNodeId !== 'root' && (
          <>
            <div className="h-px bg-border mx-0.5" />
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete} title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Help tooltip - bottom right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="group/help relative">
          <button className="w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <span className="text-xs font-semibold">?</span>
          </button>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover/help:block bg-card border border-border rounded-lg shadow-xl p-3 text-[11px] text-muted-foreground w-52 space-y-1">
            <p><strong className="text-foreground">Clique</strong> para selecionar</p>
            <p><strong className="text-foreground">Duplo clique</strong> para editar</p>
            <p><strong className="text-foreground">Arraste</strong> para mover nó</p>
            <p><strong className="text-foreground">+</strong> para adicionar filho</p>
            <p><strong className="text-foreground">Ctrl+Scroll</strong> zoom</p>
            <p><strong className="text-foreground">Tab</strong> novo filho</p>
            <p><strong className="text-foreground">Delete</strong> excluir nó</p>
          </div>
        </div>
      </div>
    </>
  );
};
