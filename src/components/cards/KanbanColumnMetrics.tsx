import React from 'react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Clock, Users, TrendingUp } from 'lucide-react';
import type { Card } from '@/hooks/useCards';

interface KanbanColumnMetricsProps {
  cards: Card[];
  className?: string;
}

export const KanbanColumnMetrics: React.FC<KanbanColumnMetricsProps> = ({
  cards,
  className,
}) => {
  // Calculate metrics
  const totalCards = cards.length;
  const totalActualHours = cards.reduce((sum, c) => sum + (c.actual_hours || 0), 0);
  const totalEstimatedHours = cards.reduce((sum, c) => sum + (c.estimated_hours || 0), 0);
  const uniqueOwners = new Set(cards.map(c => c.owner_id).filter(Boolean)).size;

  // Calculate efficiency
  const efficiency = totalEstimatedHours > 0 
    ? Math.round((totalActualHours / totalEstimatedHours) * 100) 
    : null;

  if (totalCards === 0) return null;

  return (
    <div className={cn('flex items-center gap-2 text-[10px] text-muted-foreground', className)}>
      {/* Total Hours */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 cursor-help">
            <Clock className="h-3 w-3" />
            <span>{totalActualHours.toFixed(1)}h</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">Tempo nesta coluna</p>
            <p>Horas registradas: {totalActualHours.toFixed(1)}h</p>
            {totalEstimatedHours > 0 && (
              <p>Estimado: {totalEstimatedHours.toFixed(1)}h</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Owners count */}
      {uniqueOwners > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-0.5 cursor-help">
              <Users className="h-3 w-3" />
              <span>{uniqueOwners}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{uniqueOwners} pessoa{uniqueOwners > 1 ? 's' : ''} trabalhando</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Efficiency indicator */}
      {efficiency !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'flex items-center gap-0.5 cursor-help',
              efficiency > 100 && 'text-orange-500',
              efficiency <= 100 && 'text-green-500'
            )}>
              <TrendingUp className="h-3 w-3" />
              <span>{efficiency}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>
              {efficiency <= 100 
                ? 'Dentro do estimado'
                : `Excedendo em ${efficiency - 100}%`}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
