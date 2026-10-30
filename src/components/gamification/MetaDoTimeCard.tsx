import React from 'react';
import { Gift, Swords, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useMetaDoTime } from '@/hooks/useMetaDoTime';
import { faltamParaMeta, percentualDaMeta } from '@/lib/gamificacao/metaDoTime';

/**
 * Meta do time da semana: o "chefao" que todo mundo ataca junto. O progresso vem dos cards entregues (mesma regra do ranking),
 * entao cada entrega de qualquer pessoa derrota um pedaco. A recompensa e texto livre definido pela direcao.
 */
export function MetaDoTimeCard() {
  const metas = useMetaDoTime();
  if (metas.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" aria-hidden /> Chefão da semana
        </CardTitle>
        <CardDescription>Meta do time: cada entrega de qualquer pessoa conta. Todo mundo ganha junto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {metas.map(m => {
          const pct = percentualDaMeta(m.atual, m.alvo);
          const falta = faltamParaMeta(m.atual, m.alvo);
          return (
            <div key={m.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold">{m.titulo}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-bold text-foreground">{m.atual}</span> de {m.alvo}
                </p>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={m.alvo}
                aria-valuenow={Math.min(m.atual, m.alvo)}
                aria-label={m.titulo}
              >
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700', m.atingida ? 'bg-success' : 'bg-primary')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                {m.atingida ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-success">
                    <Trophy className="h-3.5 w-3.5" aria-hidden /> Chefão derrotado! Meta batida
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Faltam <span className="font-semibold text-foreground">{falta}</span> {falta === 1 ? 'entrega' : 'entregas'} para derrotar o chefão
                  </span>
                )}
                {m.recompensa && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-300">
                    <Gift className="h-3.5 w-3.5" aria-hidden /> {m.recompensa}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
