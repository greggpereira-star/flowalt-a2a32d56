import React, { useState } from 'react';
import { KanbanBoard } from './KanbanBoard';
import { KanbanColumnsEditor } from './KanbanColumnsEditor';
import { useKanbanColumns } from '@/hooks/useKanbanColumns';
import { Button } from '@/components/ui/button';
import { Settings2, ArrowUpNarrowWide, ArrowDownWideNarrow, ListOrdered } from 'lucide-react';
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

  const {
    columns,
    visibleStatuses,
    columnLabels,
    toggleVisibility,
    renameColumn,
    reorderColumns,
    resetToDefaults,
  } = useKanbanColumns(viewId);

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
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/30">
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
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <KanbanBoard
          cards={cards}
          onCardClick={onCardClick}
          onAddCard={onAddCard}
          visibleStatuses={visibleStatuses}
          columnLabels={columnLabels}
          globalSortDirection={globalSort === 'manual' ? null : globalSort}
        />
      </div>

      <KanbanColumnsEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        columns={columns}
        onToggleVisibility={toggleVisibility}
        onRename={renameColumn}
        onReorder={reorderColumns}
        onReset={resetToDefaults}
      />
    </div>
  );
};
