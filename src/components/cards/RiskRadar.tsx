import React from 'react';
import { cn } from '@/lib/utils';
import { Radar, AlertTriangle, Clock, Lock, TrendingUp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isPast, isToday, differenceInDays } from 'date-fns';
import type { Card } from '@/hooks/useCards';

interface RiskRadarProps {
  card: Card;
  isBlocked?: boolean;
  ownerUtilization?: number;
  className?: string;
  compact?: boolean;
}

interface RiskFactor {
  type: 'delay' | 'blocked' | 'capacity';
  level: 1 | 2 | 3 | 4;
  label: string;
  description: string;
}

const calculateRiskLevel = (
  card: Card,
  isBlocked: boolean,
  ownerUtilization: number
): { level: 1 | 2 | 3 | 4; factors: RiskFactor[] } => {
  const factors: RiskFactor[] = [];
  
  // 1. Delay Risk
  if (card.due_date && card.status !== 'delivered') {
    const dueDate = new Date(card.due_date);
    const now = new Date();
    const daysUntilDue = differenceInDays(dueDate, now);
    
    if (isPast(dueDate) && !isToday(dueDate)) {
      const daysOverdue = differenceInDays(now, dueDate);
      factors.push({
        type: 'delay',
        level: daysOverdue > 3 ? 4 : daysOverdue > 1 ? 3 : 2,
        label: 'Atrasado',
        description: `${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} de atraso`,
      });
    } else if (isToday(dueDate)) {
      factors.push({
        type: 'delay',
        level: 2,
        label: 'Vence hoje',
        description: 'Prazo final é hoje',
      });
    } else if (daysUntilDue <= 2 && daysUntilDue > 0) {
      factors.push({
        type: 'delay',
        level: 1,
        label: 'Prazo próximo',
        description: `Vence em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}`,
      });
    }
  }
  
  // 2. Blocked Risk
  if (isBlocked) {
    factors.push({
      type: 'blocked',
      level: 3,
      label: 'Bloqueado',
      description: 'Aguardando dependência ser concluída',
    });
  }
  
  // 3. Capacity Risk
  if (ownerUtilization > 0) {
    if (ownerUtilization > 120) {
      factors.push({
        type: 'capacity',
        level: 4,
        label: 'Sobrecarga crítica',
        description: `Responsável em ${ownerUtilization}% da capacidade`,
      });
    } else if (ownerUtilization > 100) {
      factors.push({
        type: 'capacity',
        level: 3,
        label: 'Acima da capacidade',
        description: `Responsável em ${ownerUtilization}% da capacidade`,
      });
    } else if (ownerUtilization > 80) {
      factors.push({
        type: 'capacity',
        level: 2,
        label: 'Capacidade alta',
        description: `Responsável em ${ownerUtilization}% da capacidade`,
      });
    }
  }
  
  // Calculate overall level (max of all factors)
  const maxLevel = factors.length > 0 
    ? Math.max(...factors.map(f => f.level)) as 1 | 2 | 3 | 4
    : 1;
  
  // Bump level if multiple risks
  const finalLevel = factors.length >= 2 && maxLevel < 4 
    ? (Math.min(maxLevel + 1, 4) as 1 | 2 | 3 | 4) 
    : maxLevel;
  
  return { level: finalLevel, factors };
};

const getRiskColor = (level: 1 | 2 | 3 | 4) => {
  switch (level) {
    case 1: return 'text-success border-success/30 bg-success/10';
    case 2: return 'text-warning border-warning/30 bg-warning/10';
    case 3: return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    case 4: return 'text-destructive border-destructive/30 bg-destructive/10';
  }
};

const getRiskLabel = (level: 1 | 2 | 3 | 4) => {
  switch (level) {
    case 1: return 'Baixo';
    case 2: return 'Médio';
    case 3: return 'Alto';
    case 4: return 'Crítico';
  }
};

const getFactorIcon = (type: RiskFactor['type']) => {
  switch (type) {
    case 'delay': return Clock;
    case 'blocked': return Lock;
    case 'capacity': return TrendingUp;
  }
};

export const RiskRadar: React.FC<RiskRadarProps> = ({
  card,
  isBlocked = false,
  ownerUtilization = 0,
  className,
  compact = false,
}) => {
  const { level, factors } = calculateRiskLevel(card, isBlocked, ownerUtilization);
  
  // Don't show if no risks
  if (factors.length === 0) return null;
  
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full border transition-all',
              getRiskColor(level),
              className
            )}
          >
            <Radar className="h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Risco {getRiskLabel(level)}
            </div>
            <div className="space-y-1">
              {factors.map((factor, idx) => {
                const Icon = getFactorIcon(factor.type);
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <Icon className="h-3 w-3 opacity-70" />
                    <span>{factor.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium',
              getRiskColor(level)
            )}
          >
            <Radar className="h-3.5 w-3.5" />
            <span>Risco {getRiskLabel(level)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-medium text-sm">Fatores de Risco</div>
            <div className="space-y-1.5">
              {factors.map((factor, idx) => {
                const Icon = getFactorIcon(factor.type);
                return (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5 mt-0.5 opacity-70 shrink-0" />
                    <div>
                      <span className="font-medium">{factor.label}:</span>{' '}
                      <span className="opacity-80">{factor.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
