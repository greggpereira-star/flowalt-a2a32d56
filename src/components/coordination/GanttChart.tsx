import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, differenceInDays, addDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';
import type { Dependency } from '@/hooks/useDependencies';

interface GanttChartProps {
  cards: CardType[];
  dependencies: Dependency[];
  onCardClick?: (cardId: string) => void;
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

export const GanttChart: React.FC<GanttChartProps> = ({
  cards,
  dependencies,
  onCardClick,
}) => {
  const { timeline, cardBars, dateRange } = useMemo(() => {
    if (!cards.length) {
      return { timeline: [], cardBars: [], dateRange: { start: new Date(), end: new Date() } };
    }

    // Determine date range
    const today = startOfDay(new Date());
    const cardsWithDates = cards.filter(c => c.due_date || c.created_at);
    
    let minDate = today;
    let maxDate = addDays(today, 14);

    cardsWithDates.forEach(card => {
      const createdDate = startOfDay(new Date(card.created_at));
      const dueDate = card.due_date ? startOfDay(new Date(card.due_date)) : null;
      
      if (createdDate < minDate) minDate = createdDate;
      if (dueDate && dueDate > maxDate) maxDate = dueDate;
    });

    // Extend range a bit
    minDate = addDays(minDate, -2);
    maxDate = addDays(maxDate, 7);

    const days = eachDayOfInterval({ start: minDate, end: maxDate });
    const totalDays = days.length;
    const dayWidth = 40; // pixels per day

    // Create timeline
    const timeline = days.map((day, index) => ({
      date: day,
      label: format(day, 'd', { locale: ptBR }),
      weekday: format(day, 'EEE', { locale: ptBR }),
      isToday: differenceInDays(day, today) === 0,
      isWeekend: day.getDay() === 0 || day.getDay() === 6,
      position: index * dayWidth,
    }));

    // Create card bars
    const cardBars = cards
      .filter(c => c.status !== 'archived')
      .map(card => {
        const startDate = startOfDay(new Date(card.created_at));
        const endDate = card.due_date 
          ? startOfDay(new Date(card.due_date))
          : addDays(startDate, 3);

        const startOffset = differenceInDays(startDate, minDate);
        const duration = Math.max(differenceInDays(endDate, startDate), 1);
        const isOverdue = card.due_date && new Date(card.due_date) < today && card.status !== 'delivered' && card.status !== 'approved';

        // Find dependencies
        const blockedBy = dependencies
          .filter(d => d.dependent_card_id === card.id)
          .map(d => d.blocking_card_id);

        return {
          id: card.id,
          title: card.title,
          status: card.status,
          left: startOffset * dayWidth,
          width: duration * dayWidth,
          isOverdue,
          blockedBy,
          dueDate: card.due_date,
          estimatedHours: card.estimated_hours,
        };
      });

    return { 
      timeline, 
      cardBars,
      dateRange: { start: minDate, end: maxDate },
    };
  }, [cards, dependencies]);

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
    <Card>
      <CardHeader>
        <CardTitle>Cronograma</CardTitle>
        <CardDescription>
          {format(dateRange.start, "dd MMM", { locale: ptBR })} - {format(dateRange.end, "dd MMM yyyy", { locale: ptBR })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            {/* Timeline Header */}
            <div className="flex border-b mb-2 pb-2">
              <div className="w-48 shrink-0 text-sm font-medium text-muted-foreground">
                Tarefa
              </div>
              <div className="flex-1 flex relative" style={{ minWidth: timeline.length * 40 }}>
                {timeline.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-10 text-center shrink-0',
                      day.isWeekend && 'bg-muted/50',
                      day.isToday && 'bg-primary/10'
                    )}
                  >
                    <div className="text-[10px] text-muted-foreground">{day.weekday}</div>
                    <div className={cn(
                      'text-xs font-medium',
                      day.isToday && 'text-primary'
                    )}>
                      {day.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Rows */}
            <div className="space-y-2">
              {cardBars.map((bar) => (
                <div key={bar.id} className="flex items-center group">
                  <div className="w-48 shrink-0 pr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p 
                            className="text-sm truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => onCardClick?.(bar.id)}
                          >
                            {bar.title}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{bar.title}</p>
                          {bar.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Prazo: {format(new Date(bar.dueDate), "dd/MM/yyyy")}
                            </p>
                          )}
                          {bar.estimatedHours && (
                            <p className="text-xs text-muted-foreground">
                              Estimativa: {bar.estimatedHours}h
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div 
                    className="flex-1 relative h-8"
                    style={{ minWidth: timeline.length * 40 }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeline.map((day, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-10 h-full border-l border-border/50 shrink-0',
                            day.isWeekend && 'bg-muted/30',
                            day.isToday && 'bg-primary/5'
                          )}
                        />
                      ))}
                    </div>
                    
                    {/* Card Bar */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute top-1 h-6 rounded-md cursor-pointer transition-all hover:opacity-80 flex items-center px-2',
                              STATUS_COLORS[bar.status],
                              bar.isOverdue && 'ring-2 ring-destructive ring-offset-1'
                            )}
                            style={{
                              left: bar.left,
                              width: Math.max(bar.width, 40),
                            }}
                            onClick={() => onCardClick?.(bar.id)}
                          >
                            <span className="text-[10px] text-white font-medium truncate">
                              {STATUS_LABELS[bar.status]}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{bar.title}</p>
                          <p className="text-xs">{STATUS_LABELS[bar.status]}</p>
                          {bar.isOverdue && (
                            <Badge variant="destructive" className="mt-1">Atrasado</Badge>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
