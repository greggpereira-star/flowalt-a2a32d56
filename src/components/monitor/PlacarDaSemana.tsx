import React from 'react';
import { Swords } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGamificationData } from '@/components/gamification/v2/useGamificationData';
import { iniciais } from '@/components/gamification/v2/Sections';
import { useMetaDoTime } from '@/hooks/useMetaDoTime';
import { percentualDaMeta } from '@/lib/gamificacao/metaDoTime';
import { cn } from '@/lib/utils';

// Posicoes: ouro, prata, bronze (mesma ideia do podio da Gamificacao, em tons que leem bem no fundo escuro do monitor).
const FUNDO = ['bg-yellow-400', 'bg-slate-300', 'bg-amber-600'];
const ANEL = ['ring-yellow-400', 'ring-slate-300', 'ring-amber-600'];

/**
 * Faixa do Modo monitor: top 3 dos ultimos 7 dias e a meta do time. Serve para o jogo aparecer onde o time ja olha o dia todo,
 * sem ninguem precisar abrir a tela de Gamificacao.
 */
export function PlacarDaSemana() {
  const { jogadores } = useGamificationData(7);
  const metas = useMetaDoTime();
  const top = jogadores.filter(j => j.participa && j.score > 0).slice(0, 3);
  if (top.length === 0 && metas.length === 0) return null;

  return (
    <section aria-label="Placar da semana" className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-white/10 px-6 py-3">
      {top.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Placar · 7 dias</h2>
          <ol className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {top.map((j, i) => (
              <li key={j.user_id} className="flex items-center gap-2">
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-slate-950', FUNDO[i])} aria-label={`${i + 1}º lugar`}>
                  {i + 1}
                </span>
                <Avatar className={cn('h-7 w-7 ring-2', ANEL[i])}>
                  {j.avatar_url && <AvatarImage src={j.avatar_url} alt="" />}
                  <AvatarFallback className="bg-slate-700 text-[10px]">{iniciais(j.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">{j.name.split(' ')[0]}</span>
                <span className="text-sm tabular-nums text-slate-300">{j.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {metas.map(m => (
        <div key={m.id} className="flex min-w-[18rem] flex-1 items-center gap-3 sm:ml-auto sm:max-w-md">
          <Swords className={cn('h-5 w-5 shrink-0', m.atingida ? 'text-emerald-400' : 'text-sky-400')} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-200">{m.atingida ? 'Chefão derrotado!' : m.titulo}</span>
              <span className="shrink-0 tabular-nums text-slate-300">
                {m.atual}/{m.alvo}
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={m.alvo}
              aria-valuenow={Math.min(m.atual, m.alvo)}
              aria-label={m.titulo}
            >
              <div className={cn('h-full rounded-full transition-[width] duration-700', m.atingida ? 'bg-emerald-400' : 'bg-sky-400')} style={{ width: `${percentualDaMeta(m.atual, m.alvo)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
