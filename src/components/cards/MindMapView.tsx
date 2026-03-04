import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { List, PenTool, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FreeMindMap } from './FreeMindMap';
import { TaskMindMap } from './TaskMindMap';
import { MindMapManager } from './MindMapManager';
import type { Card } from '@/hooks/useCards';

interface MindMapViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  spaceName?: string;
  folderName?: string;
  viewId?: string;
  spaceId?: string;
}

type MindMapMode = 'select' | 'tasks' | 'free';

// Storage key for mode preference
const getModeStorageKey = (viewId: string) => `mindmap-mode-${viewId}`;

export const MindMapView: React.FC<MindMapViewProps> = ({
  cards,
  onCardClick,
  spaceName = 'Espaço',
  folderName,
  viewId = 'default',
  spaceId,
}) => {
  // Load saved mode from localStorage
  const [mode, setMode] = useState<MindMapMode>(() => {
    try {
      const saved = localStorage.getItem(getModeStorageKey(viewId));
      if (saved === 'tasks' || saved === 'free' || saved === 'saved') {
        return saved;
      }
    } catch (e) {
      console.error('Error loading mode:', e);
    }
    return 'select';
  });

  // Save mode when it changes
  useEffect(() => {
    if (mode !== 'select') {
      try {
        localStorage.setItem(getModeStorageKey(viewId), mode);
      } catch (e) {
        console.error('Error saving mode:', e);
      }
    }
  }, [mode, viewId]);

  // Handle back - optionally reset saved mode
  const handleBack = () => {
    setMode('select');
    try {
      localStorage.removeItem(getModeStorageKey(viewId));
    } catch (e) {
      // Ignore
    }
  };

  // Selection screen
  if (mode === 'select') {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-2xl mx-auto px-4">
          <h2 className="text-xl font-semibold mb-8">
            Escolha uma estrutura que funcione para você
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tasks mode */}
            <button
              onClick={() => setMode('tasks')}
              className={cn(
                "flex flex-col items-center p-8 rounded-xl border-2 border-border",
                "hover:border-primary/50 hover:shadow-lg transition-all",
                "bg-card"
              )}
            >
              {/* Visual representation */}
              <div className="mb-6 relative w-48 h-32">
                {/* Root node */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                  <div className="w-2 h-2 bg-primary rounded-sm" />
                  <span className="text-muted-foreground">—</span>
                </div>
                
                {/* Connection lines */}
                <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 192 128">
                  <path d="M 60 64 C 90 64, 90 30, 120 30" stroke="hsl(var(--destructive))" strokeWidth="2" fill="none" />
                  <path d="M 60 64 C 90 64, 90 64, 120 64" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
                  <path d="M 60 64 C 90 64, 90 98, 120 98" stroke="hsl(var(--accent-foreground))" strokeWidth="2" fill="none" />
                </svg>

                {/* Child nodes */}
                <div className="absolute right-0 top-2 flex items-center gap-1 px-2 py-1 bg-card border rounded text-xs">
                  <div className="w-2 h-2 bg-destructive rounded-sm" />
                  <span>—</span>
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-card border rounded text-xs">
                  <div className="w-2 h-2 bg-primary rounded-sm" />
                  <span>—</span>
                </div>
                <div className="absolute right-0 bottom-2 flex items-center gap-1 px-2 py-1 bg-card border rounded text-xs">
                  <div className="w-2 h-2 bg-accent-foreground rounded-sm" />
                  <span>—</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Visualize suas pastas, listas e tarefas em uma visualização clara e estruturada
              </p>

              <Button variant="default" className="w-full">
                <List className="h-4 w-4 mr-2" />
                Tarefas
              </Button>
            </button>

            {/* Free mode */}
            <button
              onClick={() => setMode('free')}
              className={cn(
                "flex flex-col items-center p-8 rounded-xl border-2 border-border",
                "hover:border-primary/50 hover:shadow-lg transition-all",
                "bg-card"
              )}
            >
              {/* Visual representation */}
              <div className="mb-6 relative w-48 h-32">
                {/* Center node */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-muted rounded-full text-xs">
                  <span className="text-muted-foreground">—</span>
                </div>
                
                {/* Connection lines */}
                <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 192 128">
                  <path d="M 96 64 C 120 64, 130 30, 150 30" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
                  <path d="M 96 64 C 120 64, 130 85, 150 85" stroke="hsl(var(--accent-foreground))" strokeWidth="2" fill="none" />
                </svg>

                {/* Branch nodes */}
                <div className="absolute right-2 top-4 px-2 py-1 bg-card border rounded text-xs">
                  <span>—</span>
                </div>
                <div className="absolute right-2 bottom-6 px-2 py-1 bg-card border rounded text-xs">
                  <span>—</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Discuta ideias e crie novas tarefas a partir de uma tela em branco
              </p>

              <Button variant="default" className="w-full">
                <PenTool className="h-4 w-4 mr-2" />
                Forma livre
              </Button>
            </button>

            {/* Saved maps mode */}
            <button
              onClick={() => setMode('saved')}
              className={cn(
                "flex flex-col items-center p-8 rounded-xl border-2 border-border",
                "hover:border-primary/50 hover:shadow-lg transition-all",
                "bg-card"
              )}
            >
              <div className="mb-6 relative w-48 h-32">
                <div className="absolute inset-2 grid grid-cols-2 gap-2">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="bg-muted/50 rounded-lg border border-border/50 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-primary/30" />
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Acesse seus mapas salvos ou crie novos para diferentes projetos
              </p>

              <Button variant="default" className="w-full">
                <FolderOpen className="h-4 w-4 mr-2" />
                Mapas Salvos
              </Button>
            </button>
          </div>

          {/* Back button if needed */}
          {cards.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              Nenhuma tarefa encontrada. Use o modo "Forma livre" para começar do zero.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Tasks mode - structured view based on cards
  if (mode === 'tasks') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            ← Voltar
          </Button>
          <span className="text-sm font-medium">Mapa de Tarefas</span>
        </div>
        <div className="flex-1">
          <TaskMindMap 
            cards={cards} 
            onCardClick={onCardClick} 
            spaceName={spaceName}
            folderName={folderName}
          />
        </div>
      </div>
    );
  }

  // Saved maps mode
  if (mode === 'saved') {
    return <MindMapManager spaceId={spaceId} onBack={handleBack} />;
  }

  // Free mode - interactive canvas
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          ← Voltar
        </Button>
        <span className="text-sm font-medium">Mapa Mental - Forma Livre</span>
      </div>
      <div className="flex-1">
        <FreeMindMap viewId={viewId} />
      </div>
    </div>
  );
};
