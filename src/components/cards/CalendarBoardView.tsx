import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';

type CalendarDateMode = 'task_due_date' | 'post_date';

type CardWithCustomFields = Card & {
  custom_fields?: Record<string, string | null | undefined>;
};

interface CalendarBoardViewProps {
  cards: CardWithCustomFields[];
  onCardClick: (card: CardWithCustomFields) => void;
  dateMode?: CalendarDateMode;
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-muted-foreground/20 text-muted-foreground',
  briefing: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  todo: 'bg-primary/20 text-primary',
  in_progress: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  review: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  approved: 'bg-green-500/20 text-green-700 dark:text-green-400',
  delivered: 'bg-green-600/20 text-green-800 dark:text-green-300',
  done: 'bg-green-600/20 text-green-800 dark:text-green-300',
};

const URGENCY_DOTS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export const CalendarBoardView: React.FC<CalendarBoardViewProps> = ({
  cards,
  onCardClick,
  dateMode = 'task_due_date',
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isPostCalendar = dateMode === 'post_date';

  // Get calendar days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const getCardCalendarDate = (card: CardWithCustomFields) => {
    if (isPostCalendar) {
      return card.custom_fields?.post_date || null;
    }

    return card.due_date;
  };

  // Group cards by the selected calendar date. Social editorial calendars use post_date;
  // operational calendars keep using the internal task due_date.
  const cardsByDate = useMemo(() => {
    const grouped: Record<string, CardWithCustomFields[]> = {};
    
    cards.forEach(card => {
      const calendarDate = getCardCalendarDate(card);

      if (calendarDate) {
        const dateKey = format(new Date(calendarDate), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(card);
      }
    });

    return grouped;
  }, [cards, isPostCalendar]);

  // Cards without the selected calendar date
  const unscheduledCards = useMemo(() => {
    return cards.filter(card => !getCardCalendarDate(card));
  }, [cards, isPostCalendar]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Unscheduled count */}
        {unscheduledCards.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="h-3 w-3" />
            {unscheduledCards.length} sem prazo
          </Badge>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden">
        {/* Week days header */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekDays.map(day => (
            <div
              key={day}
              className="p-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-0">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayCards = cardsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <div
                key={index}
                className={cn(
                  'border-b border-r p-1 min-h-[100px] flex flex-col',
                  !isCurrentMonth && 'bg-muted/30',
                  isTodayDate && 'bg-primary/5'
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isTodayDate && 'bg-primary text-primary-foreground',
                      !isCurrentMonth && 'text-muted-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayCards.length > 3 && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      +{dayCards.length - 3}
                    </Badge>
                  )}
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1">
                  <div className="space-y-0.5">
                    {dayCards.slice(0, 3).map(card => (
                      <button
                        key={card.id}
                        onClick={() => onCardClick(card)}
                        className={cn(
                          'w-full text-left px-1.5 py-0.5 rounded text-[11px] truncate flex items-center gap-1 transition-colors hover:opacity-80',
                          STATUS_COLORS[card.status] || STATUS_COLORS.backlog
                        )}
                      >
                        {card.urgency && URGENCY_DOTS[card.urgency] && (
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full flex-shrink-0',
                              URGENCY_DOTS[card.urgency]
                            )}
                          />
                        )}
                        <span className="truncate">{card.title}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled cards section */}
      {unscheduledCards.length > 0 && (
        <div className="mt-4 border rounded-lg p-3">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Cards sem prazo definido
          </h3>
          <div className="flex flex-wrap gap-2">
            {unscheduledCards.slice(0, 10).map(card => (
              <button
                key={card.id}
                onClick={() => onCardClick(card)}
                className={cn(
                  'px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors hover:opacity-80',
                  STATUS_COLORS[card.status] || STATUS_COLORS.backlog
                )}
              >
                {card.urgency && URGENCY_DOTS[card.urgency] && (
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      URGENCY_DOTS[card.urgency]
                    )}
                  />
                )}
                <span className="truncate max-w-[150px]">{card.title}</span>
              </button>
            ))}
            {unscheduledCards.length > 10 && (
              <Badge variant="outline">
                +{unscheduledCards.length - 10} mais
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
