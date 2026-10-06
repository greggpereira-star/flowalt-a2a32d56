import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ChevronDown, Layers, RotateCcw, UserRound, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSpaces } from '@/hooks/useSpaces';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { Bloco, Indicador, Variacao, cartao } from '@/components/dashboard/pecas';
import { AprovacoesDoClienteBloco } from '@/components/approvals/AprovacoesDoClienteBloco';
import { useDashboardCoordenacao, type PeriodoCoordenacao } from '@/hooks/dashboard/useDashboardCoordenacao';
import type { NivelCapacidade } from '@/lib/dashboard/coordenacao-metrics';

const PERIODOS: { id: PeriodoCoordenacao; rotulo: string }[] = [
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
];

const NIVEL: Record<NivelCapacidade, { rotulo: string; chip: string; barra: string }> = {
  ok: { rotulo: 'Dentro da capacidade', chip: 'bg-emerald-500/10 text-emerald-700', barra: 'bg-emerald-500' },
  atencao: { rotulo: 'Acima da média', chip: 'bg-amber-500/10 text-amber-700', barra: 'bg-amber-500' },
  estouro: { rotulo: 'Bem acima da média', chip: 'bg-red-500/10 text-red-600', barra: 'bg-red-500' },
};

const iniciais = (nome: string) =>
  nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const corDoPrazo = (pct: number | null) =>
  pct === null ? 'text-muted-foreground' : pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';

