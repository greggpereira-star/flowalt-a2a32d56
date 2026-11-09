import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Swords } from 'lucide-react';
import { useMetaDoTime } from '@/hooks/useMetaDoTime';
import { useMissoesDiarias } from '@/hooks/useMissoesDiarias';
import { MISSOES_DIARIAS } from '@/lib/gamificacao/diarias';
import { faltamParaMeta, percentualDaMeta } from '@/lib/gamificacao/metaDoTime';
import { cn } from '@/lib/utils';

/**
 * Metas e missoes na Inicio: o objetivo coletivo da semana (meta do time) e as 3 missoes de hoje de quem esta logado.
 * Liga a tela de trabalho ao jogo da equipe sem ocupar a pagina da Gamificacao. Some se nao houver nada a mostrar.
 */
export function MetasEMissoesCard() {
  const metas = useMetaDoTime();
  const { hoje, indisponivel } = useMissoesDiarias();
  const temMissoes = !!hoje && !indisponivel && !hoje.fim_de_semana;
  if (metas.length === 0 && !temMissoes) return null;

  const meta = metas[0];
  return (
    <section aria-labelledby="metas-e-missoes" className="rounded-2xl border border-border/60 bg-card p-[21px] shadow-sm">
      <header className="mb-[13px] flex items-center gap-2.5">
        <Swords className="h-7 w-7 rounded-lg bg-primary/10 p-1.5 text-primary" strokeWidth={1.75} aria-hidden />
        <h2 id="metas-e-missoes" className="text-[15px] font-bold tracking-tight">
          Metas e missões
        </h2>
        <Link to="/gamification" className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
          Gamificação ›
        </Link>
      </header>

      {meta && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">{meta.titulo}</p>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
              <span className="font-bold text-foreground">{meta.atual}</span> de {meta.alvo}
            </p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={meta.alvo} aria-valuenow={Math.min(meta.atual, meta.alvo)} aria-label={meta.titulo}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentualDaMeta(meta.atual, meta.alvo)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {faltamParaMeta(meta.atual, meta.alvo) > 0 ? `Faltam ${faltamParaMeta(meta.atual, meta.alvo)} para bater a meta da semana.` : 'Meta da semana batida.'}
            {meta.recompensa ? ` Recompensa: ${meta.recompensa}.` : ''}
          </p>
        </div>
      )}

      {temMissoes && hoje && (
        <div className={cn(meta && 'mt-[21px] border-t border-border/60 pt-[13px]')}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">Missões de hoje</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {hoje.pontos_hoje} de {hoje.pontos_max} pts
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {MISSOES_DIARIAS.map(m => {
              const feita = hoje[m.chave];
              return (
                <li
                  key={m.chave}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', feita ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}
                >
                  {feita ? <CheckCircle2 className="h-3.5 w-3.5" aria-label="feita" /> : <Circle className="h-3.5 w-3.5" aria-label="pendente" />}
                  {m.titulo.replace(' (15+ caracteres)', '')}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
