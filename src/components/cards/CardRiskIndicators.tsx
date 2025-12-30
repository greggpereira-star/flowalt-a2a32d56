import React from 'react';
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isPast, isToday, differenceInDays, differenceInHours } from 'date-fns';
import type { Card } from '@/hooks/useCards';

interface CardRiskIndicatorsProps {
  card: Card;
  className?: string;
}

export const CardRiskIndicators: React.FC<CardRiskIndicatorsProps> = ({ 
  card, 
  className 
}) => {
  const indicators = [];
  const dueDate = card.due_date ? new Date(card.due_date) : null;
  const now = new Date();

  // Overdue check
  if (dueDate && isPast(dueDate) && !isToday(dueDate) && card.status !== 'delivered') {
    const daysOverdue = differenceInDays(now, dueDate);
    indicators.push({
      type: 'overdue',
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      label: `Atrasado há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
      tooltip: 'Este card está atrasado. Considere repriorizar ou ajustar a data de entrega.',
    });
  }

  // Due today
  if (dueDate && isToday(dueDate) && card.status !== 'delivered') {
    const hoursLeft = differenceInHours(dueDate, now);
    indicators.push({
      type: 'due_today',
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      label: hoursLeft > 0 ? `Vence em ${hoursLeft}h` : 'Vence hoje',
      tooltip: 'Este card vence hoje. Garanta que está em progresso.',
    });
  }

  // Time overrun (actual > estimated)
  if (card.estimated_hours && card.actual_hours > card.estimated_hours) {
    const overrun = ((card.actual_hours - card.estimated_hours) / card.estimated_hours * 100).toFixed(0);
    indicators.push({
      type: 'time_overrun',
      icon: TrendingUp,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      label: `+${overrun}% do tempo`,
      tooltip: `O tempo gasto (${card.actual_hours.toFixed(1)}h) excedeu a estimativa (${card.estimated_hours}h). Revise o escopo.`,
    });
  }

  // Briefing pending for cards in progress
  if (!card.briefing_completed && ['in_progress', 'review'].includes(card.status)) {
    indicators.push({
      type: 'briefing_pending',
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      label: 'Sem briefing',
      tooltip: 'Este card está em execução sem briefing completo. Isso pode gerar retrabalho.',
    });
  }

  // High urgency without due date
  if (['high', 'critical'].includes(card.urgency) && !card.due_date) {
    indicators.push({
      type: 'no_deadline',
      icon: AlertTriangle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      label: 'Sem prazo',
      tooltip: 'Card prioritário sem data de entrega definida. Adicione uma deadline.',
    });
  }

  if (indicators.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {indicators.map((indicator) => (
        <Tooltip key={indicator.type}>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                indicator.bgColor,
                indicator.color
              )}
            >
              <indicator.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{indicator.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">{indicator.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
