import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { HowItWorksDialog } from './HowItWorksDialog';
import { REFERENCE_TYPES, getTypeMeta } from './types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Plus, Search, Star, ImagePlus, Share2, CheckSquare, X,
  FolderInput, Trash2, FolderOpen, Sparkles, HelpCircle, Keyboard, Loader2,
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
  const { references, isLoading, toggleFavorite, bulkMove, bulkDelete, bulkFavorite, create, uploadFile } = useIdeaReferences(boardId);
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<IdeaReferenceType | 'all' | 'favorites'>('all');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<IdeaReference | null>(null);
  const [creatingCardFor, setCreatingCardFor] = useState<IdeaReference | null>(null);
  const [convertingBoard, setConvertingBoard] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);


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

  // Quick add: paste image / link with Ctrl+V
  const quickAddFile = useCallback(async (f: File) => {
    try {
      const { signedUrl } = await uploadFile(f, boardId);
      const isImg = f.type.startsWith('image/');
      const isVid = f.type.startsWith('video/');
      await create.mutateAsync({
        board_id: boardId,
        type: isImg ? 'image' : isVid ? 'video' : 'file',
        title: f.name.replace(/\.[^/.]+$/, ''),
        media_url: isImg || isVid ? signedUrl : null,
        thumbnail_url: isImg ? signedUrl : null,
        file_url: isImg || isVid ? null : signedUrl,
        file_name: f.name,
        tags: [],
      });
    } catch (e: any) {
      toast({ title: 'Falha ao adicionar', description: e.message, variant: 'destructive' });
    }
  }, [boardId, uploadFile, create, toast]);

  const quickAddLink = useCallback(async (url: string) => {
    try {
      await create.mutateAsync({
        board_id: boardId,
        type: 'link',
        title: url,
        source_url: url,
        tags: [],
      });
    } catch (e: any) {
      toast({ title: 'Falha ao adicionar link', description: e.message, variant: 'destructive' });
    }
  }, [boardId, create, toast]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); quickAddFile(f); return; }
        }
      }
      const text = e.clipboardData?.getData('text');
      if (text && /^https?:\/\//i.test(text.trim())) {
        e.preventDefault();
        quickAddLink(text.trim());
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [quickAddFile, quickAddLink]);

  // Keyboard shortcuts: "/" focus search, "N" new reference, "?" help, "Esc" exit select mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) {
        if (e.key === 'Escape' && t === searchRef.current) (t as HTMLInputElement).blur();
        return;
      }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key.toLowerCase() === 'n') { e.preventDefault(); setAdding(true); }
      else if (e.key === '?') { e.preventDefault(); setHowOpen(true); }
      else if (e.key === 'Escape' && selectMode) { e.preventDefault(); exitSelectMode(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectMode]);


  const [fileDragOver, setFileDragOver] = useState(false);
  const onFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setFileDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(quickAddFile);
  };

  return (
    <TooltipProvider delayDuration={200}>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="border-b bg-background sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {onBack && (
                  <Button
                    variant="ghost" size="icon" onClick={onBack}
                    aria-label="Voltar para as pastas"
                    className="-ml-2 mt-0.5"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-semibold text-lg truncate">{board?.name || 'Moodboard'}</h1>
                    {board?.is_public && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Share2 className="h-3 w-3 mr-1" aria-hidden="true" />Público
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setHowOpen(true)}
                      aria-label="Como funciona o Banco de Ideias"
                    >
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Como funciona · atalho <kbd>?</kbd></TooltipContent>
                </Tooltip>
                <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
                  <Share2 className="h-4 w-4 mr-2" aria-hidden="true" />Compartilhar
                </Button>
                {references.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setConvertingBoard(true)}
                        aria-label="Transformar pasta inteira em card com moodboard"
                      >
                        <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
                        Virar demanda
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cria um card com todas as referências anexadas como moodboard</TooltipContent>
                  </Tooltip>
                )}
                {!selectMode ? (
                  <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}
                    aria-label="Entrar no modo de seleção múltipla">
                    <CheckSquare className="h-4 w-4 mr-2" aria-hidden="true" />Selecionar
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}
                    aria-label="Sair do modo de seleção">
                    <X className="h-4 w-4 mr-2" aria-hidden="true" />Sair
                  </Button>
                )}
                <Button onClick={() => setAdding(true)} size="sm" aria-keyshortcuts="N">
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />Referência
                </Button>
              </div>
            </div>

            {(() => {
              const counts = references.reduce<Record<string, number>>((acc, r) => {
                acc[r.type] = (acc[r.type] || 0) + 1;
                return acc;
              }, {});
              const favCount = references.filter(r => r.is_favorite).length;
              const totalCount = references.length;
              const activeType = typeFilter !== 'all' && typeFilter !== 'favorites' ? typeFilter : null;
              const activeMeta = activeType ? getTypeMeta(activeType) : null;
              const ActiveIcon = activeMeta?.icon;
              const isFav = typeFilter === 'favorites';
              const activeCount = (activeType ? 1 : 0) + (isFav ? 1 : 0) + (q.trim() ? 1 : 0);

              return (
                <div role="toolbar" aria-label="Filtros do quadro" className="flex items-center gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <label htmlFor="ib-board-search" className="sr-only">Buscar referência</label>
                    <Input
                      id="ib-board-search"
                      ref={searchRef}
                      value={q} onChange={e => setQ(e.target.value)}
                      placeholder="Buscar referência..."
                      className="pl-9 h-9 text-sm rounded-full bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-input"
                    />
                  </div>

                  {/* Single Filtros popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'h-9 px-3 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 border',
                          activeCount > 0
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-background hover:bg-muted/60 border-input text-foreground'
                        )}
                        aria-label="Abrir filtros"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                        Filtros
                        {activeCount > 0 && (
                          <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] inline-flex items-center justify-center tabular-nums">
                            {activeCount}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-3 space-y-3">
                      {/* Quick segmented filters (stacked vertical) */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Visualizar</p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTypeFilter('all')}
                            aria-pressed={typeFilter === 'all'}
                            className={cn(
                              'flex-1 h-8 px-3 rounded-full text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 border',
                              typeFilter === 'all'
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-background hover:bg-muted/60 border-input text-foreground'
                            )}
                          >
                            Todas
                            <span className="text-[10px] opacity-60 tabular-nums">{totalCount}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTypeFilter('favorites')}
                            aria-pressed={isFav}
                            className={cn(
                              'flex-1 h-8 px-3 rounded-full text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 border',
                              isFav
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-background hover:bg-muted/60 border-input text-foreground'
                            )}
                          >
                            <Star className={cn('h-3 w-3', isFav && 'fill-amber-400 text-amber-400')} aria-hidden="true" />
                            Favoritas
                            <span className="text-[10px] opacity-60 tabular-nums">{favCount}</span>
                          </button>
                        </div>
                      </div>

                      {/* Types as vertical list */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5 px-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</span>
                          {activeType && (
                            <button
                              type="button"
                              onClick={() => setTypeFilter('all')}
                              className="text-[11px] text-primary hover:underline"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {REFERENCE_TYPES.map(t => {
                            const I = t.icon;
                            const c = counts[t.value] || 0;
                            const isActive = typeFilter === t.value;
                            const disabled = c === 0 && !isActive;
                            return (
                              <button
                                key={t.value}
                                type="button"
                                disabled={disabled}
                                onClick={() => setTypeFilter(t.value)}
                                aria-pressed={isActive}
                                className={cn(
                                  'group flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                                  isActive
                                    ? 'bg-primary/10 text-primary'
                                    : disabled
                                      ? 'text-muted-foreground/50 cursor-not-allowed'
                                      : 'hover:bg-muted text-foreground'
                                )}
                              >
                                <I className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                                <span className="flex-1 truncate">{t.label}</span>
                                {isActive ? (
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                ) : (
                                  <span className="text-[10px] opacity-50 tabular-nums">{c}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {activeCount > 0 && (
                        <div className="pt-1 border-t">
                          <button
                            type="button"
                            onClick={() => { setTypeFilter('all'); setQ(''); }}
                            className="w-full h-8 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Limpar todos os filtros
                          </button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  {/* Active chips inline */}
                  {isFav && (
                    <button
                      type="button"
                      onClick={() => setTypeFilter('all')}
                      className="h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                      aria-label="Remover filtro Favoritas"
                    >
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                      Favoritas
                      <X className="h-3 w-3 opacity-70" aria-hidden="true" />
                    </button>
                  )}
                  {activeType && ActiveIcon && (
                    <button
                      type="button"
                      onClick={() => setTypeFilter('all')}
                      className="h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                      aria-label={`Remover filtro ${activeMeta?.label}`}
                    >
                      <ActiveIcon className="h-3 w-3" aria-hidden="true" />
                      {activeMeta?.label}
                      <X className="h-3 w-3 opacity-70" aria-hidden="true" />
                    </button>
                  )}
                  {q && (
                    <button
                      type="button"
                      onClick={() => setQ('')}
                      className="h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                      aria-label="Limpar busca"
                    >
                      "{q.slice(0, 16)}{q.length > 16 ? '…' : ''}"
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}

                  <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                    {filtered.length} {filtered.length === 1 ? 'referência' : 'referências'}
                  </span>
                </div>
              );
            })()}
          </div>
        </header>


        {/* Grid */}
        <div
          className={cn(
            'flex-1 overflow-auto p-4 relative',
            fileDragOver && 'bg-primary/5'
          )}
          onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
          onDragLeave={() => setFileDragOver(false)}
          onDrop={onFileDrop}
        >
          {fileDragOver && (
            <div className="pointer-events-none absolute inset-4 z-30 rounded-2xl border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center">
              <div className="text-center">
                <ImagePlus className="h-10 w-10 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Solte os arquivos para adicionar</p>
              </div>
            </div>
          )}

          {/* Quick tip */}
          {!isLoading && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />Atalhos rápidos:
              </span>
              <span className="flex items-center gap-1">
                <Keyboard className="h-3 w-3" /> Cole link/imagem com
                <kbd className="px-1.5 py-0.5 rounded border bg-background font-mono text-[10px]">Ctrl+V</kbd>
              </span>
              <span className="hidden sm:inline">·</span>
              <span>Arraste arquivos para dentro do quadro</span>
              <span className="hidden sm:inline">·</span>
              <span>Passe o mouse num card → <strong className="text-foreground">Criar card</strong> vira demanda</span>
            </div>
          )}

          {isLoading ? (
            <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={cn('mb-4 rounded-xl w-full', i % 3 === 0 ? 'h-64' : i % 2 === 0 ? 'h-48' : 'h-40')} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ImagePlus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-1">
                {q || typeFilter !== 'all' ? 'Nenhuma referência encontrada' : 'Este quadro ainda está vazio'}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mb-5">
                {q || typeFilter !== 'all'
                  ? 'Ajuste os filtros ou adicione novas referências.'
                  : 'Adicione imagens, vídeos, links, PDFs ou notas. Você também pode colar (Ctrl+V) ou arrastar arquivos diretamente aqui.'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => setAdding(true)} size="lg">
                  <Plus className="h-4 w-4 mr-2" />Adicionar referência
                </Button>
              </div>
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
                  onMove={otherBoards.length > 0 ? () => setMoveDialog({ open: true, ids: [r.id] }) : undefined}
                  pendingFavorite={toggleFavorite.isPending && toggleFavorite.variables?.id === r.id}
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
              <Button size="sm" variant="outline" disabled={!selected.size || bulkFavorite.isPending}
                onClick={() => bulkFavorite.mutate({ ids: Array.from(selected), value: true })}
                aria-label="Favoritar referências selecionadas">
                {bulkFavorite.isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  : <Star className="h-4 w-4 mr-2" aria-hidden="true" />}
                Favoritar
              </Button>
              <Button size="sm" variant="outline" disabled={!selected.size}
                onClick={() => setMoveDialog({ open: true, ids: Array.from(selected) })}
                aria-label="Mover referências selecionadas para outra pasta">
                <FolderInput className="h-4 w-4 mr-2" aria-hidden="true" />Mover
              </Button>
              <Button size="sm" variant="destructive" disabled={!selected.size || bulkDelete.isPending}
                onClick={() => {
                  if (confirm(`Excluir ${selected.size} referência(s)?`)) {
                    bulkDelete.mutate(Array.from(selected), {
                      onSuccess: () => exitSelectMode(),
                    });
                  }
                }}
                aria-label="Excluir referências selecionadas">
                {bulkDelete.isPending
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  : <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />}
                Excluir
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
          boardId={boardId}
        />
        <CreateCardFromIdeaDialog
          boardReferences={convertingBoard ? references : undefined}
          boardId={boardId}
          open={convertingBoard}
          onOpenChange={setConvertingBoard}
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
        <HowItWorksDialog
          open={howOpen}
          onOpenChange={setHowOpen}
          onAddReference={() => setAdding(true)}
          canAddReference
        />
      </div>
    </DndContext>
    </TooltipProvider>
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
