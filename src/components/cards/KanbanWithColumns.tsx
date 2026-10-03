import { cn } from '@/lib/utils';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KanbanBoard } from './KanbanBoard';
import { KanbanColumnsEditor } from './KanbanColumnsEditor';
import { useKanbanColumns } from '@/hooks/useKanbanColumns';
import { Button } from '@/components/ui/button';
import { Settings2, ArrowUpNarrowWide, ArrowDownWideNarrow, ListOrdered, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

interface KanbanWithColumnsProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: CardStatus) => void;
  viewId: string | null;
}

type GlobalSort = 'manual' | 'asc' | 'desc';

export const KanbanWithColumns: React.FC<KanbanWithColumnsProps> = ({
  cards,
  onCardClick,
  onAddCard,
  viewId,
}) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [globalSort, setGlobalSort] = useState<GlobalSort>('manual');

  // Rolagem horizontal: saber se ha colunas escondidas de cada lado.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bordas, setBordas] = useState({ esquerda: false, direita: false });
  const { respiro } = useNewUiBeta();

  const atualizarBordas = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setBordas({
      esquerda: el.scrollLeft > 4,
      direita: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  const rolar = (direcao: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direcao * Math.max(300, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const {
    columns,
    visibleStatuses,
    columnLabels,
    renameColumn,
    toggleVisibility,
    reorderColumns,
    resetToDefaults,
  } = useKanbanColumns(viewId);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    atualizarBordas();
    el.addEventListener('scroll', atualizarBordas, { passive: true });

    // Colunas ocultadas/mostradas ou janela redimensionada mudam a largura do conteudo
    // sem disparar 'scroll', entao observa o contêiner e o quadro dentro dele.
    const observador = new ResizeObserver(atualizarBordas);
    observador.observe(el);
    if (el.firstElementChild) observador.observe(el.firstElementChild);

    return () => {
      el.removeEventListener('scroll', atualizarBordas);
      observador.disconnect();
    };
  }, [atualizarBordas, visibleStatuses.length]);

  const cycleSort = () => {
    setGlobalSort(prev => prev === 'manual' ? 'asc' : prev === 'asc' ? 'desc' : 'manual');
  };

  const sortIcon = globalSort === 'asc'
    ? <ArrowUpNarrowWide className="h-4 w-4" />
    : globalSort === 'desc'
      ? <ArrowDownWideNarrow className="h-4 w-4" />
      : <ListOrdered className="h-4 w-4" />;

  const sortLabel = globalSort === 'asc'
    ? 'Prazo: mais próximo primeiro'
    : globalSort === 'desc'
      ? 'Prazo: mais distante primeiro'
      : 'Ordenação manual (por coluna)';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className={cn('flex items-center justify-end gap-2 border-b flex-wrap', respiro ? 'border-border/60 bg-transparent px-6 py-3' : 'bg-muted/30 px-4 py-2')}>
        {(bordas.esquerda || bordas.direita) && (
          <div className="mr-auto flex items-center gap-1" role="group" aria-label="Navegar pelas colunas">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!bordas.esquerda}
              onClick={() => rolar(-1)}
              aria-label="Ver colunas anteriores"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!bordas.direita}
              onClick={() => rolar(1)}
              aria-label="Ver mais colunas"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {bordas.direita && (
              <span className="ml-1 hidden text-xs text-muted-foreground md:inline">
                Há mais colunas ao lado
              </span>
            )}
          </div>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={globalSort === 'manual' ? 'outline' : 'default'}
                size="sm"
                onClick={cycleSort}
                className="gap-2"
              >
                {sortIcon}
                {globalSort === 'manual' ? 'Ordenar por prazo' : sortLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Clique para alternar: Manual → Crescente → Decrescente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditorOpen(true)}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Editar Colunas
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className={cn('kanban-scroll h-full overflow-x-auto overflow-y-hidden', respiro ? 'px-6 py-5' : 'p-4')}>
          <KanbanBoard
            cards={cards}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
            visibleStatuses={visibleStatuses}
            columnLabels={columnLabels}
            globalSortDirection={globalSort === 'manual' ? null : globalSort}
          />
        </div>

        {/* Esmaecido nas bordas: indica que ha colunas escondidas. pointer-events-none para
            nao atrapalhar clique nem o arrastar de cards. */}
        {bordas.esquerda && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-[14px] w-10 bg-gradient-to-r from-background to-transparent"
          />
        )}
        {bordas.direita && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 bottom-[14px] w-10 bg-gradient-to-l from-background to-transparent"
          />
        )}
      </div>

      <KanbanColumnsEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        columns={columns.map(c => ({ ...c, label: columnLabels[c.id] ?? c.label }))}
        onToggleVisibility={toggleVisibility}
        onRename={renameColumn}
        onReorder={reorderColumns}
        onReset={resetToDefaults}
      />
    </div>
  );
};
