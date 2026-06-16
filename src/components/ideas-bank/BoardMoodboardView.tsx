import { useState, useMemo, useEffect, useCallback } from 'react';
import { useIdeaBoard, useIdeaBoards } from '@/hooks/useIdeaBoards';
import { useIdeaReferences, IdeaReference, IdeaReferenceType } from '@/hooks/useIdeaReferences';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReferenceCard } from './ReferenceCard';
import { ReferenceDetailSheet } from './ReferenceDetailSheet';
import { AddReferenceDialog } from './AddReferenceDialog';
import { CreateCardFromIdeaDialog } from './CreateCardFromIdeaDialog';
import { ShareBoardDialog } from './ShareBoardDialog';
import { MoveToBoardDialog } from './MoveToBoardDialog';
import { REFERENCE_TYPES } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Plus, Search, Star, ImagePlus, Share2, CheckSquare, X,
  FolderInput, Trash2, FolderOpen, Sparkles, HelpCircle, Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';

interface Props {
  boardId: string;
  onBack?: () => void;
}

export const BoardMoodboardView: React.FC<Props> = ({ boardId, onBack }) => {
  const { data: board } = useIdeaBoard(boardId);
  const { boards } = useIdeaBoards();
  const { references, isLoading, toggleFavorite, bulkMove, bulkDelete, bulkFavorite } = useIdeaReferences(boardId);

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<IdeaReferenceType | 'all' | 'favorites'>('all');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<IdeaReference | null>(null);
  const [creatingCardFor, setCreatingCardFor] = useState<IdeaReference | null>(null);
  const [sharing, setSharing] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveDialog, setMoveDialog] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [draggingRef, setDraggingRef] = useState<IdeaReference | null>(null);
  const [showDropTargets, setShowDropTargets] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(() => {
    return references.filter(r => {
      if (typeFilter === 'favorites' && !r.is_favorite) return false;
      if (typeFilter !== 'all' && typeFilter !== 'favorites' && r.type !== typeFilter) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        return r.title.toLowerCase().includes(s) ||
          r.description?.toLowerCase().includes(s) ||
          r.tags?.some(t => t.toLowerCase().includes(s));
      }
      return true;
    });
  }, [references, q, typeFilter]);

  const otherBoards = useMemo(
    () => boards.filter(b => b.id !== boardId).slice(0, 12),
    [boards, boardId]
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(r => r.id)));
  const clearSelection = () => setSelected(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };

  const handleDragStart = (e: DragStartEvent) => {
    const ref = e.active.data.current?.reference as IdeaReference | undefined;
    if (ref) {
      setDraggingRef(ref);
      setShowDropTargets(true);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setShowDropTargets(false);
    const ref = draggingRef;
    setDraggingRef(null);
    if (!ref || !e.over) return;
    const targetBoardId = String(e.over.id).replace(/^board-/, '');
    if (!targetBoardId || targetBoardId === boardId) return;
    bulkMove.mutate({ ids: [ref.id], targetBoardId });
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b bg-background sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {onBack && (
                  <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 mt-0.5">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-semibold text-lg truncate">{board?.name || 'Moodboard'}</h1>
                    {board?.is_public && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Share2 className="h-3 w-3 mr-1" />Público
                      </Badge>
                    )}
                  </div>
                  {board?.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{board.description}</p>
                  )}
                  {board?.tags && board.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {board.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
                  <Share2 className="h-4 w-4 mr-2" />Compartilhar
                </Button>
                {!selectMode ? (
                  <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
                    <CheckSquare className="h-4 w-4 mr-2" />Selecionar
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                    <X className="h-4 w-4 mr-2" />Sair
                  </Button>
                )}
                <Button onClick={() => setAdding(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />Referência
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="relative flex-shrink-0 w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-sm" />
              </div>
              <Button variant={typeFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter('all')}>Todas</Button>
              <Button variant={typeFilter === 'favorites' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter('favorites')}>
                <Star className="h-3 w-3 mr-1" />Favoritas
              </Button>
              {REFERENCE_TYPES.map(t => {
                const I = t.icon;
                return (
                  <Button key={t.value} size="sm" variant={typeFilter === t.value ? 'secondary' : 'ghost'}
                    onClick={() => setTypeFilter(t.value)} className="flex-shrink-0">
                    <I className="h-3 w-3 mr-1" />{t.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={cn('mb-4 rounded-xl w-full', i % 3 === 0 ? 'h-64' : i % 2 === 0 ? 'h-48' : 'h-40')} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ImagePlus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-1">
                {q || typeFilter !== 'all' ? 'Nenhuma referência encontrada' : 'Este moodboard ainda está vazio'}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mb-5">
                {q || typeFilter !== 'all'
                  ? 'Ajuste os filtros ou adicione novas referências.'
                  : 'Comece adicionando imagens, links, vídeos ou textos que inspiram o trabalho.'}
              </p>
              <Button onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />Adicionar primeira referência
              </Button>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
              {filtered.map(r => (
                <ReferenceCard
                  key={r.id}
                  reference={r}
                  onClick={() => setDetail(r)}
                  onCreateCard={() => setCreatingCardFor(r)}
                  onFavorite={() => toggleFavorite.mutate(r)}
                  selectMode={selectMode}
                  selected={selected.has(r.id)}
                  onToggleSelect={() => toggleSelect(r.id)}
                  draggable={otherBoards.length > 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selectMode && (
          <div className="border-t bg-background sticky bottom-0 p-3 flex items-center justify-between gap-3 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{selected.size} selecionada{selected.size === 1 ? '' : 's'}</Badge>
              <Button size="sm" variant="ghost" onClick={selectAll}>Selecionar tudo ({filtered.length})</Button>
              {selected.size > 0 && <Button size="sm" variant="ghost" onClick={clearSelection}>Limpar</Button>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!selected.size}
                onClick={() => bulkFavorite.mutate({ ids: Array.from(selected), value: true })}>
                <Star className="h-4 w-4 mr-2" />Favoritar
              </Button>
              <Button size="sm" variant="outline" disabled={!selected.size}
                onClick={() => setMoveDialog({ open: true, ids: Array.from(selected) })}>
                <FolderInput className="h-4 w-4 mr-2" />Mover
              </Button>
              <Button size="sm" variant="destructive" disabled={!selected.size}
                onClick={() => {
                  if (confirm(`Excluir ${selected.size} referência(s)?`)) {
                    bulkDelete.mutate(Array.from(selected), {
                      onSuccess: () => exitSelectMode(),
                    });
                  }
                }}>
                <Trash2 className="h-4 w-4 mr-2" />Excluir
              </Button>
            </div>
          </div>
        )}

        {/* DnD drop targets panel */}
        {showDropTargets && otherBoards.length > 0 && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 max-w-[min(100vw-2rem,720px)] w-full bg-background border rounded-2xl shadow-xl p-3 animate-in fade-in slide-in-from-bottom-4">
            <p className="text-xs text-muted-foreground mb-2 px-1">Solte em uma pasta para mover</p>
            <div className="flex gap-2 overflow-x-auto">
              {otherBoards.map(b => (
                <BoardDropTarget key={b.id} id={`board-${b.id}`} label={b.name} count={b.reference_count ?? 0} />
              ))}
            </div>
          </div>
        )}

        <DragOverlay>
          {draggingRef && (
            <div className="rounded-xl overflow-hidden border bg-card shadow-2xl w-40 rotate-2">
              {draggingRef.thumbnail_url || draggingRef.media_url ? (
                <img src={draggingRef.thumbnail_url || draggingRef.media_url!} alt="" className="w-full" />
              ) : (
                <div className="p-3 text-xs font-medium line-clamp-2">{draggingRef.title}</div>
              )}
            </div>
          )}
        </DragOverlay>

        {/* Mobile FAB */}
        {!selectMode && (
          <Button onClick={() => setAdding(true)}
            className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-20" size="icon">
            <Plus className="h-6 w-6" />
          </Button>
        )}

        <AddReferenceDialog open={adding} onOpenChange={setAdding} boardId={boardId} />
        <ReferenceDetailSheet
          reference={detail} boardId={boardId} open={!!detail}
          onOpenChange={(o) => !o && setDetail(null)}
          onCreateCard={(r) => { setDetail(null); setCreatingCardFor(r); }}
        />
        <CreateCardFromIdeaDialog
          reference={creatingCardFor} open={!!creatingCardFor}
          onOpenChange={(o) => !o && setCreatingCardFor(null)}
          boardName={board?.name}
        />
        <ShareBoardDialog board={board ?? null} open={sharing} onOpenChange={setSharing} />
        <MoveToBoardDialog
          open={moveDialog.open}
          onOpenChange={(o) => setMoveDialog(prev => ({ ...prev, open: o }))}
          excludeBoardId={boardId}
          count={moveDialog.ids.length}
          onConfirm={(targetBoardId) => {
            bulkMove.mutate({ ids: moveDialog.ids, targetBoardId }, { onSuccess: () => exitSelectMode() });
          }}
        />
      </div>
    </DndContext>
  );
};

const BoardDropTarget: React.FC<{ id: string; label: string; count: number }> = ({ id, label, count }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 min-w-[140px] rounded-xl border-2 border-dashed p-3 flex flex-col gap-1 transition-colors',
        isOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
      )}
    >
      <div className="flex items-center gap-1.5">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{count} item{count === 1 ? '' : 's'}</span>
    </div>
  );
};
