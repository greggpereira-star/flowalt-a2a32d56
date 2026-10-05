import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Info, ShieldAlert, UserRound, Users, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Bloco, Indicador, Variacao } from '@/components/dashboard/pecas';
import { useDashboardExecutiva } from '@/hooks/dashboard/useDashboardExecutiva';
import type { NivelDecisao } from '@/lib/dashboard/executiva-metrics';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlCurto = (v: number) =>
  Math.abs(v) >= 1000 ? `${v < 0 ? '−' : ''}R$ ${(Math.abs(v) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : brl(v);
const variacaoPct = (atual: number, anterior: number) => (anterior === 0 ? null : Math.round(((atual - anterior) / Math.abs(anterior)) * 100));

const NIVEL: Record<NivelDecisao, { icone: React.ComponentType<{ className?: string }>; faixa: string; chip: string; rotulo: string }> = {
  critico: { icone: ShieldAlert, faixa: 'border-l-red-500', chip: 'bg-red-500/10 text-red-600', rotulo: 'Crítico' },
  atencao: { icone: AlertTriangle, faixa: 'border-l-amber-500', chip: 'bg-amber-500/10 text-amber-700', rotulo: 'Atenção' },
  info: { icone: Info, faixa: 'border-l-blue-500', chip: 'bg-blue-500/10 text-blue-700', rotulo: 'Para saber' },
};

const ESTADO: Record<string, { rotulo: string; chip: string }> = {
  healthy: { rotulo: 'Saudável', chip: 'bg-emerald-500/10 text-emerald-700' },
  attention: { rotulo: 'Atenção', chip: 'bg-amber-500/10 text-amber-700' },
  critical: { rotulo: 'Crítico', chip: 'bg-red-500/10 text-red-600' },
  loss: { rotulo: 'Prejuízo', chip: 'bg-red-500/15 text-red-700' },
};

const botao =
  'inline-flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 text-[13px] font-semibold shadow-sm transition-colors hover:bg-muted/50';

export function DashboardExecutiva() {
  const navigate = useNavigate();
  const [mes, setMes] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const { resultado: r, carregando, erro } = useDashboardExecutiva(mes);

  const mover = (delta: number) => setMes(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const rotuloMes = (() => { const t = format(mes, "MMMM 'de' yyyy", { locale: ptBR }); return t.charAt(0).toUpperCase() + t.slice(1); })();
  const ehMesAtual = mes.getFullYear() === new Date().getFullYear() && mes.getMonth() === new Date().getMonth();

  const maxCliente = Math.max(1, ...(r?.carteira.itens.slice(0, 5).map(i => i.pct) ?? [1]), r?.carteira.semClientePct ?? 0);

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-4 pb-28 pt-6 sm:space-y-7 sm:px-8 sm:py-8 sm:pb-10">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">Visão executiva</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saúde financeira, carteira de clientes e decisões · {rotuloMes}
            {!ehMesAtual && ' (mês anterior ou futuro)'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
            <button type="button" onClick={() => mover(-1)} aria-label="Mês anterior" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-[13px] font-semibold capitalize">{format(mes, 'MMM yyyy', { locale: ptBR })}</span>
            <button type="button" onClick={() => mover(1)} aria-label="Próximo mês" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link to="/dashboard?visao=time" className={botao}>
            <Users className="h-4 w-4" />
            Desempenho do time
          </Link>
          <Link to="/dashboard?visao=meu" className={botao}>
            <UserRound className="h-4 w-4" />
            Meu desempenho
          </Link>
        </div>
      </header>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar os números da visão executiva.</p>
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
          {/* Indicadores financeiros */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Receita do mês"
              valor={brl(r.doMes.receita)}
              rodape={
                <div className="space-y-1">
                  <Variacao valor={variacaoPct(r.doMes.receita, r.mesAnterior.receita)} unidade="%" base="mês anterior" />
                  <p className="text-[11.5px] text-muted-foreground">
                    {brlCurto(r.doMes.recebido)} recebido · {brlCurto(r.doMes.aReceber)} a receber
                  </p>
                </div>
              }
            />
            <Indicador
              rotulo="Despesas do mês"
              valor={brl(r.doMes.despesa)}
              rodape={
                <div className="space-y-1">
                  <Variacao valor={variacaoPct(r.doMes.despesa, r.mesAnterior.despesa)} unidade="%" melhorQuandoMaior={false} base="mês anterior" />
                  <p className="text-[11.5px] text-muted-foreground">
                    {brlCurto(r.doMes.pago)} pago · {brlCurto(r.doMes.aPagar)} a pagar
                  </p>
                </div>
              }
            />
            <Indicador
              rotulo="Resultado do mês"
              valor={`${r.doMes.resultado < 0 ? '−' : ''}${brl(Math.abs(r.doMes.resultado))}`}
              tom={r.doMes.resultado < 0 ? 'perigo' : undefined}
              rodape={
                <div className="space-y-1">
                  <p className={cn('text-[12px] font-semibold', r.doMes.resultado < 0 ? 'text-red-600' : 'text-emerald-600')}>
                    margem {r.doMes.margemPct === null ? '—' : `${r.doMes.margemPct.toLocaleString('pt-BR').replace('-', '−')}%`}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">mês anterior: {brlCurto(r.mesAnterior.resultado)}</p>
                </div>
              }
            />
            <Indicador
              rotulo="Caixa previsto (90 dias)"
              valor={`${r.caixa.saldo < 0 ? '−' : '+'}${brl(Math.abs(r.caixa.saldo))}`}
              tom={r.caixa.saldo < 0 ? 'perigo' : undefined}
              rodape={
                <p className="text-[11.5px] text-muted-foreground">
                  {brlCurto(r.caixa.aReceber)} a receber · {brlCurto(r.caixa.aPagar)} a pagar
                </p>
              }
            />
          </div>

          {/* Decisões e riscos */}
          <Bloco
            titulo="Decisões e riscos"
            subtitulo="O que merece a atenção dos sócios agora, do mais grave ao menos"
            acao={
              r.decisoes.length > 0 ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-bold tabular-nums">{r.decisoes.length}</span>
              ) : undefined
            }
          >
            {r.decisoes.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 px-4 py-4 text-emerald-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-[14px] font-semibold">Nada exige decisão agora.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {r.decisoes.map(d => {
                  const n = NIVEL[d.nivel];
                  const Icone = n.icone;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => navigate(d.rota)}
                        className={cn('flex w-full items-start gap-3 rounded-xl border border-l-4 border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/40', n.faixa)}
                      >
                        <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', d.nivel === 'critico' ? 'text-red-600' : d.nivel === 'atencao' ? 'text-amber-600' : 'text-blue-600')} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold leading-snug">{d.titulo}</span>
                          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{d.descricao}</span>
                        </span>
                        <span className={cn('hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline-block', n.chip)}>{n.rotulo}</span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloco>

          {/* Resultado dos últimos 6 meses */}
          <Bloco
            titulo="Resultado dos últimos 6 meses"
            subtitulo="Receita e despesa por mês de vencimento (pago e previsto), com o resultado em linha"
            acao={
              <Link to="/financial" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
                <Wallet className="h-3.5 w-3.5" /> Financeiro ›
              </Link>
            }
          >
            <div className="h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={r.serie.map(m => ({
                    mes: format(new Date(`${m.chave}-15T12:00:00`), 'MMM', { locale: ptBR }),
                    Receita: Math.round(m.receita),
                    Despesa: Math.round(m.despesa),
                    Resultado: Math.round(m.resultado),
                  }))}
                  margin={{ left: -6, right: 4, top: 4 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : String(v))} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground) / 0.5)" />
                  <ChartTooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    formatter={(v: number) => brl(v)}
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesa" fill="#f87171" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Resultado" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Bloco>

          {/* Carteira */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bloco titulo="Concentração da receita" subtitulo="Receita já recebida nos últimos 6 meses, por cliente">
              {r.carteira.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma receita recebida no período.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {r.carteira.itens.slice(0, 5).map(i => (
                      <li key={i.clientId}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="truncate font-medium">{r.nomes.get(i.clientId) ?? 'Cliente'}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {brlCurto(i.valor)} · <strong className="text-foreground">{Math.round(i.pct)}%</strong>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full', i.pct >= 40 ? 'bg-amber-500' : 'bg-primary/80')} style={{ width: `${Math.max(3, (i.pct / maxCliente) * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                    {r.carteira.semCliente > 0 && (
                      <li>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="truncate font-medium text-muted-foreground">Sem cliente vinculado</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {brlCurto(r.carteira.semCliente)} · <strong className="text-foreground">{Math.round(r.carteira.semClientePct)}%</strong>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.max(3, (r.carteira.semClientePct / maxCliente) * 100)}%` }} />
                        </div>
                      </li>
                    )}
                  </ul>
                  <p className="mt-4 border-t border-border/50 pt-3 text-[12px] text-muted-foreground">
                    Total recebido no período: <strong className="text-foreground">{brl(r.carteira.total)}</strong>
                  </p>
                </>
              )}
            </Bloco>

            <Bloco
              titulo="Saúde da carteira"
              subtitulo={`${r.saudeCarteira.total} clientes ativos, pela pontuação de receita, custo e margem`}
              acao={
                <Link to="/clients" className="text-[13px] font-semibold text-primary hover:underline">
                  Clientes ›
                </Link>
              }
            >
              <div className="grid grid-cols-4 gap-2 text-center">
                {(['healthy', 'attention', 'critical', 'loss'] as const).map(k => (
                  <div key={k} className="rounded-xl bg-muted/50 p-2.5">
                    <p className="text-xl font-bold tabular-nums">{r.saudeCarteira.contagem[k]}</p>
                    <p className="text-[11px] text-muted-foreground">{ESTADO[k].rotulo}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-1.5">
                {r.saudeCarteira.piores.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/clients?client=${c.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{c.nome}</span>
                      <span className="text-[12px] tabular-nums text-muted-foreground">pontuação {Math.round(c.score)}</span>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', ESTADO[c.estado]?.chip)}>{ESTADO[c.estado]?.rotulo ?? c.estado}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Bloco>
          </div>

          {/* Operação em resumo */}
          <Bloco
            titulo="Entrega e operação"
            subtitulo="Resumo dos últimos 30 dias. A análise completa está no Desempenho do time"
            acao={
              <Link to="/dashboard?visao=time" className="text-[13px] font-semibold text-primary hover:underline">
                Ver o time ›
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-border/60 p-3.5">
                <p className="text-[12px] font-medium text-muted-foreground">Entregas</p>
                <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums">{r.operacao.atual.concluidos}</p>
                <div className="mt-2"><Variacao valor={r.operacao.atual.concluidos - r.operacao.anterior.concluidos} /></div>
              </div>
              <div className="rounded-xl border border-border/60 p-3.5">
                <p className="text-[12px] font-medium text-muted-foreground">No prazo</p>
                <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums">
                  {r.operacao.atual.noPrazoPct ?? '—'}
                  {r.operacao.atual.noPrazoPct !== null && <span className="text-base font-semibold text-muted-foreground">%</span>}
                </p>
                <div className="mt-2">
                  <Variacao
                    valor={r.operacao.atual.noPrazoPct !== null && r.operacao.anterior.noPrazoPct !== null ? r.operacao.atual.noPrazoPct - r.operacao.anterior.noPrazoPct : null}
                    unidade=" pp"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-3.5">
                <p className="text-[12px] font-medium text-muted-foreground">Tempo de entrega</p>
                <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums">
                  {r.operacao.atual.leadMediana ?? '—'}
                  {r.operacao.atual.leadMediana !== null && <span className="text-base font-semibold text-muted-foreground"> d</span>}
                </p>
                <div className="mt-2">
                  <Variacao
                    valor={r.operacao.atual.leadMediana !== null && r.operacao.anterior.leadMediana !== null ? r.operacao.atual.leadMediana - r.operacao.anterior.leadMediana : null}
                    unidade=" d"
                    melhorQuandoMaior={false}
                  />
                </div>
              </div>
              <div className={cn('rounded-xl border p-3.5', r.operacao.atrasados > 0 ? 'border-red-300/70' : 'border-border/60')}>
                <p className="text-[12px] font-medium text-muted-foreground">Em aberto</p>
                <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums">{r.operacao.abertos}</p>
                <p className={cn('mt-2 text-[12px] font-semibold', r.operacao.atrasados > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {r.operacao.atrasados} {r.operacao.atrasados === 1 ? 'atrasado' : 'atrasados'}
                </p>
              </div>
            </div>
          </Bloco>
        </>
      )}
    </div>
  );
}

export default DashboardExecutiva;
