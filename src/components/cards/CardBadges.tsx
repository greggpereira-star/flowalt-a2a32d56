import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Flag } from 'lucide-react';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import { CARD_STATUS_LABELS } from '@/lib/cards/cardStatusLabels';
import { useStatusLabel } from '@/hooks/useStatusLabel';
import { PROPERTY_BADGE_BASE } from './card-detail/badgeStyles';

export const statusConfig: Record<CardStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  backlog: { label: CARD_STATUS_LABELS.backlog, color: 'text-status-backlog', bgColor: 'bg-status-backlog/10', dotColor: 'bg-status-backlog' },
  briefing: { label: CARD_STATUS_LABELS.briefing, color: 'text-status-briefing', bgColor: 'bg-status-briefing/10', dotColor: 'bg-status-briefing' },
  todo: { label: CARD_STATUS_LABELS.todo, color: 'text-status-todo', bgColor: 'bg-status-todo/10', dotColor: 'bg-status-todo' },
  in_progress: { label: CARD_STATUS_LABELS.in_progress, color: 'text-status-in-progress', bgColor: 'bg-status-in-progress/10', dotColor: 'bg-status-in-progress' },
  review: { label: CARD_STATUS_LABELS.review, color: 'text-status-review', bgColor: 'bg-status-review/10', dotColor: 'bg-status-review' },
  approved: { label: CARD_STATUS_LABELS.approved, color: 'text-status-approved', bgColor: 'bg-status-approved/10', dotColor: 'bg-status-approved' },
  delivered: { label: CARD_STATUS_LABELS.delivered, color: 'text-status-delivered', bgColor: 'bg-status-delivered/10', dotColor: 'bg-status-delivered' },
  archived: { label: CARD_STATUS_LABELS.archived, color: 'text-status-archived', bgColor: 'bg-status-archived/10', dotColor: 'bg-status-archived' },
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
  showChevron?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showChevron = false }) => {
  const config = statusConfig[status];
  // O nome vem do workspace; o config aqui guarda so cor e icone.
  const rotulo = useStatusLabel();
  const label = rotulo(status);
  return (
    <span
      data-testid="status-badge"
      title={label}
      className={cn(
        PROPERTY_BADGE_BASE,
        'gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80',
        config.bgColor,
        config.color,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dotColor)} />
      <span className="whitespace-nowrap">{label}</span>
      {showChevron && <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />}
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
      data-testid="urgency-badge"
      title={config.label}
      className={cn(
        PROPERTY_BADGE_BASE,
        'rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        className
      )}
    >
      <Flag className="h-3 w-3 flex-shrink-0" />
      <span className="whitespace-nowrap">{config.label}</span>
    </span>
  );
};
