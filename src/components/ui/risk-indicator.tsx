import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, TrendingDown, Users, Zap } from 'lucide-react';

interface RiskIndicatorProps {
  type: 'delay' | 'overload' | 'bottleneck' | 'risk' | 'urgent';
  level: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  className?: string;
}

const INDICATOR_CONFIG = {
  delay: {
    icon: Clock,
    label: 'Atraso',
    colors: {
      low: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      medium: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      high: 'bg-red-500/10 text-red-600 border-red-500/20',
      critical: 'bg-red-600/20 text-red-700 border-red-600/30',
    },
  },
  overload: {
    icon: TrendingDown,
    label: 'Sobrecarga',
    colors: {
      low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      medium: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      high: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
      critical: 'bg-red-600/20 text-red-700 border-red-600/30',
    },
  },
  bottleneck: {
    icon: Users,
    label: 'Gargalo',
    colors: {
      low: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      critical: 'bg-red-600/20 text-red-700 border-red-600/30',
    },
  },
  risk: {
    icon: AlertTriangle,
    label: 'Risco',
    colors: {
      low: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      critical: 'bg-red-600/20 text-red-700 border-red-600/30',
    },
  },
  urgent: {
    icon: Zap,
    label: 'Urgente',
    colors: {
      low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      critical: 'bg-red-600/20 text-red-700 border-red-600/30 animate-pulse',
    },
  },
};

export function RiskIndicator({ type, level, message, className }: RiskIndicatorProps) {
  const config = INDICATOR_CONFIG[type];
  const Icon = config.icon;
  const colorClass = config.colors[level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'gap-1 cursor-help transition-colors',
            colorClass,
            className
          )}
        >
          <Icon className="h-3 w-3" />
          <span className="text-xs">{config.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Utility function to determine risk level based on metrics
export function calculateDelayRisk(dueDate: Date, now: Date = new Date()): {
  level: RiskIndicatorProps['level'];
  daysOverdue: number;
} {
  const diffMs = now.getTime() - dueDate.getTime();
  const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 0) {
    return { level: 'low', daysOverdue: 0 };
  } else if (daysOverdue <= 2) {
    return { level: 'medium', daysOverdue };
  } else if (daysOverdue <= 5) {
    return { level: 'high', daysOverdue };
  } else {
    return { level: 'critical', daysOverdue };
  }
}

export function calculateCapacityRisk(
  allocatedHours: number,
  capacityHours: number
): RiskIndicatorProps['level'] {
  if (capacityHours === 0) return 'low';
  
  const utilization = (allocatedHours / capacityHours) * 100;

  if (utilization <= 70) return 'low';
  if (utilization <= 90) return 'medium';
  if (utilization <= 100) return 'high';
  return 'critical';
}
