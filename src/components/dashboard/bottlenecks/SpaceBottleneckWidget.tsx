import { useNavigate } from 'react-router-dom';
import { GitBranch, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SpaceBottleneck } from '@/lib/dashboard/dashboard-types';

interface SpaceBottleneckWidgetProps {
  espacos: SpaceBottleneck[];
  isLoading?: boolean;
}

/**
 * Onde o trabalho está travando.
 *
 * A barra mede o número absoluto de atrasados, porque é isso que a pessoa
 * procura ao bater o olho. Mas o insight embaixo e o tooltip usam a TAXA
 * (atrasados / abertos): um espaço com 100 cards naturalmente acumula mais
 * atrasos que um com 10, e apontá-lo pelo volume seria punir tamanho em vez
 * de identificar gargalo. Os dois números juntos evitam a leitura errada.
 */
export function SpaceBottleneckWidget({ espacos, isLoading }: SpaceBottleneckWidgetProps) {
  const navigate = useNavigate();

  const ordenados = [...espacos].sort((a, b) => b.overdueCards - a.overdueCards);
  const maior = ordenados[0]?.overdueCards ?? 0;
  const totalAtrasos = ordenados.reduce((s, e) => s + e.overdueCards, 0);
  const lider = ordenados[0];

  const concentracao = lider && totalAtrasos > 0
    ? Math.round((lider.overdueCards / totalAtrasos) * 100)
    : 0;

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <header className="mb-3 min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Gargalos por Espaço</span>
        </h2>
        <p className="text-xs text-muted-foreground">Espaços com mais cards atrasados</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      ) : totalAtrasos === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Nenhum gargalo</p>
          <p className="text-xs text-muted-foreground">Nenhum espaço acumula atrasos.</p>
        </div>
      ) : (
        <>
          <TooltipProvider>
            <ul className="space-y-2.5">
              {ordenados.slice(0, 5).map(e => {
                const largura = maior > 0 ? (e.overdueCards / maior) * 100 : 0;
                const preocupante = e.overdueRate >= 0.25 && e.overdueCards >= 3;

                return (
                  <li key={e.spaceId}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => navigate(`/space/${e.spaceId}`)}
                          className="flex w-full items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="w-28 shrink-0 truncate text-xs sm:w-32">{e.spaceName}</span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className={cn(
                                'block h-full rounded-full transition-all',
                                preocupante ? 'bg-destructive' : 'bg-amber-500',
                              )}
                              style={{ width: `${largura}%` }}
                            />
                          </span>
                          <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums">
                            {e.overdueCards}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{e.spaceName}</p>
                        <p className="text-xs">
                          {e.overdueCards} atrasados de {e.openCards} abertos
                        </p>
                        <p className="text-xs">
                          {(e.overdueRate * 100).toFixed(1)}% de atraso
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>

          {lider && concentracao >= 40 && (
            <p className="mt-4 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{lider.spaceName}</span> concentra{' '}
              {concentracao}% dos atrasos
              {lider.openCards > 0 && (
                <> — {(lider.overdueRate * 100).toFixed(0)}% dos cards abertos dele</>
              )}
              .
            </p>
          )}
        </>
      )}
    </section>
  );
}
