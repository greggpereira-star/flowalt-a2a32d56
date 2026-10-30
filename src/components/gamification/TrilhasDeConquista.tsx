import React from 'react';
import { CalendarCheck, Flame, MessageCircle, PackageCheck, Target, Timer, Trophy, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConquistasNiveis } from '@/hooks/useConquistasNiveis';
import { liderDaTrilha, nomeDoNivel, progressoDaTrilha, resumoDoTime, TRILHAS, type ChaveDaTrilha } from '@/lib/gamificacao/conquistas';
import type { Jogador } from '@/components/gamification/v2/useGamificationData';
import { cn } from '@/lib/utils';

const ICONES: Record<ChaveDaTrilha, LucideIcon> = {
  entregador: PackageCheck,
  pontual: Timer,
  voz: MessageCircle,
  constante: Flame,
  dia_completo: CalendarCheck,
  missoes: Target,
  campeao: Trophy,
};

// cor do nivel: sem nivel = apagado
const COR_DO_NIVEL = [
  'bg-muted text-muted-foreground',
  'bg-amber-700/15 text-amber-800 dark:text-amber-300',
  'bg-slate-400/25 text-slate-700 dark:text-slate-200',
  'bg-yellow-400/30 text-yellow-800 dark:text-yellow-300',
];

/**
 * Trilhas de conquista: cada uma mede um numero vitalicio (entregas, comentarios, dias...) e sobe de bronze para prata e ouro.
 * E reconhecimento, nao pontos: nao mexe no score, no XP nem na temporada.
 */
export function TrilhasDeConquista({ jogadores, meuId }: { jogadores: Jogador[]; meuId?: string }) {
  const { linhas, carregando, indisponivel } = useConquistasNiveis();
  if (carregando || indisponivel || linhas.length === 0) return null;

  const minhas = linhas.filter(l => l.user_id === meuId);
  const totalDeNiveis = TRILHAS.length * 3;
  const meusNiveis = minhas.reduce((t, l) => t + l.nivel, 0);
  const time = resumoDoTime(linhas);
  const nomeDe = (id: string) => (jogadores.find(j => j.user_id === id)?.name ?? 'Alguém').split(' ')[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Trilhas de conquista</CardTitle>
            <CardDescription className="mt-1 max-w-xl">Cada trilha mede um número de sempre e sobe de bronze para prata e ouro. É reconhecimento: não mexe no ranking nem nos pontos.</CardDescription>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              <span className="text-sm font-bold text-foreground">{meusNiveis}</span> de {totalDeNiveis} níveis seus
            </p>
            <p>
              Time: {time.ouro} ouro · {time.prata} prata · {time.bronze} bronze
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRILHAS.map(t => {
          const minha = minhas.find(l => l.trilha === t.chave);
          const valor = minha?.valor ?? 0;
          const p = progressoDaTrilha(valor, minha?.limites ?? [1, 2, 3]);
          const lider = liderDaTrilha(linhas, t.chave);
          const Icone = ICONES[t.chave];
          return (
            <div key={t.chave} className="rounded-xl border p-3">
              <div className="flex items-center gap-2.5">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', COR_DO_NIVEL[p.nivel])}>
                  <Icone className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.nome}</p>
                  <p className="truncate text-xs text-muted-foreground" title={t.descricao}>{t.descricao}</p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', COR_DO_NIVEL[p.nivel])}>{nomeDoNivel(p.nivel)}</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct} aria-label={`Progresso em ${t.nome}`}>
                <div className={cn('h-full rounded-full', p.nivel === 3 ? 'bg-yellow-500' : 'bg-primary')} style={{ width: `${p.pct}%` }} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{valor}</span>
                  {p.proximoAlvo != null ? ` de ${p.proximoAlvo} ${t.unidade}` : ` ${t.unidade} · nível máximo`}
                </span>
                {lider && <span>líder: {lider.user_id === meuId ? 'você' : nomeDe(lider.user_id)} ({lider.valor})</span>}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
