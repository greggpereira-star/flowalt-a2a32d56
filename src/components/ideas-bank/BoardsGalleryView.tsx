import { useState, useMemo, useEffect } from 'react';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import { BoardCard } from './BoardCard';
import { CreateBoardDialog } from './CreateBoardDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Search, Lightbulb, Sparkles, FolderPlus, ImagePlus,
  MessageSquarePlus, X, HelpCircle,
} from 'lucide-react';

interface Props {
  folderId?: string | null;
  onOpenBoard: (boardId: string) => void;
}

const HOWTO_KEY = 'ideas-bank:howto-dismissed';

export const BoardsGalleryView: React.FC<Props> = ({ folderId, onOpenBoard }) => {
  const { boards, isLoading } = useIdeaBoards({ folderId });
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    setShowHowTo(localStorage.getItem(HOWTO_KEY) !== '1');
  }, []);

  const dismissHowTo = () => {
    localStorage.setItem(HOWTO_KEY, '1');
    setShowHowTo(false);
  };

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

  const steps = [
    { icon: FolderPlus, title: '1. Crie uma pasta', desc: 'Organize por cliente, campanha ou tema.' },
    { icon: ImagePlus, title: '2. Adicione referências', desc: 'Imagens, vídeos, links, PDFs ou notas.' },
    { icon: MessageSquarePlus, title: '3. Vire demanda', desc: 'Transforme uma ideia em card com 1 clique.' },
  ];

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
            {!showHowTo && (
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setShowHowTo(true)}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />Como funciona
              </Button>
            )}
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

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* How it works banner */}
        {showHowTo && (
          <div className="relative rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-5">
            <button
              onClick={dismissHowTo}
              className="absolute top-2 right-2 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Como usar o Banco de Ideias</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.map(s => {
                const I = s.icon;
                return (
                  <div key={s.title} className="flex items-start gap-3 rounded-xl bg-background/60 border p-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <I className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lightbulb className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-1">
              {q ? 'Nenhuma pasta encontrada' : 'Crie sua primeira pasta de ideias'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-5">
              {q
                ? 'Tente outro termo de busca.'
                : 'Pastas agrupam referências por cliente, campanha ou tema. Comece com uma — você adiciona referências dentro dela.'}
            </p>
            {!q && (
              <Button onClick={() => setCreating(true)} size="lg">
                <FolderPlus className="h-4 w-4 mr-2" />Criar primeira pasta
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {/* "New folder" tile as first action */}
            <button
              onClick={() => setCreating(true)}
              className="group aspect-[4/3] rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
            >
              <div className="h-12 w-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <Plus className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">Nova pasta</span>
            </button>
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
