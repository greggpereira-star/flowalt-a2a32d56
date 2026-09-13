import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getCardStatusLabel } from '@/lib/cards/cardStatusLabels';
import type { OverdueCard } from '@/lib/dashboard/dashboard-types';

interface OverdueCardsWidgetProps {
  cards: OverdueCard[];
  isLoading?: boolean;
  limite?: number;
}

/**
 * Fila de cards atrasados.
 *
 * A lista chega já ordenada por score, não por data (ver calcularScoreAtraso):
 * um card de 2 dias marcado como crítico aparece antes de um de 5 dias sem
 * urgência, porque é assim que a coordenação prioriza na prática. Ordenar só
 * por data trataria os dois como equivalentes.
 */
export function OverdueCardsWidget({ cards, isLoading, limite = 5 }: OverdueCardsWidgetProps) {
  const navigate = useNavigate();

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span className="truncate">Cards Atrasados</span>
        </h2>
        {cards.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/tasks?filter=overdue')}
            className="shrink-0 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todos
          </button>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : cards.length === 0 ? (
        // Zero atrasados é resultado, não vazio: a mensagem afirma isso para
        // não parecer bloco que falhou ao carregar.
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Nenhum card atrasado</p>
          <p className="text-xs text-muted-foreground">Todos os prazos estão em dia.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cards.slice(0, limite).map(card => (
            <li key={card.cardId}>
              <button
                type="button"
                onClick={() => navigate(`/tasks?card=${card.cardId}`)}
                className="flex w-full items-start justify-between gap-2 rounded-lg border border-border/50 p-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{card.title}</span>
                  <span className="block truncate text-[11px] text-destructive">
                    {card.overdueDays === 0
                      ? 'Vence hoje, já passou do horário'
                      : `Venceu há ${card.overdueDays} ${card.overdueDays === 1 ? 'dia' : 'dias'}`}
                    {' · '}
                    <span className="text-muted-foreground">
                      {format(new Date(card.dueDate), "d 'de' MMMM", { locale: ptBR })}
                    </span>
                  </span>
                </span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {getCardStatusLabel(card.status)}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
