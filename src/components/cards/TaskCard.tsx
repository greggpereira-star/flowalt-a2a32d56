import React from 'react';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { Card as CardUI, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UrgencyBadge } from './CardBadges';
import { CardRiskIndicators } from './CardRiskIndicators';
import { RiskRadar } from './RiskRadar';
import { CardQuickActions } from './CardQuickActions';
import { CardAssignees, type Assignee } from './CardAssignees';
import { VisibilityIcon } from '@/components/governance';
import { Calendar, Clock, Building2, BanknoteIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

interface TaskCardProps {
  card: Card;
  onClick?: () => void;
  isDragging?: boolean;
  isBlocked?: boolean;
  ownerUtilization?: number;
  clientName?: string;
  clientColor?: string;
  assignees?: Assignee[];
  onStatusChange?: (status: CardStatus) => void;
  onUrgencyChange?: (urgency: CardUrgency) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  showQuickActions?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  card, 
  onClick, 
  isDragging,
  isBlocked = false,
  ownerUtilization = 0,
  clientName,
  clientColor,
  assignees = [],
  onStatusChange,
  onUrgencyChange,
  onDuplicate,
  onDelete,
  showQuickActions = true,
}) => {
  const dueDate = card.due_date ? new Date(card.due_date) : null;
  const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered';
  const isBillable = !!card.client_id;

  const hasQuickActions = showQuickActions && onStatusChange && onUrgencyChange && onDuplicate && onDelete;

  return (
    <CardUI
      className={cn(
        'cursor-pointer transition-all hover:shadow-md group relative',
        isDragging && 'shadow-lg ring-2 ring-primary/50 rotate-2',
        isOverdue && 'border-destructive/50',
        isBlocked && 'border-purple-500/50'
      )}
      onClick={onClick}
    >
      {/* Client indicator bar */}
      {clientColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
          style={{ backgroundColor: clientColor }}
        />
      )}

      {/* Visibility indicator for restricted cards */}
      {card.visibility === 'restricted' && (
        <div className="absolute top-2 left-2 z-10">
          <VisibilityIcon level="restricted" />
        </div>
      )}

      {/* Top right actions area */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* Quick actions button */}
        {hasQuickActions && (
          <CardQuickActions
            card={card}
            onStatusChange={onStatusChange}
            onUrgencyChange={onUrgencyChange}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        )}
        
        {/* Risk Radar */}
        <RiskRadar 
          card={card} 
          isBlocked={isBlocked} 
          ownerUtilization={ownerUtilization}
          compact 
        />
      </div>

      <CardHeader className={cn("p-3 pb-2 pr-12", clientColor && "pt-4")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {card.title}
          </h3>
          <UrgencyBadge urgency={card.urgency} />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {/* Client Badge or Non-billable indicator */}
        {clientName ? (
          <Badge 
            variant="outline" 
            className="text-[10px] h-5 gap-1 max-w-full"
            style={clientColor ? { 
              borderColor: `${clientColor}40`,
              backgroundColor: `${clientColor}10`,
              color: clientColor 
            } : undefined}
          >
            <Building2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{clientName}</span>
          </Badge>
        ) : (
          <Badge 
            variant="outline" 
            className="text-[10px] h-5 gap-1 text-muted-foreground border-muted"
          >
            <BanknoteIcon className="h-2.5 w-2.5" />
            Não faturável
          </Badge>
        )}

        {/* Risk indicators */}
        <CardRiskIndicators card={card} />

        {/* Description preview */}
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {extractPlainText(card.description)}
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

          {/* Assignees avatars */}
          <CardAssignees assignees={assignees} maxVisible={2} size="sm" />
        </div>
      </CardContent>
    </CardUI>
  );
};
