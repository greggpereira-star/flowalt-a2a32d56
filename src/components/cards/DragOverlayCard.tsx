import React from 'react';
import { Card as CardUI, CardContent, CardHeader } from '@/components/ui/card';
import { UrgencyBadge } from './CardBadges';
import { Calendar, Clock, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card } from '@/hooks/useCards';

interface DragOverlayCardProps {
  card: Card;
}

export const DragOverlayCard: React.FC<DragOverlayCardProps> = ({ card }) => {
  const dueDate = card.due_date ? new Date(card.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered';

  return (
    <div 
      className="w-[280px] pointer-events-none"
      style={{
        transform: 'rotate(-2deg) scale(1.03)',
        transformOrigin: 'center center',
        filter: 'drop-shadow(0 25px 25px rgba(0,0,0,0.15))',
      }}
    >
      <CardUI
        className={cn(
          'border-2 border-primary/40 bg-card backdrop-blur-sm',
          'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]',
          'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
          isOverdue && 'border-destructive/50'
        )}
      >
        {/* Drag handle indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 rounded-t-lg" />
        
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <h3 className="text-sm font-medium leading-tight line-clamp-2">
                {card.title}
              </h3>
            </div>
            <UrgencyBadge urgency={card.urgency} />
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {card.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {card.description}
            </p>
          )}

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
          </div>
        </CardContent>
      </CardUI>
    </div>
  );
};