export function DashboardCoordenacao() {
  const navigate = useNavigate();
  const { canViewPartners } = usePermissions();
  const { data: espacos } = useSpaces();
  const [periodo, setPeriodo] = useState<PeriodoCoordenacao>('30d');
  const [espacoId, setEspacoId] = useState<string | undefined>();
  const { resultado: r, pessoas, carregando, erro } = useDashboardCoordenacao(periodo, espacoId);

  const espacoAtual = espacos?.find(e => e.id === espacoId);
  const nomeEspaco = (id: string) => (id === '__sem__' ? 'Sem espaço' : espacos?.find(e => e.id === id)?.name ?? 'Espaço');
  const corEspaco = (id: string) => espacos?.find(e => e.id === id)?.color ?? 'hsl(var(--muted-foreground))';

  const linhasPessoas = (r?.pessoas ?? []).filter(p => pessoas.has(p.chave) && (p.concluidos > 0 || p.abertos > 0));
  const mediaFila = linhasPessoas.length ? linhasPessoas.reduce((s, p) => s + p.abertos, 0) / linhasPessoas.length : 0;
  const maxFila = Math.max(1, ...linhasPessoas.map(p => p.abertos));
  const sobrecarregado = (abertos: number) => abertos >= 4 && abertos >= mediaFila * 1.5;

  const delta = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? a - b : null);
  const maiorEtapa = Math.max(0, ...(r?.tempoPorEtapa.map(e => e.mediana ?? 0) ?? [0]));
  const maxPrazos = Math.max(1, r?.capacidade.porSemana ?? 0, ...(r?.capacidade.proximas.map(p => p.prazos) ?? [0]));
  const semMovimento = !r || r.tempoPorEtapa.every(e => e.mediana === null);

  const botao =
    'inline-flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 text-[13px] font-semibold shadow-sm transition-colors hover:bg-muted/50';

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-4 pb-28 pt-6 sm:space-y-7 sm:px-8 sm:py-8 sm:pb-10">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">Desempenho do time</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Como o time está entregando e para onde vai a capacidade
            {r ? ` · ${r.rotuloPeriodo}` : ''}
            {espacoAtual ? ` · ${espacoAtual.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Período" className="flex gap-1 rounded-xl border border-border/60 bg-card p-1">
            {PERIODOS.map(p => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                  periodo === p.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={botao}>
                <Layers className="h-4 w-4" />
                <span className="max-w-[9rem] truncate">{espacoAtual?.name ?? 'Todos os espaços'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto rounded-xl p-1.5">
              <DropdownMenuItem className="rounded-lg" onClick={() => setEspacoId(undefined)}>
                Todos os espaços
              </DropdownMenuItem>
              {(espacos ?? []).map(e => (
                <DropdownMenuItem key={e.id} className="rounded-lg" onClick={() => setEspacoId(e.id)}>
                  {e.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canViewPartners && (
            <Link to="/dashboard" className={botao}>
              <Wallet className="h-4 w-4" />
              Visão executiva
            </Link>
          )}
          <Link to="/dashboard?visao=meu" className={botao}>
            <UserRound className="h-4 w-4" />
            Meu desempenho
          </Link>
        </div>
      </header>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar os indicadores do time.</p>
          <p className="mt-0.5 text-muted-foreground">Atualize a página em instantes.</p>
        </div>
      )}

      {carregando || !r ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Ponteiro para a operação do dia: o detalhe e a ação ficam na Coordenação */}
          {r.atrasados > 0 && (
            <Link
              to="/coordination"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-[13px] transition-colors hover:bg-muted/70"
            >
              <span className="text-muted-foreground">
                Agora na fila: <strong className="text-foreground">{r.abertos} em aberto</strong>
                , <strong className="text-red-600">{r.atrasados} {r.atrasados === 1 ? 'atrasado' : 'atrasados'}</strong>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                Tratar na Coordenação <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          )}

          {/* Indicadores */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Entregas do time"
              valor={r.time.concluidos}
              rodape={<Variacao valor={r.time.concluidos - r.anterior.concluidos} />}
            />
            <Indicador
              rotulo="No prazo"
              valor={r.time.noPrazoPct ?? '—'}
              unidade={r.time.noPrazoPct !== null ? '%' : undefined}
              rodape={
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <Variacao valor={delta(r.time.noPrazoPct, r.anterior.noPrazoPct)} unidade=" pp" />
                  {r.time.atrasoMediana !== null && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      atraso mediano {r.time.atrasoMediana} d
                    </span>
                  )}
                </div>
              }
            />
            <Indicador
              rotulo="Tempo de entrega"
              valor={r.time.leadMediana ?? '—'}
              unidade={r.time.leadMediana !== null ? 'dias' : undefined}
              rodape={
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <Variacao valor={delta(r.time.leadMediana, r.anterior.leadMediana)} unidade=" d" melhorQuandoMaior={false} />
                  {r.time.leadP90 !== null && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      90% em até {r.time.leadP90} d
                    </span>
                  )}
                </div>
              }
            />
            <Indicador
              rotulo="Saldo da fila"
              valor={`${r.saldo > 0 ? '+' : r.saldo < 0 ? '−' : ''}${Math.abs(r.saldo)}`}
              rodape={
                <div className="space-y-0.5">
                  <p className="text-[12px] text-muted-foreground">
                    entraram {r.time.criados} · saíram {r.time.concluidos}
                  </p>
                  <p className={cn('text-[12px] font-semibold', r.saldo > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {r.saldo > 0 ? 'a fila está crescendo' : r.saldo < 0 ? 'a fila está diminuindo' : 'fila estável'}
                  </p>
                </div>
              }
            />
          </div>

          <AprovacoesDoClienteBloco />

          {/* Tendência */}
          <Bloco titulo="Entradas, saídas e prazo por semana" subtitulo="Cards criados e entregues, e quantos das entregas saíram no prazo (últimas 8 semanas)">
            {r.semanal.every(s => s.criados === 0 && s.concluidos === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem movimento nas últimas 8 semanas.</p>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={r.semanal.map(s => ({ semana: s.rotulo, Criados: s.criados, Entregues: s.concluidos, 'No prazo (%)': s.noPrazoPct }))}
                    margin={{ left: -14, right: -10, top: 4 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="semana" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="n" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="n" dataKey="Criados" fill="hsl(var(--muted-foreground) / 0.35)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="n" dataKey="Entregues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="pct" type="monotone" dataKey="No prazo (%)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Bloco>

          {/* Pessoas */}
          <Bloco
            titulo="Desempenho por pessoa"
            subtitulo="Cards em que cada pessoa é responsável. Clique para ver o desempenho individual"
          >
            {linhasPessoas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem entregas nem fila no período.</p>
            ) : (
              <>
                {/* Celular: um cartão por pessoa */}
                <ul className="space-y-3 md:hidden">
                  {linhasPessoas.map(p => {
                    const info = pessoas.get(p.chave)!;
                    return (
                      <li key={p.chave}>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard?visao=meu&pessoa=${p.chave}`)}
                          className="w-full rounded-xl border border-border/60 p-3.5 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={info.avatar ?? undefined} />
                              <AvatarFallback className="text-xs">{iniciais(info.nome)}</AvatarFallback>
                            </Avatar>
                            <p className="min-w-0 flex-1 truncate font-semibold">{info.nome}</p>
                            {sobrecarregado(p.abertos) && (
                              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600">sobrecarga</span>
                            )}
                          </div>
                          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                            <div><p className="text-lg font-bold tabular-nums">{p.concluidos}</p><p className="text-[11px] text-muted-foreground">entregues</p></div>
                            <div><p className={cn('text-lg font-bold tabular-nums', corDoPrazo(p.noPrazoPct))}>{p.noPrazoPct === null ? '—' : `${p.noPrazoPct}%`}</p><p className="text-[11px] text-muted-foreground">no prazo</p></div>
                            <div><p className="text-lg font-bold tabular-nums">{p.abertos}</p><p className="text-[11px] text-muted-foreground">na fila</p></div>
                            <div><p className={cn('text-lg font-bold tabular-nums', p.atrasados > 0 && 'text-red-600')}>{p.atrasados}</p><p className="text-[11px] text-muted-foreground">atrasados</p></div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Desktop: tabela */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">Pessoa</th>
                        <th className="px-2 text-right font-medium">Entregues</th>
                        <th className="px-2 text-right font-medium">No prazo</th>
                        <th className="px-2 text-right font-medium">Tempo de entrega</th>
                        <th className="px-2 font-medium">Na fila</th>
                        <th className="pl-2 text-right font-medium">Atrasados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasPessoas.map(p => {
                        const info = pessoas.get(p.chave)!;
                        return (
                          <tr
                            key={p.chave}
                            onClick={() => navigate(`/dashboard?visao=meu&pessoa=${p.chave}`)}
                            className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/40"
                          >
                            <td className="py-2.5 pr-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={info.avatar ?? undefined} />
                                  <AvatarFallback className="text-[11px]">{iniciais(info.nome)}</AvatarFallback>
                                </Avatar>
                                <span className="font-semibold">{info.nome}</span>
                              </div>
                            </td>
                            <td className="px-2 text-right font-bold tabular-nums">{p.concluidos}</td>
                            <td className={cn('px-2 text-right font-bold tabular-nums', corDoPrazo(p.noPrazoPct))}>
                              {p.noPrazoPct === null ? '—' : `${p.noPrazoPct}%`}
                            </td>
                            <td className="px-2 text-right tabular-nums text-muted-foreground">{p.leadMediana === null ? '—' : `${p.leadMediana} d`}</td>
                            <td className="px-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                  <div className={cn('h-full rounded-full', sobrecarregado(p.abertos) ? 'bg-red-500' : 'bg-primary')} style={{ width: `${(p.abertos / maxFila) * 100}%` }} />
                                </div>
                                <span className="w-5 tabular-nums">{p.abertos}</span>
                                {sobrecarregado(p.abertos) && (
                                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600">sobrecarga</span>
                                )}
                              </div>
                            </td>
                            <td className={cn('pl-2 text-right font-semibold tabular-nums', p.atrasados > 0 && 'text-red-600')}>{p.atrasados}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Bloco>

          {/* Onde o tempo vai + retrabalho */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bloco titulo="Onde o tempo vai" subtitulo="Mediana de dias que os cards ficaram em cada etapa antes de sair dela">
              {semMovimento ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum card mudou de etapa no período.</p>
              ) : (
                <ul className="space-y-3.5">
                  {r.tempoPorEtapa.map(e => {
                    const maior = e.mediana !== null && e.mediana === maiorEtapa && maiorEtapa > 0;
                    return (
                      <li key={e.slug}>
                        <div className="mb-1 flex items-baseline justify-between text-[13px]">
                          <span className={cn('font-medium', maior && 'text-amber-700')}>{e.nome}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {e.mediana === null ? 'sem saídas' : `${e.mediana} d`}
                            {e.n > 0 && <span className="ml-1.5 text-[11px] opacity-70">({e.n})</span>}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', maior ? 'bg-amber-500' : 'bg-primary/70')}
                            style={{ width: `${e.mediana === null || maiorEtapa === 0 ? 0 : Math.max(5, (e.mediana / maiorEtapa) * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Bloco>

            <Bloco titulo="Voltas no fluxo" subtitulo="Cards que precisaram voltar para uma etapa anterior">
              {r.voltas.cardsComMovimento === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum card mudou de etapa no período.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end gap-3">
                    <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums">
                      {r.voltas.pct}
                      <span className="text-base font-semibold text-muted-foreground">%</span>
                    </p>
                    <p className="pb-1 text-[13px] leading-snug text-muted-foreground">
                      {r.voltas.cardsComVolta} de {r.voltas.cardsComMovimento} cards que mudaram de etapa voltaram ao menos uma vez
                    </p>
                  </div>
                  {r.voltas.principais.length > 0 ? (
                    <ul className="space-y-1.5">
                      {r.voltas.principais.map(v => (
                        <li key={`${v.de}>${v.para}`} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-[13px]">
                          <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate font-medium">{v.de} → {v.para}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums">{v.n}×</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-emerald-600">Nenhuma volta no período.</p>
                  )}
                </div>
              )}
            </Bloco>
          </div>

          {/* Capacidade */}
          <Bloco
            titulo="Capacidade das próximas 4 semanas"
            subtitulo={`Prazos que vencem em cada semana contra a média de ${r.capacidade.porSemana.toLocaleString('pt-BR')} ${r.capacidade.porSemana === 1 ? 'entrega' : 'entregas'} por semana (últimas 8 semanas)`}
          >
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {r.capacidade.proximas.map(s => (
                <li key={s.rotulo} className="rounded-xl border border-border/60 p-3.5">
                  <p className="text-[12px] font-medium text-muted-foreground">{s.rotulo}</p>
                  <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums">{s.prazos}</p>
                  <p className="text-[11.5px] text-muted-foreground">{s.prazos === 1 ? 'prazo' : 'prazos'}</p>
                  <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', NIVEL[s.nivel].barra)} style={{ width: `${(s.prazos / maxPrazos) * 100}%` }} />
                  </div>
                  <span className={cn('mt-2.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold', NIVEL[s.nivel].chip)}>{NIVEL[s.nivel].rotulo}</span>
                </li>
              ))}
            </ul>
            {r.capacidade.atrasadosNaFila > 0 && (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                Fora desta conta: <strong className="text-red-600">{r.capacidade.atrasadosNaFila} {r.capacidade.atrasadosNaFila === 1 ? 'card já atrasado' : 'cards já atrasados'}</strong>, que também disputam a capacidade.
              </p>
            )}
          </Bloco>

          {/* Por espaço */}
          <Bloco
            titulo="Por espaço"
            subtitulo="Onde a entrega é mais (ou menos) confiável"
            acao={
              <Link to="/analytics" className="text-[13px] font-semibold text-primary hover:underline">
                Análise completa ›
              </Link>
            }
          >
            {r.espacos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Espaço</th>
                      <th className="px-2 text-right font-medium">Entregues</th>
                      <th className="px-2 text-right font-medium">No prazo</th>
                      <th className="hidden px-2 text-right font-medium sm:table-cell">Tempo de entrega</th>
                      <th className="px-2 text-right font-medium">Na fila</th>
                      <th className="pl-2 text-right font-medium">Atrasados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.espacos.map(e => (
                      <tr key={e.chave} className="border-b last:border-0">
                        <td className="py-2.5 pr-2">
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corEspaco(e.chave) }} />
                            {nomeEspaco(e.chave)}
                          </span>
                        </td>
                        <td className="px-2 text-right font-bold tabular-nums">{e.concluidos}</td>
                        <td className={cn('px-2 text-right font-bold tabular-nums', corDoPrazo(e.noPrazoPct))}>{e.noPrazoPct === null ? '—' : `${e.noPrazoPct}%`}</td>
                        <td className="hidden px-2 text-right tabular-nums text-muted-foreground sm:table-cell">{e.leadMediana === null ? '—' : `${e.leadMediana} d`}</td>
                        <td className="px-2 text-right tabular-nums">{e.abertos}</td>
                        <td className={cn('pl-2 text-right font-semibold tabular-nums', e.atrasados > 0 && 'text-red-600')}>{e.atrasados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloco>
        </>
      )}
    </div>
  );
}

export default DashboardCoordenacao;
