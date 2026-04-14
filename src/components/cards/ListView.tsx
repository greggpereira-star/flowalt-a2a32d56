import React from 'react';
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

interface ListViewProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
}

export const ListView: React.FC<ListViewProps> = ({ cards, onCardClick }) => {
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
            <TableHead className="w-[40%]">Título</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Urgência</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead className="text-right">Responsável</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.map((card) => {
            const dueDate = card.due_date ? new Date(card.due_date) : null;

            return (
              <TableRow
                key={card.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onCardClick(card)}
              >
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
                      <span>{format(dueDate, 'dd/MM/yy', { locale: ptBR })}</span>
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
