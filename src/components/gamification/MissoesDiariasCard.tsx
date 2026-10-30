import React from 'react';
import { CalendarCheck, CheckCircle2, Circle, Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMissoesDiarias } from '@/hooks/useMissoesDiarias';
import { BONUS_DIA_COMPLETO, diaCompleto, fraseDoProgresso, MISSOES_DIARIAS, percentualDoDia } from '@/lib/gamificacao/diarias';
import { cn } from '@/lib/utils';

/**
 * Missoes de hoje: tres acoes simples (mover, comentar, entregar) e um bonus por fechar o dia. So em dia util.
 * Os pontos vao para a temporada, nao para o score nem para o nivel.
 */
export function MissoesDiariasCard() {
  const { hoje, carregando, indisponivel } = useMissoesDiarias();
  if (carregando || indisponivel || !hoje) return null;

  const completo = diaCompleto(hoje);
  const pct = percentualDoDia(hoje);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" aria-hidden /> Missões de hoje
            </CardTitle>
            <CardDescription className="mt-1">
              {hoje.fim_de_semana
                ? 'Hoje é fim de semana: sem missões diárias. Elas voltam na segunda.'
                : 'Três ações simples por dia útil, mais um bônus por fechar o dia. Pontos de temporada.'}
            </CardDescription>
          </div>
          {!hoje.fim_de_semana && (
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', completo ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-primary/10 text-primary')}>
              {hoje.pontos_hoje} de {hoje.pontos_max} pts hoje
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hoje.fim_de_semana && (
          <>
            <ul className="space-y-1.5">
              {MISSOES_DIARIAS.map(m => {
                const feita = hoje[m.chave];
                return (
                  <li key={m.chave} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm', feita && 'border-emerald-500/30 bg-emerald-500/5')}>
                    {feita ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="feita" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="pendente" />}
                    <span className={cn('flex-1', feita && 'text-muted-foreground line-through')}>{m.titulo}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">+{m.pontos}</span>
                  </li>
                );
              })}
              <li className={cn('flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2 text-sm', completo && 'border-emerald-500/40 bg-emerald-500/5')}>
                <Flame className={cn('h-4 w-4 shrink-0', completo ? 'text-emerald-600' : 'text-amber-500')} aria-hidden />
                <span className="flex-1 font-medium">Dia completo</span>
                <span className="shrink-0 text-xs font-semibold tabular-nums">+{BONUS_DIA_COMPLETO}</span>
              </li>
            </ul>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={hoje.pontos_max} aria-valuenow={hoje.pontos_hoje} aria-label="Pontos de hoje">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{fraseDoProgresso(hoje)}</p>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Este mês: <span className="font-semibold text-foreground">{hoje.dias_completos_mes}</span> {hoje.dias_completos_mes === 1 ? 'dia completo' : 'dias completos'} ·{' '}
          <span className="font-semibold text-foreground">{hoje.pontos_mes}</span> pts em missões diárias
          {!hoje.fim_de_semana && hoje.equipe_total > 0 && <> · {hoje.equipe_completa} de {hoje.equipe_total} do time já fecharam o dia</>}
        </p>
      </CardContent>
    </Card>
  );
}
