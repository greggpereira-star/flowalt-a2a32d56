import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  rectIntersection,
  useDroppable,
} from '@dnd-kit/core';
import { TaskCard } from './TaskCard';
import { DraggableCard } from './DraggableCard';
import { DragOverlayCard } from './DragOverlayCard';
import { CardContextMenu } from './CardContextMenu';
import { statusConfig } from './CardBadges';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Droppable column component
const DroppableColumn: React.FC<{ 
  id: string; 
  children: React.ReactNode;
  isOver: boolean;
}> = ({ id, children, isOver }) => {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 p-2 space-y-2 min-h-[100px] transition-colors duration-200 rounded-b-lg overflow-y-auto',
        isOver && 'bg-primary/10 ring-2 ring-inset ring-primary/30'
      )}
    >
      {children}
    </div>
  );
};

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

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const groupedCards = visibleStatuses.reduce((acc, status) => {
    acc[status] = cards.filter(card => card.status === status);
    return acc;
  }, {} as Record<CardStatus, Card[]>);

  // Get active card for drag overlay
  const activeCard = useMemo(() => {
    if (!activeId) return null;
    return cards.find(c => c.id === activeId) || null;
  }, [activeId, cards]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const cardId = active.id as string;
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Determine target status
    const targetId = over.id as string;
    let targetStatus: CardStatus | null = null;

    // Check if dropped on a column
    if (visibleStatuses.includes(targetId as CardStatus)) {
      targetStatus = targetId as CardStatus;
    } else {
      // Check if dropped on another card
      const targetCard = cards.find(c => c.id === targetId);
      if (targetCard) {
        targetStatus = targetCard.status;
      }
    }

    if (!targetStatus || targetStatus === card.status) return;

    try {
      await updateCard.mutateAsync({ id: card.id, status: targetStatus });
      toast({
        title: 'Card movido',
        description: `Movido para ${statusConfig[targetStatus].label}`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao mover',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

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
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 h-full min-w-max">
        {visibleStatuses.map((status) => {
          const config = statusConfig[status];
          const columnCards = groupedCards[status] || [];
          const isDropTarget = overId === status;

          return (
            <div
              key={status}
              className={cn(
                'flex-shrink-0 w-72 bg-muted/30 rounded-xl flex flex-col border transition-all duration-200 max-h-full',
                isDropTarget 
                  ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10' 
                  : 'border-border/30'
              )}
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-md rounded-t-xl border-b border-border/30 z-10">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background',
                      status === 'backlog' && 'bg-status-backlog ring-status-backlog/30',
                      status === 'briefing' && 'bg-status-briefing ring-status-briefing/30',
                      status === 'todo' && 'bg-status-todo ring-status-todo/30',
                      status === 'in_progress' && 'bg-status-in-progress ring-status-in-progress/30',
                      status === 'review' && 'bg-status-review ring-status-review/30',
                      status === 'approved' && 'bg-status-approved ring-status-approved/30',
                      status === 'delivered' && 'bg-status-delivered ring-status-delivered/30',
                    )}
                  />
                  <span className="text-sm font-semibold">{config.label}</span>
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-bold">
                    {columnCards.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onAddCard(status)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Cards - Droppable Area */}
              <DroppableColumn id={status} isOver={isDropTarget}>
                {columnCards.length === 0 ? (
                  <div 
                    className={cn(
                      'flex flex-col items-center justify-center py-8 text-center transition-colors rounded-lg',
                      isDropTarget && 'bg-primary/10 border-2 border-dashed border-primary/30'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isDropTarget ? 'Solte aqui' : 'Nenhum card'}
                    </p>
                  </div>
                ) : (
                  columnCards.map((card) => (
                    <DraggableCard key={card.id} id={card.id}>
                      <CardContextMenu
                        card={card}
                        onStatusChange={(status) => handleStatusChange(card, status)}
                        onUrgencyChange={(urgency) => handleUrgencyChange(card, urgency)}
                        onDuplicate={() => handleDuplicate(card)}
                        onDelete={() => handleDelete(card)}
                      >
                        <div className={cn(
                          'transition-all',
                          activeId === card.id && 'opacity-50 scale-95'
                        )}>
                          <TaskCard
                            card={card}
                            onClick={() => onCardClick(card)}
                          />
                        </div>
                      </CardContextMenu>
                    </DraggableCard>
                  ))
                )}
              </DroppableColumn>
            </div>
          );
        })}
      </div>

      {/* Drag Overlay with 3D effect */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeCard && <DragOverlayCard card={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
};
