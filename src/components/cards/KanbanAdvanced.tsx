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
import { KanbanQuickFilters, applyQuickFilter } from './KanbanQuickFilters';
import { KanbanColumnMetrics } from './KanbanColumnMetrics';
import { KanbanInlineQuickAdd } from './KanbanInlineQuickAdd';

// Droppable column area component
const DroppableColumnArea: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({ id, children, className }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'bg-primary/5 ring-2 ring-inset ring-primary/30' : ''}`}
    >
      {children}
    </div>
  );
};
import { 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  CheckSquare,
  AlertTriangle,
  Lock,
  Layers,
  User,
  Tag,
  Save,
  X,
  Sparkles,
  MoreHorizontal,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, getErrorMessage } from '@/lib/utils';
import { useUpdateCard, useDeleteCard, useCreateCard } from '@/hooks/useCards';
import { useDependencies } from '@/hooks/useDependencies';
import { useCapacity } from '@/hooks/useCapacity';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/hooks/use-toast';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { isPast, isToday } from 'date-fns';

interface KanbanAdvancedProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  onAddCard: (status: CardStatus) => void;
  onQuickAdd?: (data: QuickAddData) => void;
  visibleStatuses?: CardStatus[];
  spaceId?: string;
}

interface QuickAddData {
  title: string;
  status: CardStatus;
  urgency?: CardUrgency;
  due_date?: string;
  owner_id?: string;
}

type SwimlaneOption = 'none' | 'owner' | 'urgency' | 'client';

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
}

interface FilterState {
  urgency: CardUrgency[];
  owners: string[];
  clients: string[];
  tags: string[];
  hasDeadline: boolean | null;
  isOverdue: boolean | null;
  hasBriefing: boolean | null;
  searchQuery: string;
}

const defaultStatuses: CardStatus[] = ['backlog', 'briefing', 'todo', 'in_progress', 'review', 'approved', 'delivered'];

const URGENCY_OPTIONS: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'bg-slate-500' },
  { value: 'medium', label: 'Média', color: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'bg-red-500' },
];

export const KanbanAdvanced: React.FC<KanbanAdvancedProps> = ({
  cards,
  onCardClick,
  onAddCard,
  onQuickAdd,
  visibleStatuses = defaultStatuses,
  spaceId,
}) => {
  const { toast } = useToast();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const createCard = useCreateCard();
  const { data: members } = useWorkspaceMembers();
  const { data: clients } = useClients();
  const { data: dependencies } = useDependencies();
  const { userSummaries } = useCapacity(cards);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // View state
  const [swimlane, setSwimlane] = useState<SwimlaneOption>('none');
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  
  // Selection state
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    urgency: [],
    owners: [],
    clients: [],
    tags: [],
    hasDeadline: null,
    isOverdue: null,
    hasBriefing: null,
    searchQuery: '',
  });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  // Quick add state per column
  const [quickAddColumn, setQuickAddColumn] = useState<CardStatus | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Calculate blocked cards
  const blockedCardIds = useMemo(() => {
    if (!dependencies) return new Set<string>();
    
    const blocked = new Set<string>();
    dependencies.forEach(dep => {
      if (dep.dependent_card_id) {
        const blockingCard = cards.find(c => c.id === dep.blocking_card_id);
        if (blockingCard && blockingCard.status !== 'delivered') {
          blocked.add(dep.dependent_card_id);
        }
      }
    });
    return blocked;
  }, [dependencies, cards]);

  // Filter cards
  const filteredCards = useMemo(() => {
    let result = cards.filter(card => {
      if (filters.searchQuery && !card.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      if (filters.urgency.length > 0 && !filters.urgency.includes(card.urgency)) {
        return false;
      }
      if (filters.owners.length > 0 && !filters.owners.includes(card.owner_id || '')) {
        return false;
      }
      if (filters.clients.length > 0 && !filters.clients.includes(card.client_id || '')) {
        return false;
      }
      if (filters.hasDeadline === true && !card.due_date) {
        return false;
      }
      if (filters.hasDeadline === false && card.due_date) {
        return false;
      }
      if (filters.isOverdue === true) {
        const dueDate = card.due_date ? new Date(card.due_date) : null;
        if (!dueDate || !isPast(dueDate) || isToday(dueDate) || card.status === 'delivered') {
          return false;
        }
      }
      if (filters.hasBriefing === true && !card.briefing_completed) {
        return false;
      }
      if (filters.hasBriefing === false && card.briefing_completed) {
        return false;
      }
      return true;
    });

    result = applyQuickFilter(result, quickFilter, blockedCardIds);
    return result;
  }, [cards, filters, quickFilter, blockedCardIds]);

  // Group cards by status
  const groupedByStatus = useMemo(() => {
    return visibleStatuses.reduce((acc, status) => {
      acc[status] = filteredCards.filter(card => card.status === status);
      return acc;
    }, {} as Record<CardStatus, Card[]>);
  }, [filteredCards, visibleStatuses]);

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
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const cardId = active.id as string;
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Determine target status from over id
    const overId = over.id as string;
    let targetStatus: CardStatus | null = null;

    // Check if dropped on a column
    if (visibleStatuses.includes(overId as CardStatus)) {
      targetStatus = overId as CardStatus;
    } else {
      // Check if dropped on another card - get that card's status
      const targetCard = cards.find(c => c.id === overId);
      if (targetCard) {
        targetStatus = targetCard.status;
      }
    }

    if (!targetStatus || targetStatus === card.status) return;

    // Validate status change
    if (!card.briefing_completed && 
        ['todo', 'in_progress', 'review', 'approved', 'delivered'].includes(targetStatus) &&
        ['backlog', 'briefing'].includes(card.status)) {
      toast({
        title: 'Briefing Pendente',
        description: 'Complete o briefing antes de avançar o card.',
        variant: 'destructive',
      });
      return;
    }

    if (blockedCardIds.has(card.id) && ['in_progress', 'review', 'approved', 'delivered'].includes(targetStatus)) {
      toast({
        title: 'Card Bloqueado',
        description: 'Resolva as dependências antes de avançar.',
        variant: 'destructive',
      });
      return;
    }

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

  // Card actions
  const handleStatusChange = async (card: Card, newStatus: CardStatus) => {
    if (!card.briefing_completed && 
        ['todo', 'in_progress', 'review', 'approved', 'delivered'].includes(newStatus) &&
        ['backlog', 'briefing'].includes(card.status)) {
      toast({
        title: 'Briefing Pendente',
        description: 'Complete o briefing antes de avançar o card.',
        variant: 'destructive',
      });
      return;
    }

    if (blockedCardIds.has(card.id) && ['in_progress', 'review', 'approved', 'delivered'].includes(newStatus)) {
      toast({
        title: 'Card Bloqueado',
        description: 'Resolva as dependências antes de avançar.',
        variant: 'destructive',
      });
      return;
    }

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
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
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
      toast({ title: 'Erro ao duplicar', variant: 'destructive' });
    }
  };

  const handleDelete = async (card: Card) => {
    try {
      await deleteCard.mutateAsync(card.id);
      toast({ title: 'Card arquivado' });
    } catch (error) {
      toast({ title: 'Erro ao arquivar', variant: 'destructive' });
    }
  };

  const handleInlineQuickAdd = async (data: QuickAddData) => {
    try {
      if (onQuickAdd) {
        onQuickAdd(data);
      } else if (spaceId) {
        await createCard.mutateAsync({
          title: data.title,
          space_id: spaceId,
          status: data.status,
          urgency: data.urgency || 'medium',
          due_date: data.due_date,
        });
      }
      setQuickAddColumn(null);
      toast({ title: 'Card criado' });
    } catch (error) {
      toast({
        title: 'Erro ao criar card',
        description: getErrorMessage(error, 'Não foi possível criar o card.'),
        variant: 'destructive',
      });
    }
  };

  // Selection handlers
  const toggleCardSelection = (cardId: string) => {
    const newSelection = new Set(selectedCards);
    if (newSelection.has(cardId)) {
      newSelection.delete(cardId);
    } else {
      newSelection.add(cardId);
    }
    setSelectedCards(newSelection);
  };

  const selectAllInColumn = (status: CardStatus) => {
    const columnCards = groupedByStatus[status] || [];
    const newSelection = new Set(selectedCards);
    columnCards.forEach(card => newSelection.add(card.id));
    setSelectedCards(newSelection);
  };

  const clearSelection = () => {
    setSelectedCards(new Set());
    setIsSelectionMode(false);
  };

  // Mass actions
  const handleMassStatusChange = async (newStatus: CardStatus) => {
    const cardsToUpdate = cards.filter(c => selectedCards.has(c.id));
    try {
      await Promise.all(cardsToUpdate.map(card => updateCard.mutateAsync({ id: card.id, status: newStatus })));
      toast({ title: `${cardsToUpdate.length} cards atualizados` });
      clearSelection();
    } catch (error) {
      toast({ title: 'Erro ao atualizar cards', variant: 'destructive' });
    }
  };

  const handleMassUrgencyChange = async (newUrgency: CardUrgency) => {
    const cardsToUpdate = cards.filter(c => selectedCards.has(c.id));
    try {
      await Promise.all(cardsToUpdate.map(card => updateCard.mutateAsync({ id: card.id, urgency: newUrgency })));
      toast({ title: `${cardsToUpdate.length} cards atualizados` });
      clearSelection();
    } catch (error) {
      toast({ title: 'Erro ao atualizar cards', variant: 'destructive' });
    }
  };

  const handleMassOwnerChange = async (ownerId: string) => {
    const cardsToUpdate = cards.filter(c => selectedCards.has(c.id));
    try {
      await Promise.all(cardsToUpdate.map(card => updateCard.mutateAsync({ id: card.id, owner_id: ownerId })));
      toast({ title: `${cardsToUpdate.length} cards atualizados` });
      clearSelection();
    } catch (error) {
      toast({ title: 'Erro ao atualizar cards', variant: 'destructive' });
    }
  };

  // Filter functions
  const saveCurrentFilter = () => {
    if (!newFilterName.trim()) return;
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName,
      filters: { ...filters },
    };
    setSavedFilters([...savedFilters, newFilter]);
    setNewFilterName('');
    setFilterDialogOpen(false);
    toast({ title: 'Filtro salvo' });
  };

  const loadFilter = (filter: SavedFilter) => {
    setFilters(filter.filters);
  };

  const clearFilters = () => {
    setFilters({
      urgency: [],
      owners: [],
      clients: [],
      tags: [],
      hasDeadline: null,
      isOverdue: null,
      hasBriefing: null,
      searchQuery: '',
    });
    setQuickFilter(null);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.urgency.length > 0) count++;
    if (filters.owners.length > 0) count++;
    if (filters.clients.length > 0) count++;
    if (filters.hasDeadline !== null) count++;
    if (filters.isOverdue !== null) count++;
    if (filters.hasBriefing !== null) count++;
    if (filters.searchQuery) count++;
    return count;
  }, [filters]);

  // Get swimlane label
  const getSwimlaneLabel = (key: string): string => {
    switch (swimlane) {
      case 'owner':
        if (key === 'unassigned') return 'Sem Responsável';
        const member = members?.find(m => m.user_id === key);
        return member?.profile?.full_name || member?.profile?.email || key;
      case 'urgency':
        return URGENCY_OPTIONS.find(u => u.value === key)?.label || key;
      case 'client':
        if (key === 'no-client') return 'Sem Cliente';
        const client = clients?.find(c => c.id === key);
        return client?.name || key;
      default:
        return key;
    }
  };

  const toggleSwimlane = (key: string) => {
    const newCollapsed = new Set(collapsedSwimlanes);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSwimlanes(newCollapsed);
  };

  // Get swimlane groups
  const swimlaneGroups = useMemo(() => {
    if (swimlane === 'none') return null;
    const groups: Record<string, Card[]> = {};
    filteredCards.forEach(card => {
      let key = '';
      switch (swimlane) {
        case 'owner': key = card.owner_id || 'unassigned'; break;
        case 'urgency': key = card.urgency; break;
        case 'client': key = card.client_id || 'no-client'; break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });
    return groups;
  }, [filteredCards, swimlane]);

  // Render card
  const renderCard = (card: Card) => {
    const isBlocked = blockedCardIds.has(card.id);
    const ownerUtilization = card.owner_id 
      ? userSummaries.find(u => u.userId === card.owner_id)?.utilizationPercent || 0
      : 0;
    
    return (
      <DraggableCard key={card.id} id={card.id} disabled={isSelectionMode}>
        <div className="relative group">
          {isSelectionMode && (
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={selectedCards.has(card.id)}
                onCheckedChange={() => toggleCardSelection(card.id)}
                className="bg-background shadow-sm"
              />
            </div>
          )}
          
          <CardContextMenu
            card={card}
            onStatusChange={(status) => handleStatusChange(card, status)}
            onUrgencyChange={(urgency) => handleUrgencyChange(card, urgency)}
            onDuplicate={() => handleDuplicate(card)}
            onDelete={() => handleDelete(card)}
          >
            <div className={cn(
              'transition-all',
              isSelectionMode && selectedCards.has(card.id) && 'ring-2 ring-primary rounded-lg',
              isBlocked && 'opacity-75',
              activeId === card.id && 'opacity-50 scale-95'
            )}>
              <TaskCard
                card={card}
                onClick={() => isSelectionMode ? toggleCardSelection(card.id) : onCardClick(card)}
                isBlocked={isBlocked}
                ownerUtilization={ownerUtilization}
              />
            </div>
          </CardContextMenu>
        </div>
      </DraggableCard>
    );
  };

  // Render column
  const renderColumn = (status: CardStatus, columnCards: Card[]) => {
    const config = statusConfig[status];
    const isQuickAddOpen = quickAddColumn === status;
    const isDropTarget = overId === status;
    
    return (
      <div
        key={status}
        id={status}
        className={cn(
          'flex-shrink-0 w-72 bg-muted/30 rounded-xl flex flex-col border transition-all duration-200',
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
          
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setQuickAddColumn(status)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Adicionar card</TooltipContent>
            </Tooltip>
            
            {isSelectionMode && columnCards.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => selectAllInColumn(status)}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Selecionar todos</TooltipContent>
              </Tooltip>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAddCard(status)}>
                  Adicionar card completo
                </DropdownMenuItem>
                {columnCards.length > 0 && (
                  <DropdownMenuItem onClick={() => selectAllInColumn(status)}>
                    Selecionar todos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Column Metrics */}
        {columnCards.length > 0 && (
          <div className="px-3 py-1.5 border-b border-border/20 bg-muted/30">
            <KanbanColumnMetrics cards={columnCards} />
          </div>
        )}

        {/* Column Cards */}
        <DroppableColumnArea id={status} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
          {/* Inline Quick Add */}
          <KanbanInlineQuickAdd
            status={status}
            isOpen={isQuickAddOpen}
            onOpenChange={(open) => setQuickAddColumn(open ? status : null)}
            onCreate={handleInlineQuickAdd}
            members={members}
            isLoading={createCard.isPending}
          />

          {/* Cards */}
          {columnCards.length === 0 && !isQuickAddOpen ? (
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
            columnCards.map(renderCard)
          )}
        </DroppableColumnArea>
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Compact Toolbar */}
        <div className="flex-shrink-0 pb-3 space-y-2">
          {/* Controls Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <Input
              placeholder="Buscar..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-40 h-8 text-sm"
            />

            {/* Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel className="text-xs">Filtrar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                    Urgência
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {URGENCY_OPTIONS.map(opt => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={filters.urgency.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          setFilters({
                            ...filters,
                            urgency: checked
                              ? [...filters.urgency, opt.value]
                              : filters.urgency.filter(u => u !== opt.value)
                          });
                        }}
                        className="text-xs"
                      >
                        <div className={cn('w-2 h-2 rounded-full mr-2', opt.color)} />
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    <User className="h-3.5 w-3.5 mr-2" />
                    Responsável
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {members?.map(member => (
                      <DropdownMenuCheckboxItem
                        key={member.user_id}
                        checked={filters.owners.includes(member.user_id)}
                        onCheckedChange={(checked) => {
                          setFilters({
                            ...filters,
                            owners: checked
                              ? [...filters.owners, member.user_id]
                              : filters.owners.filter(o => o !== member.user_id)
                          });
                        }}
                        className="text-xs"
                      >
                        {member.profile?.full_name || member.profile?.email}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs">
                    <Tag className="h-3.5 w-3.5 mr-2" />
                    Cliente
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {clients?.map(client => (
                      <DropdownMenuCheckboxItem
                        key={client.id}
                        checked={filters.clients.includes(client.id)}
                        onCheckedChange={(checked) => {
                          setFilters({
                            ...filters,
                            clients: checked
                              ? [...filters.clients, client.id]
                              : filters.clients.filter(c => c !== client.id)
                          });
                        }}
                        className="text-xs"
                      >
                        {client.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {savedFilters.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs">Filtros Salvos</DropdownMenuLabel>
                    {savedFilters.map(f => (
                      <DropdownMenuItem key={f.id} onClick={() => loadFilter(f)} className="text-xs">
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onClick={() => setFilterDialogOpen(true)} className="text-xs">
                  <Save className="h-3.5 w-3.5 mr-2" />
                  Salvar Filtro
                </DropdownMenuItem>
                
                {(activeFiltersCount > 0 || quickFilter) && (
                  <DropdownMenuItem onClick={clearFilters} className="text-xs text-destructive">
                    <X className="h-3.5 w-3.5 mr-2" />
                    Limpar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Swimlanes */}
            <Select value={swimlane} onValueChange={(v: SwimlaneOption) => setSwimlane(v)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Sem agrupar</SelectItem>
                <SelectItem value="owner" className="text-xs">Responsável</SelectItem>
                <SelectItem value="urgency" className="text-xs">Urgência</SelectItem>
                <SelectItem value="client" className="text-xs">Cliente</SelectItem>
              </SelectContent>
            </Select>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Selection Mode */}
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) clearSelection();
              }}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {isSelectionMode ? `${selectedCards.size}` : 'Selecionar'}
            </Button>

            {selectedCards.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 gap-1.5 text-xs">
                    Ações
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Status</DropdownMenuLabel>
                  {visibleStatuses.map(status => (
                    <DropdownMenuItem key={status} onClick={() => handleMassStatusChange(status)} className="text-xs">
                      {statusConfig[status].label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Urgência</DropdownMenuLabel>
                  {URGENCY_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.value} onClick={() => handleMassUrgencyChange(opt.value)} className="text-xs">
                      <div className={cn('w-2 h-2 rounded-full mr-2', opt.color)} />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Responsável</DropdownMenuLabel>
                  {members?.slice(0, 5).map(member => (
                    <DropdownMenuItem key={member.user_id} onClick={() => handleMassOwnerChange(member.user_id)} className="text-xs">
                      {member.profile?.full_name || member.profile?.email}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Quick Filters */}
          <KanbanQuickFilters
            cards={cards}
            activeFilter={quickFilter}
            onFilterChange={setQuickFilter}
            blockedCardIds={blockedCardIds}
          />
        </div>

        {/* Kanban Board - scrollable area */}
        <div className="flex-1 overflow-auto min-h-0">
          {swimlane === 'none' ? (
            <div className="flex gap-3 h-full min-h-full pb-4 pr-4">
              {visibleStatuses.map((status) => renderColumn(status, groupedByStatus[status] || []))}
            </div>
          ) : (
            <div className="space-y-3 min-w-max">
              {Object.entries(swimlaneGroups || {}).map(([key, swimlaneCards]) => (
                <div key={key} className="border rounded-xl bg-card/50">
                  <div
                    className="p-2.5 flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl"
                    onClick={() => toggleSwimlane(key)}
                  >
                    {collapsedSwimlanes.has(key) ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">{getSwimlaneLabel(key)}</span>
                    <Badge variant="secondary" className="text-xs">{swimlaneCards.length}</Badge>
                  </div>

                  {!collapsedSwimlanes.has(key) && (
                    <div className="p-3 overflow-x-auto border-t border-border/30">
                      <div className="flex gap-3">
                        {visibleStatuses.map((status) => {
                          const columnCards = swimlaneCards.filter(c => c.status === status);
                          return renderColumn(status, columnCards);
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeCard && <DragOverlayCard card={activeCard} />}
        </DragOverlay>

        {/* Save Filter Dialog */}
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar Filtro</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Nome do filtro..."
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFilterDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveCurrentFilter}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  );
};
