import React from 'react';
import { Card as CardUI, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge, UrgencyBadge } from './CardBadges';
import { CardRiskIndicators } from './CardRiskIndicators';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card } from '@/hooks/useCards';

interface TaskCardProps {
  card: Card;
  onClick?: () => void;
  isDragging?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ card, onClick, isDragging }) => {
  const dueDate = card.due_date ? new Date(card.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered';

  return (
    <CardUI
      className={cn(
        'cursor-pointer transition-all hover:shadow-md group',
        isDragging && 'shadow-lg ring-2 ring-primary/50 rotate-2',
        isOverdue && 'border-destructive/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {card.title}
          </h3>
          <UrgencyBadge urgency={card.urgency} />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {/* Risk indicators */}
        <CardRiskIndicators card={card} />

        {/* Description preview */}
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {dueDate && (
              <div
                className={cn(
                  'flex items-center gap-1',
                  isOverdue && 'text-destructive'
                )}
              >
                <Calendar className="h-3 w-3" />
                <span>
                  {format(dueDate, 'dd MMM', { locale: ptBR })}
                </span>
              </div>
            )}
            {card.actual_hours > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{card.actual_hours.toFixed(1)}h</span>
              </div>
            )}
          </div>

          {/* Avatar placeholder */}
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {card.owner_id ? 'U' : '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
    </CardUI>
  );
};
