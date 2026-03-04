import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FolderOpen, Trash2, Edit3, ArrowLeft, Brain, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FreeMindMap, type MindMapNode } from './FreeMindMap';
import { useMindMaps, useCreateMindMap, useUpdateMindMap, useDeleteMindMap, type MindMap } from '@/hooks/useMindMaps';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MindMapManagerProps {
  spaceId?: string;
  onBack?: () => void;
}

export const MindMapManager: React.FC<MindMapManagerProps> = ({ spaceId, onBack }) => {
  const [activeMindMap, setActiveMindMap] = useState<MindMap | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: mindMaps, isLoading } = useMindMaps(spaceId);
  const createMindMap = useCreateMindMap();
  const updateMindMap = useUpdateMindMap();
  const deleteMindMap = useDeleteMindMap();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createMindMap.mutateAsync({
      name: newName.trim(),
      spaceId,
    });
    setNewName('');
    setIsCreating(false);
    setActiveMindMap(result);
  };

  const handleRename = async (id: string) => {
    if (!renameText.trim()) return;
    await updateMindMap.mutateAsync({ id, name: renameText.trim() });
    setRenamingId(null);
    setRenameText('');
  };

  const handleSaveNodes = (nodes: MindMapNode[]) => {
    if (!activeMindMap) return;
    updateMindMap.mutate({ id: activeMindMap.id, nodes });
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteMindMap.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  // Active mind map editor
  if (activeMindMap) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          <Button variant="ghost" size="sm" onClick={() => setActiveMindMap(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Meus Mapas
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm font-medium truncate">{activeMindMap.name}</span>
        </div>
        <div className="flex-1">
          <FreeMindMap
            viewId={`db-${activeMindMap.id}`}
            initialNodes={activeMindMap.nodes}
            onSave={handleSaveNodes}
          />
        </div>
      </div>
    );
  }

  // Mind maps list
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Meus Mapas Mentais</span>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Mapa
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Create new */}
        {isCreating && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-card border rounded-lg">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do mapa mental..."
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setIsCreating(false); setNewName(''); }
              }}
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createMindMap.isPending}>
              {createMindMap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsCreating(false); setNewName(''); }}>
              Cancelar
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !mindMaps?.length ? (
          <div className="flex flex-col items-center justify-center h-60 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum mapa mental salvo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro mapa mental para organizar ideias e projetos.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Criar Mapa Mental
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mindMaps.map((map) => (
              <div
                key={map.id}
                className={cn(
                  "group relative flex flex-col p-4 bg-card border rounded-xl",
                  "hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                )}
                onClick={() => setActiveMindMap(map)}
              >
                {/* Preview dots */}
                <div className="h-20 mb-3 bg-muted/30 rounded-lg flex items-center justify-center overflow-hidden">
                  <div className="relative w-full h-full">
                    {(map.nodes || []).slice(0, 6).map((node, i) => (
                      <div
                        key={i}
                        className="absolute w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: node.color,
                          left: `${20 + (i % 3) * 30}%`,
                          top: `${20 + Math.floor(i / 3) * 40}%`,
                          opacity: 0.7,
                        }}
                      />
                    ))}
                    {(!map.nodes || map.nodes.length === 0) && (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-xs text-muted-foreground">Vazio</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                {renamingId === map.id ? (
                  <Input
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    className="text-sm h-7 mb-1"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => handleRename(map.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(map.id);
                      if (e.key === 'Escape') { setRenamingId(null); setRenameText(''); }
                    }}
                  />
                ) : (
                  <h4 className="text-sm font-medium truncate">{map.name}</h4>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(map.updated_at), { addSuffix: true, locale: ptBR })}
                  <span className="ml-auto">{(map.nodes || []).length} nós</span>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(map.id);
                      setRenameText(map.name);
                    }}
                    className="p-1.5 rounded-md bg-background/80 border hover:bg-muted transition-colors"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(map.id);
                    }}
                    className="p-1.5 rounded-md bg-background/80 border hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mapa mental?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O mapa mental será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
