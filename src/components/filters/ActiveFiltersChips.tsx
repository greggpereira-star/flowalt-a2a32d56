import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FilterQuery } from '@/hooks/useCardFilters';

interface ActiveFiltersChipsProps {
  query: FilterQuery;
  onRemoveFilter: (category: keyof FilterQuery, key?: string) => void;
  onClearAll: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'A Fazer',
  doing: 'Em Progresso',
  review: 'Em Revisão',
  done: 'Concluído',
  blocked: 'Bloqueado',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const DUE_LABELS: Record<string, string> = {
  today: 'Hoje',
  week: 'Esta Semana',
  overdue: 'Atrasados',
  none: 'Sem Data',
  range: 'Período',
};

export const ActiveFiltersChips: React.FC<ActiveFiltersChipsProps> = ({
  query,
  onRemoveFilter,
  onClearAll,
}) => {
  const chips: { label: string; category: keyof FilterQuery; key?: string }[] = [];

  if (query.search) {
    chips.push({ label: `Busca: "${query.search}"`, category: 'search' });
  }

  if (query.status?.card_status?.length) {
    query.status.card_status.forEach(s => {
      chips.push({ label: STATUS_LABELS[s] || s, category: 'status', key: s });
    });
  }

  if (query.status?.blocked_only) {
    chips.push({ label: 'Apenas Bloqueados', category: 'status', key: 'blocked_only' });
  }

  if (query.priority?.urgency?.length) {
    query.priority.urgency.forEach(u => {
      chips.push({ label: `Prioridade: ${URGENCY_LABELS[u] || u}`, category: 'priority', key: u });
    });
  }

  if (query.time?.due) {
    chips.push({ label: `Prazo: ${DUE_LABELS[query.time.due] || query.time.due}`, category: 'time', key: 'due' });
  }

  if (query.people?.assignee?.length) {
    chips.push({ label: `Responsável (${query.people.assignee.length})`, category: 'people', key: 'assignee' });
  }

  if (query.people?.involved?.length) {
    chips.push({ label: `Envolvidos (${query.people.involved.length})`, category: 'people', key: 'involved' });
  }

  if (query.context?.client_id?.length) {
    chips.push({ label: `Clientes (${query.context.client_id.length})`, category: 'context', key: 'client_id' });
  }

  if (query.quality?.briefing_pending) {
    chips.push({ label: 'Briefing Pendente', category: 'quality', key: 'briefing_pending' });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => onRemoveFilter(chip.category, chip.key)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      {chips.length > 1 && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
          Limpar todos
        </Button>
      )}
    </div>
  );
};
