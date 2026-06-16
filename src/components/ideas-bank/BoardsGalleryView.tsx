import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import { useIdeaCardLinksCount } from '@/hooks/useIdeaCardLinksCount';
import { BoardCard } from './BoardCard';
import { CreateBoardDialog } from './CreateBoardDialog';
import { HowItWorksDialog } from './HowItWorksDialog';
import { OnboardingChecklist } from './OnboardingChecklist';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Lightbulb, Sparkles, FolderPlus, HelpCircle } from 'lucide-react';

interface Props {
  folderId?: string | null;
  onOpenBoard: (boardId: string) => void;
}

const CHECKLIST_KEY = 'ideas-bank:checklist-dismissed';

export const BoardsGalleryView: React.FC<Props> = ({ folderId, onOpenBoard }) => {
  const { boards, isLoading } = useIdeaBoards({ folderId });
  const { data: cardLinksCount = 0 } = useIdeaCardLinksCount();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChecklistDismissed(localStorage.getItem(CHECKLIST_KEY) === '1');
  }, []);

  const dismissChecklist = () => {
    localStorage.setItem(CHECKLIST_KEY, '1');
    setChecklistDismissed(true);
  };

  // Keyboard shortcuts: "/" focuses search, "N" creates folder, "?" opens help
  const onKey = useCallback((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    else if (e.key.toLowerCase() === 'n') { e.preventDefault(); setCreating(true); }
    else if (e.key === '?') { e.preventDefault(); setHowOpen(true); }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

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
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="font-semibold text-lg">Banco de Ideias</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">· Central criativa</span>
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setHowOpen(true)}
              aria-label="Abrir guia: como funciona o Banco de Ideias"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              <span>Como funciona</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="ib-search" className="sr-only">Buscar pasta</label>
              <Input
                id="ib-search"
                ref={searchRef}
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar pasta..."
                className="pl-8 h-9"
              />
            </div>
            <Button onClick={() => setCreating(true)} size="sm" aria-keyshortcuts="N">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />Nova pasta
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Onboarding checklist */}
        {!checklistDismissed && !isLoading && (
          <OnboardingChecklist
            boards={boards}
            hasCreatedCard={cardLinksCount > 0}
            onCreateFolder={() => setCreating(true)}
            onOpenFirstBoard={() => boards[0] && onOpenBoard(boards[0].id)}
            onHowItWorks={() => setHowOpen(true)}
            onDismiss={dismissChecklist}
          />
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
              <Lightbulb className="h-8 w-8 text-primary" aria-hidden="true" />
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
                <FolderPlus className="h-4 w-4 mr-2" aria-hidden="true" />Criar primeira pasta
              </Button>
            )}
          </div>
        ) : (
          <ul
            role="list"
            aria-label="Pastas do Banco de Ideias"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 list-none p-0"
          >
            <li>
              <button
                onClick={() => setCreating(true)}
                aria-label="Criar nova pasta"
                className="group w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <div className="h-12 w-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium">Nova pasta</span>
              </button>
            </li>
            {filtered.map(b => (
              <li key={b.id}>
                <BoardCard board={b} onOpen={() => onOpenBoard(b.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateBoardDialog
        open={creating}
        onOpenChange={setCreating}
        folderId={folderId}
        onCreated={(id) => onOpenBoard(id)}
      />
      <HowItWorksDialog
        open={howOpen}
        onOpenChange={setHowOpen}
        onCreateFolder={() => setCreating(true)}
      />
    </div>
  );
};
