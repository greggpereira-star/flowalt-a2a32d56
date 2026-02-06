import React, { useState } from 'react';
import { KanbanBoard } from './KanbanBoard';
import { KanbanColumnsEditor } from './KanbanColumnsEditor';
import { useKanbanColumns } from '@/hooks/useKanbanColumns';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

interface KanbanWithColumnsProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: CardStatus) => void;
  viewId: string | null;
}

export const KanbanWithColumns: React.FC<KanbanWithColumnsProps> = ({
  cards,
  onCardClick,
  onAddCard,
  viewId,
}) => {
  const [editorOpen, setEditorOpen] = useState(false);
  
  const {
    columns,
    visibleStatuses,
    columnLabels,
    toggleVisibility,
    renameColumn,
    reorderColumns,
    resetToDefaults,
  } = useKanbanColumns(viewId);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar with Edit Columns button */}
      <div className="flex items-center justify-end px-4 py-2 border-b bg-muted/30">
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
        />
      </div>

      {/* Column Editor Sheet */}
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
