import React from 'react';
import { TaskCard } from './TaskCard';
import { CardContextMenu } from './CardContextMenu';
import { statusConfig } from './CardBadges';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUpdateCard, useDeleteCard, useCreateCard } from '@/hooks/useCards';
import { useToast } from '@/hooks/use-toast';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

interface KanbanBoardProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: CardStatus) => void;
  visibleStatuses?: CardStatus[];
}

const defaultStatuses: CardStatus[] = ['backlog', 'briefing', 'todo', 'in_progress', 'review', 'approved', 'delivered'];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  cards,
  onCardClick,
  onAddCard,
  visibleStatuses = defaultStatuses,
}) => {
  const { toast } = useToast();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const createCard = useCreateCard();

  const groupedCards = visibleStatuses.reduce((acc, status) => {
    acc[status] = cards.filter(card => card.status === status);
    return acc;
  }, {} as Record<CardStatus, Card[]>);

  const handleStatusChange = async (card: Card, newStatus: CardStatus) => {
    try {
      await updateCard.mutateAsync({ id: card.id, status: newStatus });
      toast({
        title: 'Status atualizado',
        description: `Card movido para ${statusConfig[newStatus].label}`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleUrgencyChange = async (card: Card, newUrgency: CardUrgency) => {
    try {
      await updateCard.mutateAsync({ id: card.id, urgency: newUrgency });
      toast({ title: 'Prioridade atualizada' });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (card: Card) => {
    try {
      await createCard.mutateAsync({
        title: `${card.title} (cópia)`,
        space_id: card.space_id,
        description: card.description || undefined,
        status: card.status,
        urgency: card.urgency,
        due_date: card.due_date || undefined,
        client_id: card.client_id || undefined,
      });
      toast({ title: 'Card duplicado' });
    } catch (error) {
      toast({
        title: 'Erro ao duplicar',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (card: Card) => {
    try {
      await deleteCard.mutateAsync(card.id);
      toast({ title: 'Card arquivado' });
    } catch (error) {
      toast({
        title: 'Erro ao arquivar',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {visibleStatuses.map((status) => {
        const config = statusConfig[status];
        const columnCards = groupedCards[status] || [];

        return (
          <div
            key={status}
            className="flex-shrink-0 w-72 bg-muted/30 rounded-lg"
          >
            {/* Column Header */}
            <div className="p-3 flex items-center justify-between sticky top-0 bg-muted/50 backdrop-blur-sm rounded-t-lg border-b border-border/50">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    status === 'backlog' && 'bg-status-backlog',
                    status === 'briefing' && 'bg-status-briefing',
                    status === 'todo' && 'bg-status-todo',
                    status === 'in_progress' && 'bg-status-in-progress',
                    status === 'review' && 'bg-status-review',
                    status === 'approved' && 'bg-status-approved',
                    status === 'delivered' && 'bg-status-delivered',
                  )}
                />
                <span className="text-sm font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {columnCards.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onAddCard(status)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Column Cards */}
            <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
              {columnCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum card
                  </p>
                </div>
              ) : (
                columnCards.map((card) => (
                  <CardContextMenu
                    key={card.id}
                    card={card}
                    onStatusChange={(status) => handleStatusChange(card, status)}
                    onUrgencyChange={(urgency) => handleUrgencyChange(card, urgency)}
                    onDuplicate={() => handleDuplicate(card)}
                    onDelete={() => handleDelete(card)}
                  >
                    <div>
                      <TaskCard
                        card={card}
                        onClick={() => onCardClick(card)}
                      />
                    </div>
                  </CardContextMenu>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
