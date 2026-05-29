import { useState, useMemo } from 'react';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import { BoardCard } from './BoardCard';
import { CreateBoardDialog } from './CreateBoardDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Lightbulb, Sparkles } from 'lucide-react';

interface Props {
  folderId?: string | null;
  onOpenBoard: (boardId: string) => void;
}

export const BoardsGalleryView: React.FC<Props> = ({ folderId, onOpenBoard }) => {
  const { boards, isLoading } = useIdeaBoards({ folderId });
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return boards;
    const s = q.toLowerCase();
    return boards.filter(b =>
      b.name.toLowerCase().includes(s) ||
      b.description?.toLowerCase().includes(s) ||
      b.category?.toLowerCase().includes(s) ||
      b.tags?.some(t => t.toLowerCase().includes(s))
    );
  }, [boards, q]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-lg">Banco de Ideias</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              · Central criativa
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar pasta..."
                className="pl-8 h-9"
              />
            </div>
            <Button onClick={() => setCreating(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />Nova pasta
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lightbulb className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-1">
              {q ? 'Nenhuma pasta encontrada' : 'Crie seu primeiro quadro de ideias'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-5">
              {q
                ? 'Tente outro termo de busca.'
                : 'Salve referências, prints, links, imagens, vídeos e transforme inspirações em demandas reais.'}
            </p>
            {!q && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />Criar primeira pasta
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(b => (
              <BoardCard key={b.id} board={b} onOpen={() => onOpenBoard(b.id)} />
            ))}
          </div>
        )}
      </div>

      <CreateBoardDialog
        open={creating}
        onOpenChange={setCreating}
        folderId={folderId}
        onCreated={(id) => onOpenBoard(id)}
      />
    </div>
  );
};
