import React, { useMemo, useState } from 'react';
import { extractPlainText } from '@/components/ui/rich-text-viewer';
import { TaskCard } from './TaskCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, UrgencyBadge } from './CardBadges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card } from '@/hooks/useCards';
import { cn } from '@/lib/utils';
import { CaixaSelecao } from './SelecionavelCard';
import { useSelecaoDeCards } from '@/hooks/useCardSelection';

interface ListViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
}

export const ListView: React.FC<ListViewProps> = ({ cards, onCardClick }) => {
  const sel = useSelecaoDeCards();
  const [dueDateDirection, setDueDateDirection] = useState<'asc' | 'desc'>('asc');
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      if (!a.due_date && !b.due_date) return (a.sort_order || 0) - (b.sort_order || 0);
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      const comparison = dateA === dateB ? (a.sort_order || 0) - (b.sort_order || 0) : dateA - dateB;
      return dueDateDirection === 'asc' ? comparison : -comparison;
    });
  }, [cards, dueDateDirection]);

  const ordemIds = sortedCards.map(c => c.id);
  const marcadosVisiveis = sel ? ordemIds.filter(i => sel.tem(i)).length : 0;
  const todosMarcados = ordemIds.length > 0 && marcadosVisiveis === ordemIds.length;

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">Nenhum card encontrado</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {sel && (
              <TableHead className="w-12 pr-0">
                <CaixaSelecao
                  marcado={todosMarcados}
                  parcial={marcadosVisiveis > 0 && !todosMarcados}
                  rotulo={todosMarcados ? 'Desmarcar todos os cards' : 'Selecionar todos os cards'}
                  onChange={() => (todosMarcados ? sel.desmarcar(ordemIds) : sel.marcar(ordemIds))}
                />
              </TableHead>
            )}
            <TableHead className="w-[40%]">Título</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Urgência</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => setDueDateDirection((current) => current === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted transition-colors"
                title="Ordenar por data e horário"
              >
                Prazo {dueDateDirection === 'asc' ? '↑' : '↓'}
              </button>
            </TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead className="text-right">Responsável</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCards.map((card) => {
            const dueDate = card.due_date ? new Date(card.due_date) : null;

            return (
              <TableRow
                key={card.id}
                className={cn('cursor-pointer hover:bg-muted/50 transition-colors', sel?.tem(card.id) && 'bg-primary/5 hover:bg-primary/10')}
                data-state={sel?.tem(card.id) ? 'selected' : undefined}
                onClick={(e) => {
                  if (sel && (sel.ativa || e.shiftKey || e.metaKey || e.ctrlKey)) {
                    sel.alternar(card.id, { intervalo: e.shiftKey ? ordemIds : undefined });
                    return;
                  }
                  onCardClick(card);
                }}
              >
                {sel && (
                  <TableCell
                    className="w-12 pr-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      sel.alternar(card.id, { intervalo: e.shiftKey ? ordemIds : undefined });
                    }}
                  >
                    <CaixaSelecao marcado={sel.tem(card.id)} rotulo={`${sel.tem(card.id) ? 'Desmarcar' : 'Selecionar'} o card ${card.title}`} />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{card.title}</span>
                    {card.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {extractPlainText(card.description)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={card.status} />
                </TableCell>
                <TableCell>
                  <UrgencyBadge urgency={card.urgency} />
                </TableCell>
                <TableCell>
                  {dueDate ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(dueDate, 'dd/MM/yy HH:mm', { locale: ptBR })}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {card.actual_hours > 0 ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{card.actual_hours.toFixed(1)}h</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Avatar className="h-6 w-6 ml-auto">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {card.owner_id ? 'U' : '?'}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
