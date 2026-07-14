import React, { useState, useMemo, useCallback } from 'react';
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
import { TransitionBlockedModal } from './TransitionBlockedModal';
import { DestructiveActionGuard } from '@/components/governance/DestructiveActionGuard';
import { statusConfig } from './CardBadges';
import { Plus, Sparkles, AlertCircle, FileText, ListChecks, Link2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUpdateCard, useDeleteCard, useCreateCard } from '@/hooks/useCards';
import { useChecklists } from '@/hooks/useChecklists';
import { useCardDependencies } from '@/hooks/useDependencies';
import { useClients } from '@/hooks/useClients';
import { useClientCards } from '@/hooks/useClientCards';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useCardMemberAssignments } from '@/hooks/useCardMemberAssignments';
import { 
  useDefaultWorkflow, 
  useCompleteWorkflow, 
  validateTransition, 
  useTransitionCard,
  mapStatusToStage,
  mapStageToStatus,
  type TransitionValidationResult 
} from '@/hooks/useWorkflow';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import type { Assignee } from './CardAssignees';

interface KanbanBoardProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: CardStatus) => void;
  visibleStatuses?: CardStatus[];
  columnLabels?: Record<CardStatus, string>;
  /** When set, overrides the per-column sort and applies to every column */
  globalSortDirection?: 'asc' | 'desc' | null;
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

const defaultStatuses: CardStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'approved', 'delivered'];

