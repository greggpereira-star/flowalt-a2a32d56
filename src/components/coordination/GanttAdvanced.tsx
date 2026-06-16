import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { format, differenceInDays, addDays, startOfDay, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Flag, 
  Link2, 
  Unlink, 
  Users,
  AlertTriangle,
  Calendar as CalendarIcon,
  GripVertical,
  Plus,
  X,
} from 'lucide-react';
import type { Card as CardType } from '@/hooks/useCards';
import type { Dependency } from '@/hooks/useDependencies';
import { useUpdateCard } from '@/hooks/useCards';
import { useCreateDependency, useDeleteDependency } from '@/hooks/useDependencies';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { useToast } from '@/hooks/use-toast';

interface GanttAdvancedProps {
  cards: CardType[];
  dependencies: Dependency[];
  onCardClick?: (cardId: string) => void;
  capacityData?: CapacityData[];
  showCapacityOverlay?: boolean;
}

interface CapacityData {
  userId: string;
  userName: string;
  date: Date;
  allocatedHours: number;
  capacityHours: number;
}

interface Milestone {
  id: string;
  title: string;
  date: Date;
  cardId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-muted-foreground/50',
  briefing: 'bg-blue-500',
  todo: 'bg-primary',
  in_progress: 'bg-yellow-500',
  review: 'bg-purple-500',
  approved: 'bg-green-500',
  delivered: 'bg-green-600',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  briefing: 'Briefing',
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  review: 'Revisão',
  approved: 'Aprovado',
  delivered: 'Entregue',
};

type ZoomLevel = 'day' | 'week' | 'month';

