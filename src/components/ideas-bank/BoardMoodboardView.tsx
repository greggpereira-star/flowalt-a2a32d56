import { useState, useMemo } from 'react';
import { useIdeaBoard } from '@/hooks/useIdeaBoards';
import { useIdeaReferences, IdeaReference, IdeaReferenceType } from '@/hooks/useIdeaReferences';
import { ReferenceCard } from './ReferenceCard';
import { ReferenceDetailSheet } from './ReferenceDetailSheet';
import { AddReferenceDialog } from './AddReferenceDialog';
import { CreateCardFromIdeaDialog } from './CreateCardFromIdeaDialog';
import { REFERENCE_TYPES } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Search, Star, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  boardId: string;
  onBack?: () => void;
}

export const BoardMoodboardView: React.FC<Props> = ({ boardId, onBack }) => {
  const { data: board } = useIdeaBoard(boardId);
  const { references, isLoading, toggleFavorite } = useIdeaReferences(boardId);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<IdeaReferenceType | 'all' | 'favorites'>('all');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<IdeaReference | null>(null);
  const [creatingCardFor, setCreatingCardFor] = useState<IdeaReference | null>(null);

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

  return (
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
                <h1 className="font-semibold text-lg truncate">{board?.name || 'Moodboard'}</h1>
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
            <Button onClick={() => setAdding(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />Adicionar referência
            </Button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <div className="relative flex-shrink-0 w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..." className="pl-8 h-8 text-sm" />
            </div>
            <Button
              variant={typeFilter === 'all' ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setTypeFilter('all')}
            >Todas</Button>
            <Button
              variant={typeFilter === 'favorites' ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setTypeFilter('favorites')}
            ><Star className="h-3 w-3 mr-1" />Favoritas</Button>
            {REFERENCE_TYPES.map(t => {
              const I = t.icon;
              return (
                <Button
                  key={t.value} size="sm"
                  variant={typeFilter === t.value ? 'secondary' : 'ghost'}
                  onClick={() => setTypeFilter(t.value)}
                  className="flex-shrink-0"
                >
                  <I className="h-3 w-3 mr-1" />{t.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

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
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <Button
        onClick={() => setAdding(true)}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-20"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <AddReferenceDialog open={adding} onOpenChange={setAdding} boardId={boardId} />
      <ReferenceDetailSheet
        reference={detail}
        boardId={boardId}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onCreateCard={(r) => { setDetail(null); setCreatingCardFor(r); }}
      />
      <CreateCardFromIdeaDialog
        reference={creatingCardFor}
        open={!!creatingCardFor}
        onOpenChange={(o) => !o && setCreatingCardFor(null)}
        boardName={board?.name}
      />
    </div>
  );
};