// Card status indicators component
const CardBlockIndicators: React.FC<{ card: Card }> = ({ card }) => {
  const { data: checklists } = useChecklists(card.id);
  const { data: deps } = useCardDependencies(card.id);
  
  const checklistProgress = useMemo(() => {
    if (!checklists || checklists.length === 0) return 100;
    const completed = checklists.filter(c => c.is_completed).length;
    return Math.round((completed / checklists.length) * 100);
  }, [checklists]);
  
  const hasActiveDeps = useMemo(() => {
    if (!deps) return false;
    return deps.blocking.some((d: any) => 
      d.blocking_card?.status !== 'delivered'
    );
  }, [deps]);
  
  const indicators = [];
  
  // Only show briefing indicator for 'full' cards that don't have briefing completed
  // Quick cards (card_type === 'quick') never show briefing indicator
  const isQuickCard = (card as any).card_type === 'quick';
  
  if (!isQuickCard && !card.briefing_completed) {
    indicators.push(
      <Tooltip key="briefing">
        <TooltipTrigger asChild>
          <div className="p-1 rounded-full bg-amber-500/20">
            <FileText className="h-3 w-3 text-amber-600" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Briefing pendente</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  if (checklists && checklists.length > 0 && checklistProgress < 100) {
    indicators.push(
      <Tooltip key="checklist">
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/20">
            <ListChecks className="h-3 w-3 text-blue-600" />
            <span className="text-[10px] font-medium text-blue-600">{checklistProgress}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Checklist {checklistProgress}% completo</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  if (hasActiveDeps) {
    indicators.push(
      <Tooltip key="deps">
        <TooltipTrigger asChild>
          <div className="p-1 rounded-full bg-red-500/20">
            <Link2 className="h-3 w-3 text-red-600" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Bloqueado por dependência</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  if (indicators.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 mb-1">
      {indicators}
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  cards,
  onCardClick,
  onAddCard,
  visibleStatuses = defaultStatuses,
  columnLabels,
  globalSortDirection = null,
}) => {
  const { toast } = useToast();
  const { currentRole, currentWorkspace } = useWorkspace();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const createCard = useCreateCard(cards[0]?.display_space_id || cards[0]?.space_id);
  const transitionCard = useTransitionCard();
  
  // Clients data for displaying client info on cards
  const { data: legacyClients } = useClients();
  const { data: clientCards } = useClientCards();
  
  // Members data for displaying assignees on cards
  const { data: members } = useWorkspaceMembers();
  const { data: cardAssignments } = useCardMemberAssignments();

  const cardMembersMap = useMemo(() => {
    const map = new Map<string, string[]>();
    cardAssignments?.forEach(({ card_id, user_id }) => {
      if (!map.has(card_id)) map.set(card_id, []);
      map.get(card_id)!.push(user_id);
    });
    return map;
  }, [cardAssignments]);
  
  // Build a map of user_id -> assignee info for quick lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, Assignee>();
    members?.forEach(member => {
      if (member.profile) {
        map.set(member.user_id, {
          id: member.user_id,
          name: member.profile.full_name || member.profile.email,
          avatar_url: member.profile.avatar_url,
        });
      }
    });
    return map;
  }, [members]);
  
  // Build a map of client_id -> {name, color} for quick lookup
  const clientMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    
    // Add legacy clients
    legacyClients?.forEach(client => {
      map.set(client.id, { name: client.name, color: client.color });
    });
    
    // Add client cards (new system)
    clientCards?.forEach(client => {
      map.set(client.id, { name: client.name, color: client.color || null });
    });
    
    return map;
  }, [legacyClients, clientCards]);
  
  // Workflow data
  const { data: defaultWorkflow } = useDefaultWorkflow();
  const { stages, transitions } = useCompleteWorkflow(defaultWorkflow?.id);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  // Transition blocking modal state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    card: Card;
    fromStage: string;
    toStage: string;
    targetStatus: CardStatus;
    validation: TransitionValidationResult;
  } | null>(null);

  // Delete confirmation state (GOX)
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [sortDirections, setSortDirections] = useState<Record<CardStatus, 'asc' | 'desc'>>({
    backlog: 'asc',
    todo: 'asc',
    in_progress: 'asc',
    review: 'asc',
    approved: 'asc',
    delivered: 'asc',
    archived: 'asc',
    briefing: 'asc'
  });

  const toggleSortDirection = (status: CardStatus) => {
    setSortDirections(prev => ({
      ...prev,
      [status]: prev[status] === 'asc' ? 'desc' : 'asc'
    }));
  };
  const groupedCards = useMemo(() => {
    return visibleStatuses.reduce((acc, status) => {
      const statusCards = cards.filter(card => card.status === status);
      const direction = globalSortDirection ?? sortDirections[status] ?? 'asc';
      
      // Sort by due_date (earliest first), then by sort_order
      acc[status] = [...statusCards].sort((a, b) => {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : (direction === 'asc' ? Infinity : -1);
        const dateB = b.due_date ? new Date(b.due_date).getTime() : (direction === 'asc' ? Infinity : -1);
        
        let comparison = 0;
        if (dateA !== dateB) {
          comparison = dateA - dateB;
        } else {
          comparison = (a.sort_order || 0) - (b.sort_order || 0);
        }

        return direction === 'asc' ? comparison : -comparison;
      });
      
      return acc;
    }, {} as Record<CardStatus, Card[]>);
  }, [cards, visibleStatuses, sortDirections, globalSortDirection]);

  // Get active card for drag overlay
  const activeCard = useMemo(() => {
    if (!activeId) return null;
    return cards.find(c => c.id === activeId) || null;
  }, [activeId, cards]);

  // Validate and attempt transition
  const attemptTransition = useCallback(async (
    card: Card, 
    targetStatus: CardStatus,
    forceReason?: string
  ) => {
    // If no workflow configured, use legacy behavior
    if (!defaultWorkflow || stages.length === 0) {
      await updateCard.mutateAsync({ id: card.id, status: targetStatus });
      toast({
        title: 'Card movido',
        description: `Movido para ${statusConfig[targetStatus].label}`,
      });
      return;
    }

    const fromStage = mapStatusToStage(card.status);
    const toStage = mapStatusToStage(targetStatus);

    // No-op: avoid validating/recording a transition to the same stage
    if (fromStage === toStage) return;

    // Get card checklist progress
    const { data: checklists } = await (await import('@/integrations/supabase/client')).supabase
      .from('checklists')
      .select('is_completed')
      .eq('card_id', card.id);

    const checklistProgress = checklists && checklists.length > 0
      ? Math.round((checklists.filter(c => c.is_completed).length / checklists.length) * 100)
      : 100;

    // Get card dependencies
    const { data: deps } = await (await import('@/integrations/supabase/client')).supabase
      .from('dependencies')
      .select('*, blocking_card:cards!dependencies_blocking_card_id_fkey(status)')
      .eq('dependent_card_id', card.id);

    const hasActiveDependencies = deps?.some(d => 
      (d.blocking_card as any)?.status !== 'delivered'
    ) ?? false;

    // Validate transition
    const validation = await validateTransition({
      cardId: card.id,
      fromStage,
      toStage,
      workflowId: defaultWorkflow.id,
      stages,
      transitions,
      briefingCompleted: card.briefing_completed,
      checklistProgress,
      hasActiveDependencies,
      userRole: currentRole || 'member',
    });

    // If forcing with reason, proceed
    if (forceReason && !validation.allowed) {
      await transitionCard.mutateAsync({
        cardId: card.id,
        cardTitle: card.title,
        fromStage,
        toStage,
        workflowId: defaultWorkflow.id,
        transitionType: 'forced',
        reason: forceReason,
        gatesPassed: validation.gates.map(g => g.gate),
        gatesFailed: validation.failedGates.map(g => g.gate),
      });

      // Also update legacy status
      await updateCard.mutateAsync({ id: card.id, status: targetStatus });
      
      toast({
        title: 'Transição forçada',
        description: `Card movido para ${statusConfig[targetStatus].label}`,
        variant: 'default',
      });
      return;
    }

    // If not allowed, show modal and emit blocked event
    if (!validation.allowed) {
      setPendingTransition({
        card,
        fromStage,
        toStage,
        targetStatus,
        validation,
      });
      setBlockModalOpen(true);
      
      // Emit stage.transition_blocked event for EDA
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('workflow_events')
        .insert({
          workspace_id: card.workspace_id,
          event_type: 'stage.transition_blocked',
          entity_type: 'card',
          entity_id: card.id,
          payload: {
            from_stage: fromStage,
            to_stage: toStage,
            failed_gates: validation.failedGates.map(g => ({ gate: g.gate, message: g.message })),
          },
          triggered_by: null, // Will be captured from auth context
        });
      
      return;
    }

    // Transition allowed - proceed
    await transitionCard.mutateAsync({
      cardId: card.id,
      cardTitle: card.title,
      fromStage,
      toStage,
      workflowId: defaultWorkflow.id,
      transitionType: 'normal',
      gatesPassed: validation.gates.map(g => g.gate),
    });

    // Also update legacy status for compatibility
    await updateCard.mutateAsync({ id: card.id, status: targetStatus });
    
    toast({
      title: 'Card movido',
      description: `Movido para ${statusConfig[targetStatus].label}`,
    });
  }, [defaultWorkflow, stages, transitions, currentRole, transitionCard, updateCard, toast]);

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
      await attemptTransition(card, targetStatus);
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
      await attemptTransition(card, newStatus);
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleForceTransition = async (reason: string) => {
    if (!pendingTransition) return;
    
    try {
      await attemptTransition(pendingTransition.card, pendingTransition.targetStatus, reason);
    } catch (error) {
      toast({
        title: 'Erro ao forçar transição',
        description: 'Não foi possível completar a transição.',
        variant: 'destructive',
      });
    }
  };

  const handleFixGate = (gate: string) => {
    if (!pendingTransition) return;
    
    // Open card detail to fix the gate
    onCardClick(pendingTransition.card);
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

  const handleDuplicate = async (card: Card, targetSpaceId?: string) => {
    try {
      await createCard.mutateAsync({
        title: `${card.title} (cópia)`,
        space_id: card.space_id,
        description: card.description || undefined,
        status: 'backlog', // Always start duplicates in backlog
        urgency: card.urgency,
        due_date: card.due_date || undefined,
        client_id: card.client_id || undefined,
        duplicate_to_space_id: targetSpaceId,
      });
      toast({ title: targetSpaceId ? 'Card duplicado e espelhado' : 'Card duplicado' });
    } catch (error) {
      toast({
        title: 'Erro ao duplicar',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (card: Card) => {
    setDeleteTarget(card);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCard.mutateAsync(deleteTarget.id);
      toast({ title: 'Card arquivado' });
    } catch (error) {
      toast({
        title: 'Erro ao arquivar',
        variant: 'destructive',
      });
    }
  };

  // Check if user can force transitions
  const canForceTransition = currentRole === 'owner' || currentRole === 'admin';

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 h-full min-w-max pb-4">
          {visibleStatuses.map((status) => {
            const config = statusConfig[status];
            const columnCards = groupedCards[status] || [];
            const isDropTarget = overId === status;

            return (
              <div
                key={status}
                className={cn(
                  'flex-shrink-0 w-72 h-full bg-muted/30 rounded-xl flex flex-col border transition-all duration-200 overflow-hidden',
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
                        
                        status === 'todo' && 'bg-status-todo ring-status-todo/30',
                        status === 'in_progress' && 'bg-status-in-progress ring-status-in-progress/30',
                        status === 'review' && 'bg-status-review ring-status-review/30',
                        status === 'approved' && 'bg-status-approved ring-status-approved/30',
                        status === 'delivered' && 'bg-status-delivered ring-status-delivered/30',
                      )}
                    />
                    <span className="text-sm font-semibold">{columnLabels?.[status] || config.label}</span>
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-bold">
                      {columnCards.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => toggleSortDirection(status)}
                          >
                            {sortDirections[status] === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Ordenar por prazo ({sortDirections[status] === 'asc' ? 'Crescente' : 'Decrescente'})</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onAddCard(status)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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
                    columnCards.map((card) => {
                      const clientInfo = card.client_id ? clientMap.get(card.client_id) : undefined;
                      const assignedIds = cardMembersMap.get(card.id) || [];
                      const assignees: Assignee[] = assignedIds.length > 0
                        ? assignedIds.map(id => memberMap.get(id)).filter((m): m is Assignee => !!m)
                        : (card.owner_id && memberMap.has(card.owner_id) ? [memberMap.get(card.owner_id)!] : []);
                      return (
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
                              {/* Gate indicators above card */}
                              <CardBlockIndicators card={card} />
                              <TaskCard
                                card={card}
                                onClick={() => onCardClick(card)}
                                clientName={clientInfo?.name}
                                clientColor={clientInfo?.color || undefined}
                                assignees={assignees}
                                onStatusChange={(status) => handleStatusChange(card, status)}
                                onUrgencyChange={(urgency) => handleUrgencyChange(card, urgency)}
                                onDuplicate={() => handleDuplicate(card)}
                                onDelete={() => handleDelete(card)}
                              />
                            </div>
                          </CardContextMenu>
                        </DraggableCard>
                      );
                    })
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

      {/* Transition Blocked Modal */}
      <TransitionBlockedModal
        open={blockModalOpen}
        onOpenChange={setBlockModalOpen}
        fromStage={pendingTransition?.fromStage ?? ''}
        toStage={pendingTransition?.toStage ?? ''}
        validation={pendingTransition?.validation ?? null}
        onForceTransition={handleForceTransition}
        onFixGate={handleFixGate}
        canForce={canForceTransition}
      />

      {/* Delete Confirmation (GOX) */}
      <DestructiveActionGuard
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        entityType="card"
        entityId={deleteTarget?.id || ''}
        entityName={deleteTarget?.title || ''}
        createdBy={deleteTarget?.created_by}
        hasHistory={true}
        forceMode="archive"
        onConfirm={confirmDelete}
      />
    </>
  );
};
