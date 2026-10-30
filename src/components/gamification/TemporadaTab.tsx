import React from 'react';
import { CalendarDays, Gift, Info, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useHallDaFama, useTemporada } from '@/hooks/useTemporada';
import {
  diasRestantesNaTemporada,
  PONTOS_DA_TEMPORADA as P,
  pontosParaAlcancar,
  rotuloDeDiasRestantes,
  rotuloDoMes,
  type PodioDeTemporada,
} from '@/lib/gamificacao/temporada';
import { iniciais } from '@/components/gamification/v2/Sections';
import { cn } from '@/lib/utils';

const POSICAO = [
  'bg-yellow-400 text-yellow-950',
  'bg-slate-300 text-slate-900',
  'bg-amber-600 text-amber-50',
];

function Foto({ nome, url, className }: { nome: string | null; url: string | null; className?: string }) {
  return (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={nome ?? ''} />}
      <AvatarFallback>{iniciais(nome ?? '?')}</AvatarFallback>
    </Avatar>
  );
}

const primeiroNome = (n: string | null) => (n ?? 'Alguém').split(' ')[0];

/** Temporada do mes (campeonato com pontos sem teto) e Hall da Fama. */
export function TemporadaTab() {
  const { user } = useAuth();
  const { linhas, mes, oficial, premio, carregando } = useTemporada();
  const hall = useHallDaFama();
  const lider = linhas[0]?.pontos ?? 0;
  const dias = diasRestantesNaTemporada();

  // Hall da Fama agrupado por temporada, e quadro de trofeus (titulos de campeao por pessoa)
  const porMes = new Map<string, PodioDeTemporada[]>();
  hall.forEach(h => porMes.set(h.mes, [...(porMes.get(h.mes) ?? []), h]));
  const titulos = new Map<string, { nome: string | null; avatar: string | null; n: number }>();
  hall.filter(h => h.posicao === 1).forEach(h => titulos.set(h.user_id, { nome: h.nome, avatar: h.avatar_url, n: (titulos.get(h.user_id)?.n ?? 0) + 1 }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" aria-hidden /> Temporada de {rotuloDoMes(mes)}
              </CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                {oficial
                  ? 'Campeonato do mês: os pontos não têm teto e zeram todo dia 1º. Seu nível (XP) não muda.'
                  : 'Temporada de ensaio: esta tabela é para ver como funciona e não vale troféu. A primeira temporada oficial começa em 1º de novembro.'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {rotuloDeDiasRestantes(dias)}
              </span>
              {oficial && premio && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:text-amber-300">
                  <Gift className="h-3.5 w-3.5" aria-hidden /> Prêmio: {premio}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {carregando ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : linhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há pontos nesta temporada. A primeira entrega, comentário ou movimentação já entra na tabela.</p>
          ) : (
            <ol className="space-y-2">
              {linhas.map((l, i) => {
                const eu = l.user_id === user?.id;
                const naFrente = i > 0 ? linhas[i - 1].pontos : null;
                const falta = pontosParaAlcancar(l.pontos, naFrente);
                return (
                  <li key={l.user_id} className={cn('rounded-xl border p-3', eu && 'border-primary/40 bg-primary/5')}>
                    <div className="flex items-center gap-3">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', POSICAO[i] ?? 'bg-muted text-muted-foreground')} aria-label={`${l.posicao}º lugar`}>
                        {l.posicao}
                      </span>
                      <Foto nome={l.nome} url={l.avatar_url} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-semibold">
                            {l.nome ?? 'Membro'}
                            {eu && <span className="ml-1.5 text-xs font-medium text-primary">você</span>}
                          </p>
                          <p className="shrink-0 text-lg font-bold tabular-nums">{l.pontos.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full bg-primary" style={{ width: `${lider > 0 ? Math.max(2, Math.round((l.pontos / lider) * 100)) : 0}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {l.entregas} {l.entregas === 1 ? 'entrega' : 'entregas'} · {l.comentarios} comentários · {l.dias_acao} dias com ação
                          {i > 0 && falta > 0 && <span className="ml-1 font-medium text-foreground">· a {falta} pts de passar {primeiroNome(linhas[i - 1].nome)}</span>}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <details className="group rounded-lg border bg-muted/20 p-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
              <Info className="h-4 w-4" aria-hidden /> Como os pontos são contados
            </summary>
            <ul className="mt-3 grid gap-1.5 text-muted-foreground sm:grid-cols-2">
              <li><span className="font-semibold text-foreground">{P.entrega} pts</span> por entrega no prazo (<span className="font-semibold text-foreground">{P.entregaAtrasada}</span> se atrasada)</li>
              <li><span className="font-semibold text-foreground">{P.comentario} pts</span> por comentário</li>
              <li><span className="font-semibold text-foreground">{P.movimentacao} pts</span> por movimentação de etapa (até {P.movimentacaoMaxPorDia} por dia)</li>
              <li><span className="font-semibold text-foreground">{P.diaComAcao} pts</span> por dia útil com ação</li>
              <li><span className="font-semibold text-foreground">{P.hora} pts</span> por hora no cronômetro</li>
              <li className="sm:col-span-2"><span className="font-semibold text-foreground">até +12 pts por dia útil</span> pelas missões diárias (mover, comentar, entregar e fechar o dia), na aba Ranking</li>
              <li className="sm:col-span-2"><span className="font-semibold text-foreground">+3 a +10 pts</span> por missão da semana (cobrar e destravar cards parados), na aba Ranking</li>
            </ul>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" aria-hidden /> Hall da Fama
          </CardTitle>
          <CardDescription>Os três primeiros de cada temporada oficial. Troféu é para sempre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {porMes.size === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma temporada encerrada ainda. A primeira oficial é a de novembro e fecha em 1º de dezembro.</p>
          ) : (
            <>
              {titulos.size > 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Quadro de troféus">
                  {[...titulos.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, t]) => (
                    <span key={id} className="inline-flex items-center gap-2 rounded-full border bg-yellow-400/10 px-3 py-1 text-sm font-medium">
                      <Foto nome={t.nome} url={t.avatar} className="h-6 w-6" /> {primeiroNome(t.nome)}
                      <span className="inline-flex items-center gap-1 text-yellow-700 dark:text-yellow-400"><Trophy className="h-3.5 w-3.5" aria-hidden /> ×{t.n}</span>
                    </span>
                  ))}
                </div>
              )}
              {[...porMes.entries()].map(([m, podio]) => (
                <div key={m} className="rounded-xl border p-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold capitalize">{rotuloDoMes(m)}</p>
                    {podio[0]?.premio && <p className="text-xs text-muted-foreground">Prêmio: {podio[0].premio}</p>}
                  </div>
                  <ol className="flex flex-wrap gap-x-6 gap-y-2">
                    {podio.map(p => (
                      <li key={p.user_id} className="flex items-center gap-2">
                        <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold', POSICAO[p.posicao - 1])} aria-label={`${p.posicao}º lugar`}>{p.posicao}</span>
                        <Foto nome={p.nome} url={p.avatar_url} className="h-7 w-7" />
                        <span className="text-sm font-medium">{primeiroNome(p.nome)}</span>
                        <span className="text-sm tabular-nums text-muted-foreground">{p.pontos.toLocaleString('pt-BR')}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
