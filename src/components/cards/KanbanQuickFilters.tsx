import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Flame, 
  Clock, 
  CalendarClock, 
  Lock, 
  FileQuestion,
  Zap,
  X
} from 'lucide-react';
import type { Card } from '@/hooks/useCards';
import { isPast, isToday } from 'date-fns';

interface QuickFilter {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  count: number;
  isActive: boolean;
}

interface KanbanQuickFiltersProps {
  cards: Card[];
  activeFilter: string | null;
  onFilterChange: (filterId: string | null) => void;
  blockedCardIds?: Set<string>;
}

export const KanbanQuickFilters: React.FC<KanbanQuickFiltersProps> = ({
  cards,
  activeFilter,
  onFilterChange,
  blockedCardIds = new Set(),
}) => {
  // Calculate counts for each quick filter
  const criticalCount = cards.filter(c => c.urgency === 'critical' && c.status !== 'delivered').length;
  const overdueCount = cards.filter(c => {
    const dueDate = c.due_date ? new Date(c.due_date) : null;
    return dueDate && isPast(dueDate) && !isToday(dueDate) && c.status !== 'delivered';
  }).length;
  const todayCount = cards.filter(c => {
    const dueDate = c.due_date ? new Date(c.due_date) : null;
    return dueDate && isToday(dueDate) && c.status !== 'delivered';
  }).length;
  const blockedCount = cards.filter(c => blockedCardIds.has(c.id)).length;
  // Only count 'full' cards (not quick cards) for briefing filter
  const noBriefingCount = cards.filter(c => 
    (c as any).card_type !== 'quick' &&
    !c.briefing_completed && 
    !['delivered', 'approved'].includes(c.status)
  ).length;

  const quickFilters: QuickFilter[] = [
    {
      id: 'critical',
      label: 'Críticas',
      icon: Flame,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50',
      borderColor: 'border-red-200 dark:border-red-800',
      count: criticalCount,
      isActive: activeFilter === 'critical',
    },
    {
      id: 'overdue',
      label: 'Atrasadas',
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50',
      borderColor: 'border-orange-200 dark:border-orange-800',
      count: overdueCount,
      isActive: activeFilter === 'overdue',
    },
    {
      id: 'today',
      label: 'Hoje',
      icon: CalendarClock,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50',
      borderColor: 'border-blue-200 dark:border-blue-800',
      count: todayCount,
      isActive: activeFilter === 'today',
    },
    {
      id: 'blocked',
      label: 'Bloqueadas',
      icon: Lock,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50',
      borderColor: 'border-purple-200 dark:border-purple-800',
      count: blockedCount,
      isActive: activeFilter === 'blocked',
    },
    {
      id: 'no-briefing',
      label: 'Sem Brief',
      icon: FileQuestion,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50',
      borderColor: 'border-amber-200 dark:border-amber-800',
      count: noBriefingCount,
      isActive: activeFilter === 'no-briefing',
    },
  ];

  // Only show filters with counts > 0
  const visibleFilters = quickFilters.filter(f => f.count > 0 || f.isActive);

  if (visibleFilters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visibleFilters.map((filter) => {
        const Icon = filter.icon;
        return (
          <Button
            key={filter.id}
            variant="outline"
            size="sm"
            className={cn(
              'h-8 px-3 gap-1.5 font-medium transition-all',
              filter.isActive 
                ? cn(filter.bgColor, filter.borderColor, filter.color, 'border-2')
                : 'hover:bg-muted/50'
            )}
            onClick={() => onFilterChange(filter.isActive ? null : filter.id)}
          >
            <Icon className={cn('h-3.5 w-3.5', filter.isActive && filter.color)} />
            <span className={cn(filter.isActive && filter.color)}>{filter.label}</span>
            <Badge 
              variant="secondary" 
              className={cn(
                'h-5 min-w-5 px-1.5 text-[10px] font-bold',
                filter.isActive && cn(filter.bgColor, filter.color)
              )}
            >
              {filter.count}
            </Badge>
          </Button>
        );
      })}
      
      {activeFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onFilterChange(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

// Helper function to filter cards based on quick filter
export const applyQuickFilter = (
  cards: Card[], 
  filterId: string | null,
  blockedCardIds: Set<string> = new Set()
): Card[] => {
  if (!filterId) return cards;

  switch (filterId) {
    case 'critical':
      return cards.filter(c => c.urgency === 'critical' && c.status !== 'delivered');
    case 'overdue':
      return cards.filter(c => {
        const dueDate = c.due_date ? new Date(c.due_date) : null;
        return dueDate && isPast(dueDate) && !isToday(dueDate) && c.status !== 'delivered';
      });
    case 'today':
      return cards.filter(c => {
        const dueDate = c.due_date ? new Date(c.due_date) : null;
        return dueDate && isToday(dueDate) && c.status !== 'delivered';
      });
    case 'blocked':
      return cards.filter(c => blockedCardIds.has(c.id));
    case 'no-briefing':
      // Only filter 'full' cards - quick cards don't need briefing
      return cards.filter(c => 
        (c as any).card_type !== 'quick' &&
        !c.briefing_completed && 
        !['delivered', 'approved'].includes(c.status)
      );
    default:
      return cards;
  }
};
