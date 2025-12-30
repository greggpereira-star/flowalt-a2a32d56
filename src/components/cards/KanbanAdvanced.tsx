import React, { useState, useMemo, useCallback } from 'react';
import { TaskCard } from './TaskCard';
import { CardContextMenu } from './CardContextMenu';
import { statusConfig } from './CardBadges';
import { KanbanQuickFilters, applyQuickFilter } from './KanbanQuickFilters';
import { KanbanColumnMetrics } from './KanbanColumnMetrics';
import { KanbanInlineQuickAdd } from './KanbanInlineQuickAdd';
import { 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  CheckSquare,
  AlertTriangle,
  Lock,
  Clock,
  Layers,
  User,
  Tag,
  Save,
  X,
  Sparkles,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  // Calculate blocked cards
  const blockedCardIds = useMemo(() => {
    if (!dependencies) return new Set<string>();
    
    const blocked = new Set<string>();
    dependencies.forEach(dep => {
      if (dep.dependent_card_id) {
        // Check if blocking card is not completed
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
      // Search query
      if (filters.searchQuery && !card.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      // Urgency filter
      if (filters.urgency.length > 0 && !filters.urgency.includes(card.urgency)) {
        return false;
      }
      // Owner filter
      if (filters.owners.length > 0 && !filters.owners.includes(card.owner_id || '')) {
        return false;
      }
      // Client filter
      if (filters.clients.length > 0 && !filters.clients.includes(card.client_id || '')) {
        return false;
      }
      // Has deadline
      if (filters.hasDeadline === true && !card.due_date) {
        return false;
      }
      if (filters.hasDeadline === false && card.due_date) {
        return false;
      }
      // Is overdue
      if (filters.isOverdue === true) {
        const dueDate = card.due_date ? new Date(card.due_date) : null;
        if (!dueDate || !isPast(dueDate) || isToday(dueDate) || card.status === 'delivered') {
          return false;
        }
      }
      // Has briefing
      if (filters.hasBriefing === true && !card.briefing_completed) {
        return false;
      }
      if (filters.hasBriefing === false && card.briefing_completed) {
        return false;
      }
      return true;
    });

    // Apply quick filter
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

  // Group cards by swimlane
  const swimlaneGroups = useMemo(() => {
    if (swimlane === 'none') return null;

    const groups: Record<string, Card[]> = {};
    filteredCards.forEach(card => {
      let key = '';
      switch (swimlane) {
        case 'owner':
          key = card.owner_id || 'unassigned';
          break;
        case 'urgency':
          key = card.urgency;
          break;
        case 'client':
          key = card.client_id || 'no-client';
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });
    return groups;
  }, [filteredCards, swimlane]);

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

  // Card actions
  const handleStatusChange = async (card: Card, newStatus: CardStatus) => {
    // Check briefing requirement
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

    // Check if blocked
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

  // Inline quick add handler
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
      console.error('KanbanAdvanced: quick add failed', error);
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
      await Promise.all(
        cardsToUpdate.map(card => updateCard.mutateAsync({ id: card.id, status: newStatus }))
      );
      toast({ title: `${cardsToUpdate.length} cards atualizados` });
      clearSelection();
    } catch (error) {
      toast({ title: 'Erro ao atualizar cards', variant: 'destructive' });
    }
  };

  const handleMassUrgencyChange = async (newUrgency: CardUrgency) => {
    const cardsToUpdate = cards.filter(c => selectedCards.has(c.id));
    
    try {
      await Promise.all(
        cardsToUpdate.map(card => updateCard.mutateAsync({ id: card.id, urgency: newUrgency }))
      );
      toast({ title: `${cardsToUpdate.length} cards atualizados` });
      clearSelection();
    } catch (error) {
      toast({ title: 'Erro ao atualizar cards', variant: 'destructive' });
    }
  };

  const handleMassOwnerChange = async (ownerId: string) => {
    const cardsToUpdate = cards.filter(c => selectedCards.has(c.id));
    
    try {
      await Promise.all(
        cardsToUpdate.map(card => updateCard.mutateAsync({ id: card.id, owner_id: ownerId }))
      );
      toast({ title: `${cardsToUpdate.length} cards atualizados` });
      clearSelection();
    } catch (error) {
      toast({ title: 'Erro ao atualizar cards', variant: 'destructive' });
    }
  };

  // Save filter
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

  // Check if card has alerts
  const getCardAlerts = (card: Card) => {
    const alerts: { type: 'overdue' | 'blocked' | 'briefing'; message: string }[] = [];
    
    // Overdue
    const dueDate = card.due_date ? new Date(card.due_date) : null;
    if (dueDate && isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered') {
      alerts.push({ type: 'overdue', message: 'Prazo vencido' });
    }
    
    // Blocked
    if (blockedCardIds.has(card.id)) {
      alerts.push({ type: 'blocked', message: 'Bloqueado por dependência' });
    }
    
    // Briefing pending
    if (!card.briefing_completed && ['backlog', 'briefing'].includes(card.status)) {
      alerts.push({ type: 'briefing', message: 'Briefing pendente' });
    }
    
    return alerts;
  };

  // Toggle swimlane collapse
  const toggleSwimlane = (key: string) => {
    const newCollapsed = new Set(collapsedSwimlanes);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSwimlanes(newCollapsed);
  };

  // Active filters count
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

  // Render card with selection
  const renderCard = (card: Card) => {
    const alerts = getCardAlerts(card);
    const isBlocked = blockedCardIds.has(card.id);
    
    return (
      <div key={card.id} className="relative group">
        {isSelectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={selectedCards.has(card.id)}
              onCheckedChange={() => toggleCardSelection(card.id)}
              className="bg-background shadow-sm"
            />
          </div>
        )}
        
        {/* Alert badges */}
        {alerts.length > 0 && (
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            {alerts.map((alert, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    'p-1.5 rounded-full shadow-sm',
                    alert.type === 'overdue' && 'bg-destructive text-destructive-foreground',
                    alert.type === 'blocked' && 'bg-purple-500 text-white',
                    alert.type === 'briefing' && 'bg-amber-500 text-black'
                  )}>
                    {alert.type === 'overdue' && <Clock className="h-3 w-3" />}
                    {alert.type === 'blocked' && <Lock className="h-3 w-3" />}
                    {alert.type === 'briefing' && <AlertTriangle className="h-3 w-3" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{alert.message}</TooltipContent>
              </Tooltip>
            ))}
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
            isBlocked && 'opacity-75'
          )}>
            <TaskCard
              card={card}
              onClick={() => isSelectionMode ? toggleCardSelection(card.id) : onCardClick(card)}
            />
          </div>
        </CardContextMenu>
      </div>
    );
  };

  // Render column
  const renderColumn = (status: CardStatus, columnCards: Card[]) => {
    const config = statusConfig[status];
    const isQuickAddOpen = quickAddColumn === status;
    
    return (
      <div
        key={status}
        className="flex-shrink-0 w-80 bg-muted/20 rounded-xl flex flex-col border border-border/30"
      >
        {/* Column Header */}
        <div className="p-3 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md rounded-t-xl border-b border-border/30">
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
            <Badge 
              variant="secondary" 
              className="h-5 min-w-5 px-1.5 text-[10px] font-bold"
            >
              {columnCards.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
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
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2 min-h-[150px]">
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
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nenhum card
                </p>
              </div>
            ) : (
              columnCards.map(renderCard)
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Top row: Search, Filters, Swimlanes */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <Input
              placeholder="Buscar cards..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-56 h-9"
            />

            {/* Advanced Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Urgency */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <AlertTriangle className="h-4 w-4 mr-2" />
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
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                          {opt.label}
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Owner */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <User className="h-4 w-4 mr-2" />
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
                      >
                        {member.profile?.full_name || member.profile?.email}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {/* Client */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Tag className="h-4 w-4 mr-2" />
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
                      >
                        {client.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Saved filters */}
                {savedFilters.length > 0 && (
                  <>
                    <DropdownMenuLabel>Filtros Salvos</DropdownMenuLabel>
                    {savedFilters.map(f => (
                      <DropdownMenuItem key={f.id} onClick={() => loadFilter(f)}>
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onClick={() => setFilterDialogOpen(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Filtro Atual
                </DropdownMenuItem>
                
                {(activeFiltersCount > 0 || quickFilter) && (
                  <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                    <X className="h-4 w-4 mr-2" />
                    Limpar Filtros
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Swimlanes */}
            <Select value={swimlane} onValueChange={(v: SwimlaneOption) => setSwimlane(v)}>
              <SelectTrigger className="w-44 h-9">
                <Layers className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Agrupar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem agrupamento</SelectItem>
                <SelectItem value="owner">Por Responsável</SelectItem>
                <SelectItem value="urgency">Por Urgência</SelectItem>
                <SelectItem value="client">Por Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selection & Mass Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              size="sm"
              className="h-9 gap-2"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) clearSelection();
              }}
            >
              <CheckSquare className="h-4 w-4" />
              {isSelectionMode ? `${selectedCards.size} selecionados` : 'Selecionar'}
            </Button>

            {selectedCards.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 gap-2">
                    Ações em Massa
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                  {visibleStatuses.map(status => (
                    <DropdownMenuItem key={status} onClick={() => handleMassStatusChange(status)}>
                      {statusConfig[status].label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Alterar Urgência</DropdownMenuLabel>
                  {URGENCY_OPTIONS.map(opt => (
                    <DropdownMenuItem key={opt.value} onClick={() => handleMassUrgencyChange(opt.value)}>
                      <div className={cn('w-2 h-2 rounded-full mr-2', opt.color)} />
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Atribuir Responsável</DropdownMenuLabel>
                  {members?.slice(0, 5).map(member => (
                    <DropdownMenuItem key={member.user_id} onClick={() => handleMassOwnerChange(member.user_id)}>
                      {member.profile?.full_name || member.profile?.email}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Quick Filters Row */}
        <KanbanQuickFilters
          cards={cards}
          activeFilter={quickFilter}
          onFilterChange={setQuickFilter}
          blockedCardIds={blockedCardIds}
        />
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        {swimlane === 'none' ? (
          // Standard Kanban
          <div className="flex gap-4 pb-4 h-full">
            {visibleStatuses.map((status) => renderColumn(status, groupedByStatus[status] || []))}
          </div>
        ) : (
          // Swimlane Kanban
          <div className="space-y-4">
            {Object.entries(swimlaneGroups || {}).map(([key, swimlaneCards]) => (
              <div key={key} className="border rounded-xl bg-card/50">
                {/* Swimlane Header */}
                <div
                  className="p-3 flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl"
                  onClick={() => toggleSwimlane(key)}
                >
                  {collapsedSwimlanes.has(key) ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold">{getSwimlaneLabel(key)}</span>
                  <Badge variant="secondary">{swimlaneCards.length}</Badge>
                </div>

                {/* Swimlane Content */}
                {!collapsedSwimlanes.has(key) && (
                  <div className="p-4 overflow-x-auto border-t border-border/30">
                    <div className="flex gap-4">
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
  );
};
