import React from 'react';
import { cn } from '@/lib/utils';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

export const statusConfig: Record<CardStatus, { label: string; color: string; bgColor: string }> = {
  backlog: { label: 'Backlog', color: 'text-status-backlog', bgColor: 'bg-status-backlog/10' },
  briefing: { label: 'Briefing', color: 'text-status-briefing', bgColor: 'bg-status-briefing/10' },
  todo: { label: 'A Fazer', color: 'text-status-todo', bgColor: 'bg-status-todo/10' },
  in_progress: { label: 'Em Produção', color: 'text-status-in-progress', bgColor: 'bg-status-in-progress/10' },
  review: { label: 'Revisão', color: 'text-status-review', bgColor: 'bg-status-review/10' },
  approved: { label: 'Aprovado', color: 'text-status-approved', bgColor: 'bg-status-approved/10' },
  delivered: { label: 'Entregue', color: 'text-status-delivered', bgColor: 'bg-status-delivered/10' },
  archived: { label: 'Arquivado', color: 'text-status-archived', bgColor: 'bg-status-archived/10' },
};

export const urgencyConfig: Record<CardUrgency, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Baixa', color: 'text-urgency-low', bgColor: 'bg-urgency-low/10' },
  medium: { label: 'Média', color: 'text-urgency-medium', bgColor: 'bg-urgency-medium/10' },
  high: { label: 'Alta', color: 'text-urgency-high', bgColor: 'bg-urgency-high/10' },
  critical: { label: 'Crítica', color: 'text-urgency-critical', bgColor: 'bg-urgency-critical/10' },
};

interface StatusBadgeProps {
  status: CardStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
};

interface UrgencyBadgeProps {
  urgency: CardUrgency;
  className?: string;
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ urgency, className }) => {
  const config = urgencyConfig[urgency];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
};