export const GanttAdvanced: React.FC<GanttAdvancedProps> = ({
  cards,
  dependencies,
  onCardClick,
  capacityData = [],
  showCapacityOverlay = false,
}) => {
  const { toast } = useToast();
  const updateCard = useUpdateCard();
  const createDependency = useCreateDependency();
  const deleteDependency = useDeleteDependency();
  const { data: members } = useWorkspaceMembers();

  // State
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [viewStartDate, setViewStartDate] = useState(() => addDays(startOfDay(new Date()), -7));
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-start' | 'resize-end' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartData, setDragStartData] = useState<{ start: Date; end: Date } | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [showCapacity, setShowCapacity] = useState(showCapacityOverlay);
  const [dateEditDialog, setDateEditDialog] = useState<{ cardId: string; type: 'start' | 'end' } | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>();

  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom settings
  const dayWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'day': return 40;
      case 'week': return 20;
      case 'month': return 8;
    }
  }, [zoomLevel]);

  const viewDays = useMemo(() => {
    switch (zoomLevel) {
      case 'day': return 30;
      case 'week': return 60;
      case 'month': return 90;
    }
  }, [zoomLevel]);

  // Calculate date range
  const { timeline, dateRange } = useMemo(() => {
    const endDate = addDays(viewStartDate, viewDays);
    const days = eachDayOfInterval({ start: viewStartDate, end: endDate });
    
    const today = startOfDay(new Date());
    
    const timeline = days.map((day, index) => ({
      date: day,
      label: format(day, zoomLevel === 'month' ? 'd' : 'dd', { locale: ptBR }),
      weekday: format(day, 'EEE', { locale: ptBR }),
      month: format(day, 'MMM', { locale: ptBR }),
      isToday: isSameDay(day, today),
      isWeekend: isWeekend(day),
      position: index * dayWidth,
    }));

    return { 
      timeline, 
      dateRange: { start: viewStartDate, end: endDate },
    };
  }, [viewStartDate, viewDays, dayWidth, zoomLevel]);

  // Process cards into bars
  const cardBars = useMemo(() => {
    return cards
      .filter(c => c.status !== 'archived')
      .map(card => {
        const startDate = startOfDay(new Date(card.created_at));
        const endDate = card.due_date 
          ? startOfDay(new Date(card.due_date))
          : addDays(startDate, 3);

        const startOffset = differenceInDays(startDate, viewStartDate);
        const duration = Math.max(differenceInDays(endDate, startDate), 1);
        const today = startOfDay(new Date());
        const isOverdue = card.due_date && new Date(card.due_date) < today && card.status !== 'delivered' && card.status !== 'approved';

        // Calculate progress from checklist
        const progress = card.status === 'delivered' ? 100 : 
                        card.status === 'approved' ? 90 :
                        card.status === 'review' ? 70 :
                        card.status === 'in_progress' ? 50 :
                        card.status === 'todo' ? 20 :
                        card.status === 'briefing' ? 10 : 0;

        // Find dependencies
        const blockedBy = dependencies
          .filter(d => d.dependent_card_id === card.id)
          .map(d => d.blocking_card_id);

        const blocking = dependencies
          .filter(d => d.blocking_card_id === card.id)
          .map(d => d.dependent_card_id);

        // Check if blocked by incomplete task
        const isBlocked = blockedBy.some(blockingId => {
          const blockingCard = cards.find(c => c.id === blockingId);
          return blockingCard && blockingCard.status !== 'delivered';
        });

        // Capacity risk
        const hasCapacityRisk = capacityData.some(cd => 
          cd.userId === card.owner_id && 
          cd.allocatedHours > cd.capacityHours
        );

        return {
          id: card.id,
          title: card.title,
          status: card.status,
          left: startOffset * dayWidth,
          width: duration * dayWidth,
          startDate,
          endDate,
          isOverdue,
          isBlocked,
          hasCapacityRisk,
          blockedBy,
          blocking,
          progress,
          dueDate: card.due_date,
          estimatedHours: card.estimated_hours,
          ownerId: card.owner_id,
          isMilestone: duration === 1 && card.status === 'approved',
        };
      });
  }, [cards, dependencies, viewStartDate, dayWidth, capacityData]);

  // Draw dependency lines
  const dependencyLines = useMemo(() => {
    const lines: { from: string; to: string; fromX: number; fromY: number; toX: number; toY: number }[] = [];
    
    dependencies.forEach(dep => {
      if (!dep.blocking_card_id || !dep.dependent_card_id) return;
      
      const fromBar = cardBars.find(b => b.id === dep.blocking_card_id);
      const toBar = cardBars.find(b => b.id === dep.dependent_card_id);
      
      if (!fromBar || !toBar) return;

      const fromIndex = cardBars.indexOf(fromBar);
      const toIndex = cardBars.indexOf(toBar);

      lines.push({
        from: dep.blocking_card_id,
        to: dep.dependent_card_id,
        fromX: fromBar.left + fromBar.width,
        fromY: fromIndex * 40 + 20,
        toX: toBar.left,
        toY: toIndex * 40 + 20,
      });
    });

    return lines;
  }, [dependencies, cardBars]);

  // Handlers
  const handleNavigate = (direction: 'prev' | 'next') => {
    const days = direction === 'prev' ? -7 : 7;
    setViewStartDate(d => addDays(d, days));
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      if (zoomLevel === 'month') setZoomLevel('week');
      else if (zoomLevel === 'week') setZoomLevel('day');
    } else {
      if (zoomLevel === 'day') setZoomLevel('week');
      else if (zoomLevel === 'week') setZoomLevel('month');
    }
  };

  const handleDragStart = (cardId: string, mode: 'move' | 'resize-start' | 'resize-end', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const bar = cardBars.find(b => b.id === cardId);
    if (!bar) return;

    setSelectedCard(cardId);
    setDragMode(mode);
    setDragStartX(e.clientX);
    setDragStartData({ start: bar.startDate, end: bar.endDate });
  };

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!dragMode || !selectedCard || !dragStartData) return;

    const deltaX = e.clientX - dragStartX;
    const deltaDays = Math.round(deltaX / dayWidth);

    // Visual feedback would go here
  }, [dragMode, selectedCard, dragStartData, dragStartX, dayWidth]);

  const handleDragEnd = async (e: React.MouseEvent) => {
    if (!dragMode || !selectedCard || !dragStartData) {
      setDragMode(null);
      setSelectedCard(null);
      setDragStartData(null);
      return;
    }

    const deltaX = e.clientX - dragStartX;
    const deltaDays = Math.round(deltaX / dayWidth);

    if (deltaDays !== 0) {
      const card = cards.find(c => c.id === selectedCard);
      if (!card) return;

      let newDueDate: Date | undefined;

      if (dragMode === 'move') {
        if (card.due_date) {
          newDueDate = addDays(new Date(card.due_date), deltaDays);
        }
      } else if (dragMode === 'resize-end') {
        if (card.due_date) {
          newDueDate = addDays(new Date(card.due_date), deltaDays);
        } else {
          newDueDate = addDays(dragStartData.end, deltaDays);
        }
      }

      if (newDueDate) {
        try {
          await updateCard.mutateAsync({
            id: selectedCard,
            due_date: newDueDate.toISOString(),
          });
          toast({ title: 'Prazo atualizado' });
        } catch (error) {
          toast({ title: 'Erro ao atualizar prazo', variant: 'destructive' });
        }
      }
    }

    setDragMode(null);
    setSelectedCard(null);
    setDragStartData(null);
  };

  // Link cards
  const handleStartLinking = (cardId: string) => {
    setLinkingFrom(cardId);
  };

  const handleCompleteLinking = async (toCardId: string) => {
    if (!linkingFrom || linkingFrom === toCardId) {
      setLinkingFrom(null);
      return;
    }

    // Check for circular dependency
    const checkCircular = (fromId: string, toId: string): boolean => {
      const visited = new Set<string>();
      const check = (currentId: string): boolean => {
        if (currentId === fromId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        
        const deps = dependencies.filter(d => d.dependent_card_id === currentId);
        return deps.some(d => d.blocking_card_id && check(d.blocking_card_id));
      };
      return check(toId);
    };

    if (checkCircular(linkingFrom, toCardId)) {
      toast({ 
        title: 'Dependência circular', 
        description: 'Não é possível criar esta dependência.',
        variant: 'destructive' 
      });
      setLinkingFrom(null);
      return;
    }

    try {
      await createDependency.mutateAsync({
        blocking_card_id: linkingFrom,
        dependent_card_id: toCardId,
      });
      toast({ title: 'Dependência criada' });
    } catch (error) {
      toast({ title: 'Erro ao criar dependência', variant: 'destructive' });
    }

    setLinkingFrom(null);
  };

  const handleDeleteDependency = async (depId: string) => {
    try {
      await deleteDependency.mutateAsync(depId);
      toast({ title: 'Dependência removida' });
    } catch (error) {
      toast({ title: 'Erro ao remover dependência', variant: 'destructive' });
    }
  };

  // Date edit
  const handleDateEdit = async () => {
    if (!dateEditDialog || !editingDate) return;

    try {
      await updateCard.mutateAsync({
        id: dateEditDialog.cardId,
        due_date: editingDate.toISOString(),
      });
      toast({ title: 'Data atualizada' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar data', variant: 'destructive' });
    }

    setDateEditDialog(null);
    setEditingDate(undefined);
  };

  // Capacity overlay
  const getCapacityForDay = (day: Date, userId: string): number => {
    const cap = capacityData.find(
      cd => cd.userId === userId && isSameDay(cd.date, day)
    );
    return cap ? (cap.allocatedHours / cap.capacityHours) * 100 : 0;
  };

  if (cards.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cronograma</CardTitle>
          <CardDescription>Visualização de Gantt das tarefas</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum card para exibir
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cronograma</CardTitle>
            <CardDescription>
              {format(dateRange.start, "dd MMM", { locale: ptBR })} - {format(dateRange.end, "dd MMM yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Capacity toggle */}
            <div className="flex items-center gap-2 mr-4">
              <Switch
                id="capacity"
                checked={showCapacity}
                onCheckedChange={setShowCapacity}
              />
              <Label htmlFor="capacity" className="text-sm">
                <Users className="h-4 w-4 inline mr-1" />
                Capacidade
              </Label>
            </div>

            {/* Navigation */}
            <Button variant="outline" size="icon" onClick={() => handleNavigate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewStartDate(addDays(startOfDay(new Date()), -7))}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleNavigate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Zoom */}
            <div className="flex items-center gap-1 ml-2">
              <Button variant="outline" size="icon" onClick={() => handleZoom('out')} disabled={zoomLevel === 'month'}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs w-12 text-center">
                {zoomLevel === 'day' ? 'Dia' : zoomLevel === 'week' ? 'Semana' : 'Mês'}
              </span>
              <Button variant="outline" size="icon" onClick={() => handleZoom('in')} disabled={zoomLevel === 'day'}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Link mode indicator */}
            {linkingFrom && (
              <Badge variant="outline" className="ml-2">
                <Link2 className="h-3 w-3 mr-1" />
                Clique em um card para vincular
                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => setLinkingFrom(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div 
            ref={containerRef}
            className="min-w-[800px] relative"
            onMouseMove={dragMode ? handleDrag : undefined}
            onMouseUp={dragMode ? handleDragEnd : undefined}
            onMouseLeave={dragMode ? handleDragEnd : undefined}
          >
            {/* Timeline Header */}
            <div className="flex border-b sticky top-0 bg-background z-20">
              <div className="w-48 shrink-0 text-sm font-medium text-muted-foreground p-2 border-r">
                Tarefa
              </div>
              <div className="flex-1 flex relative" style={{ minWidth: timeline.length * dayWidth }}>
                {timeline.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'shrink-0 text-center border-r border-border/30',
                      day.isWeekend && 'bg-muted/50',
                      day.isToday && 'bg-primary/10'
                    )}
                    style={{ width: dayWidth }}
                  >
                    {zoomLevel === 'day' && (
                      <div className="text-[10px] text-muted-foreground">{day.weekday}</div>
                    )}
                    <div className={cn(
                      'text-xs font-medium',
                      day.isToday && 'text-primary'
                    )}>
                      {day.label}
                    </div>
                    {(i === 0 || day.label === '1') && (
                      <div className="text-[10px] text-muted-foreground">{day.month}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SVG for dependency lines */}
            <svg 
              className="absolute pointer-events-none z-10"
              style={{ 
                left: 192, 
                top: 60, 
                width: timeline.length * dayWidth,
                height: cardBars.length * 40 
              }}
            >
              {dependencyLines.map((line, idx) => {
                const midX = (line.fromX + line.toX) / 2;
                return (
                  <g key={idx}>
                    <path
                      d={`M ${line.fromX} ${line.fromY} 
                          C ${midX} ${line.fromY}, ${midX} ${line.toY}, ${line.toX} ${line.toY}`}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeDasharray="4"
                      markerEnd="url(#arrowhead)"
                    />
                  </g>
                );
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="hsl(var(--primary))"
                  />
                </marker>
              </defs>
            </svg>

            {/* Card Rows */}
            <div className="relative">
              {cardBars.map((bar, index) => (
                <div 
                  key={bar.id} 
                  className="flex items-center h-10 border-b border-border/30 group"
                >
                  {/* Card name */}
                  <div className="w-48 shrink-0 pr-2 pl-2 border-r flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p 
                            className={cn(
                              "text-sm truncate cursor-pointer hover:text-primary transition-colors flex-1",
                              bar.isBlocked && "text-orange-500"
                            )}
                            onClick={() => onCardClick?.(bar.id)}
                          >
                            {bar.isMilestone && <Flag className="h-3 w-3 inline mr-1" />}
                            {bar.title}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="font-medium">{bar.title}</p>
                          <p className="text-xs">{STATUS_LABELS[bar.status]}</p>
                          {bar.isOverdue && <Badge variant="destructive" className="mt-1">Atrasado</Badge>}
                          {bar.isBlocked && <Badge variant="outline" className="mt-1 text-orange-500">Bloqueado</Badge>}
                          {bar.hasCapacityRisk && <Badge variant="outline" className="mt-1 text-red-500">Sobrecarga</Badge>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Link button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => linkingFrom ? handleCompleteLinking(bar.id) : handleStartLinking(bar.id)}
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Timeline area */}
                  <div 
                    className="flex-1 relative h-full"
                    style={{ minWidth: timeline.length * dayWidth }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeline.map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-full border-r border-border/20 shrink-0',
                            day.isWeekend && 'bg-muted/20',
                            day.isToday && 'bg-primary/5'
                          )}
                          style={{ width: dayWidth }}
                        />
                      ))}
                    </div>
                    
                    {/* Capacity overlay */}
                    {showCapacity && bar.ownerId && (
                      <div className="absolute inset-0 flex pointer-events-none">
                        {timeline.map((day, i) => {
                          const utilization = getCapacityForDay(day.date, bar.ownerId!);
                          return (
                            <div
                              key={i}
                              className={cn(
                                'h-full shrink-0 opacity-20',
                                utilization > 100 && 'bg-destructive',
                                utilization > 80 && utilization <= 100 && 'bg-orange-500',
                              )}
                              style={{ width: dayWidth }}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Card Bar */}
                    {bar.left >= -bar.width && bar.left < timeline.length * dayWidth && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'absolute top-1 h-8 rounded cursor-pointer transition-all group/bar',
                                bar.isMilestone ? 'w-4 h-4 rotate-45 top-3' : '',
                                STATUS_COLORS[bar.status],
                                bar.isOverdue && 'ring-2 ring-destructive ring-offset-1',
                                bar.isBlocked && 'ring-2 ring-orange-500 ring-offset-1',
                                selectedCard === bar.id && 'ring-2 ring-primary',
                                linkingFrom === bar.id && 'ring-2 ring-blue-500 animate-pulse'
                              )}
                              style={{
                                left: Math.max(bar.left, 0),
                                width: bar.isMilestone ? 16 : Math.max(bar.width, 20),
                              }}
                              onClick={() => linkingFrom ? handleCompleteLinking(bar.id) : onCardClick?.(bar.id)}
                            >
                              {!bar.isMilestone && (
                                <>
                                  {/* Resize handle start */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/30"
                                    onMouseDown={(e) => handleDragStart(bar.id, 'resize-start', e)}
                                  />
                                  
                                  {/* Bar content */}
                                  <div 
                                    className="flex items-center h-full px-2 cursor-move"
                                    onMouseDown={(e) => handleDragStart(bar.id, 'move', e)}
                                  >
                                    <span className="text-[10px] text-white font-medium truncate">
                                      {bar.width > 60 ? bar.title : ''}
                                    </span>
                                  </div>

                                  {/* Progress bar */}
                                  <div 
                                    className="absolute bottom-0 left-0 h-1 bg-white/50 rounded-b"
                                    style={{ width: `${bar.progress}%` }}
                                  />

                                  {/* Resize handle end */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-white/30"
                                    onMouseDown={(e) => handleDragStart(bar.id, 'resize-end', e)}
                                  />

                                  {/* Risk indicators */}
                                  {(bar.isOverdue || bar.isBlocked || bar.hasCapacityRisk) && (
                                    <div className="absolute -top-1 -right-1 flex gap-0.5">
                                      {bar.isOverdue && (
                                        <div className="w-3 h-3 rounded-full bg-destructive flex items-center justify-center">
                                          <AlertTriangle className="h-2 w-2 text-white" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{bar.title}</p>
                              <p className="text-xs">{STATUS_LABELS[bar.status]} • {bar.progress}% completo</p>
                              {bar.dueDate && (
                                <p className="text-xs">Prazo: {format(new Date(bar.dueDate), "dd/MM/yyyy")}</p>
                              )}
                              {bar.estimatedHours && (
                                <p className="text-xs">Estimativa: {bar.estimatedHours}h</p>
                              )}
                              {bar.blockedBy.length > 0 && (
                                <p className="text-xs text-orange-500">
                                  Bloqueado por {bar.blockedBy.length} tarefa(s)
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>

      {/* Date Edit Dialog */}
      <Dialog open={!!dateEditDialog} onOpenChange={() => setDateEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Data</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={editingDate}
            onSelect={setEditingDate}
            locale={ptBR}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleDateEdit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
