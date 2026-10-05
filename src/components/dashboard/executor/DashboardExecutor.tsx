import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Flame,
  Megaphone,
  Minus,
  Trophy,
  Users,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getCardStatusLabel } from '@/lib/cards/cardStatusLabels';
import { useGamificationData } from '@/components/gamification/v2/useGamificationData';
import { useDashboardExecutor, type PeriodoExecutor } from '@/hooks/dashboard/useDashboardExecutor';
import type { CardStatus } from '@/lib/supabase';

const PERIODOS: { id: PeriodoExecutor; rotulo: string }[] = [
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
];

const cartao = 'rounded-2xl border border-border/60 bg-card shadow-sm';

// ---------------------------------------------------------------------------
// peças
// ---------------------------------------------------------------------------
function Variacao({ valor, unidade = '', melhorQuandoMaior = true }: { valor: number | null; unidade?: string; melhorQuandoMaior?: boolean }) {
  if (valor === null) return <span className="text-xs text-muted-foreground">sem base de comparação</span>;
  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> igual ao período anterior
      </span>
    );
  }
  const subiu = valor > 0;
  const bom = subiu === melhorQuandoMaior;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', bom ? 'text-emerald-600' : 'text-red-600')}>
      <Seta className="h-3 w-3" />
      {subiu ? '+' : '−'}
      {Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
      {unidade} vs período anterior
    </span>
  );
}

function Indicador({
  rotulo,
  valor,
  unidade,
  rodape,
  tom,
}: {
  rotulo: string;
  valor: React.ReactNode;
  unidade?: string;
  rodape: React.ReactNode;
  tom?: 'perigo';
}) {
  return (
    <div className={cn(cartao, 'flex flex-col gap-1 p-5', tom === 'perigo' && 'border-red-300/70')}>
      <p className="text-[13px] font-medium text-muted-foreground">{rotulo}</p>
      <p className={cn('text-[32px] font-extrabold leading-none tracking-tight tabular-nums', tom === 'perigo' && 'text-red-600')}>
        {valor}
        {unidade && <span className="ml-1 text-base font-semibold text-muted-foreground">{unidade}</span>}
      </p>
      <div className="mt-2 border-t border-border/50 pt-2">{rodape}</div>
    </div>
  );
}

function Bloco({ titulo, subtitulo, children, className, acao }: { titulo: string; subtitulo?: string; children: React.ReactNode; className?: string; acao?: React.ReactNode }) {
  return (
    <section className={cn(cartao, 'p-5', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

const rotuloDoPrazo = (diasAtraso: number, atrasado: boolean) => {
  if (atrasado) return diasAtraso <= 0 ? 'venceu hoje' : `${diasAtraso} d de atraso`;
  const faltam = Math.abs(diasAtraso);
  if (faltam <= 0) return 'hoje';
  if (faltam === 1) return 'amanhã';
  return `em ${faltam} dias`;
};

// ---------------------------------------------------------------------------
// tela
// ---------------------------------------------------------------------------
export function DashboardExecutor({ podeVerGeral, pessoaId }: { podeVerGeral: boolean; pessoaId?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoExecutor>('30d');
  const { resultado: r, horas, nomesClientes, carregando, erro } = useDashboardExecutor(periodo, pessoaId);
  const { eu: euLogado, jogadores } = useGamificationData(30);
  const { data: membros } = useWorkspaceMembers();
  const verOutra = !!pessoaId && pessoaId !== user?.id;
  const eu = verOutra ? jogadores.find(j => j.user_id === pessoaId) ?? null : euLogado;
  const t = (meu: string, outra: string) => (verOutra ? outra : meu);
  const nomeDe = (id: string) => {
    const m = membros?.find(x => x.user_id === id);
    return m?.profile?.full_name || m?.profile?.email || 'Membro';
  };

  const primeiroNome = verOutra
    ? nomeDe(pessoaId!).split(' ')[0]
    : (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';

  const noRanking = jogadores.filter(j => j.participa).length;
  const maxEtapa = Math.max(1, ...(r?.porEtapa.map(e => e.n) ?? [1]));
  const maxCliente = Math.max(1, ...(r?.porCliente.map(c => c.n) ?? [1]));

  const deltaEntregas = r ? r.meu.concluidos - r.meuAnterior.concluidos : null;
  const deltaPrazo = r && r.meu.noPrazoPct !== null && r.meuAnterior.noPrazoPct !== null ? r.meu.noPrazoPct - r.meuAnterior.noPrazoPct : null;
  const deltaLead = r && r.meu.leadMediana !== null && r.meuAnterior.leadMediana !== null ? r.meu.leadMediana - r.meuAnterior.leadMediana : null;

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-4 pb-28 pt-6 sm:space-y-7 sm:px-8 sm:py-8 sm:pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">
            {verOutra ? `Desempenho de ${primeiroNome}` : 'Meu desempenho'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {verOutra
              ? `Só os cards em que ${primeiroNome} é responsável`
              : `${primeiroNome ? `${primeiroNome}, ` : ''}só os cards em que você é responsável`}
            {r ? ` · ${r.rotuloPeriodo}` : ''}
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
          {podeVerGeral && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 text-[13px] font-semibold shadow-sm transition-colors hover:bg-muted/50"
                >
                  <Users className="h-4 w-4" />
                  <span className="max-w-[9rem] truncate">{verOutra ? nomeDe(pessoaId!) : 'Escolher pessoa'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 w-60 overflow-y-auto rounded-xl p-1.5">
                {user?.id && (
                  <DropdownMenuItem className="rounded-lg" onClick={() => navigate('/dashboard?visao=meu')}>
                    Eu mesmo
                  </DropdownMenuItem>
                )}
                {(membros ?? [])
                  .filter(m => m.user_id !== user?.id)
                  .map(m => (
                    <DropdownMenuItem key={m.user_id} className="rounded-lg" onClick={() => navigate(`/dashboard?visao=meu&pessoa=${m.user_id}`)}>
                      {m.profile?.full_name || m.profile?.email || 'Membro'}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {podeVerGeral && (
            <Link
              to="/dashboard"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3.5 text-[13px] font-semibold shadow-sm transition-colors hover:bg-muted/50"
            >
              Visão geral <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar os indicadores.</p>
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
          {/* Indicadores */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              rotulo="Entregues"
              valor={r.meu.concluidos}
              rodape={<Variacao valor={deltaEntregas} />}
            />
            <Indicador
              rotulo="No prazo"
              valor={r.meu.noPrazoPct ?? '—'}
              unidade={r.meu.noPrazoPct !== null ? '%' : undefined}
              rodape={
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-xs text-muted-foreground">
                    {r.meu.comPrazo > 0 ? `${r.meu.noPrazo} de ${r.meu.comPrazo} com prazo` : 'nenhuma entrega com prazo'}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    time {r.time.noPrazoPct !== null ? `${r.time.noPrazoPct}%` : '—'}
                  </span>
                </div>
              }
            />
            <Indicador
              rotulo="Tempo de entrega"
              valor={r.meu.leadMediana ?? '—'}
              unidade={r.meu.leadMediana !== null ? 'dias' : undefined}
              rodape={
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <Variacao valor={deltaLead} unidade=" d" melhorQuandoMaior={false} />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    time {r.time.leadMediana !== null ? `${r.time.leadMediana} d` : '—'}
                  </span>
                </div>
              }
            />
            <Indicador
              rotulo={t('Na minha fila', 'Na fila')}
              valor={r.abertos}
              tom={r.atrasados > 0 ? 'perigo' : undefined}
              rodape={
                <div className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
                  <span className={cn('rounded-full px-2 py-0.5', r.atrasados > 0 ? 'bg-red-500/10 text-red-600' : 'bg-muted text-muted-foreground')}>
                    {r.atrasados} {r.atrasados === 1 ? 'atrasado' : 'atrasados'}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{r.vencem7d} vencem em 7 dias</span>
                </div>
              }
            />
          </div>

          {/* Ritmo semanal + gamificação */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
            <Bloco titulo={t('Minhas entregas por semana', 'Entregas por semana')} subtitulo="Cards criados e cards entregues, nas últimas 8 semanas">
              {r.semanal.every(s => s.criados === 0 && s.concluidos === 0) ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem movimento nas últimas 8 semanas.</p>
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.semanal.map(s => ({ semana: s.rotulo, Criados: s.criados, Entregues: s.concluidos }))} margin={{ left: -18, right: 4, top: 4 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="semana" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                        contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Criados" fill="hsl(var(--muted-foreground) / 0.35)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Entregues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Bloco>

            <Bloco
              titulo={t('Meu ritmo', 'Ritmo')}
              subtitulo="Pontuação dos últimos 30 dias"
              acao={
                <Link to="/gamification" className="text-[13px] font-semibold text-primary hover:underline">
                  Ranking ›
                </Link>
              }
            >
              {!eu ? (
                <Skeleton className="h-40 rounded-xl" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums">
                        {eu.score}
                        <span className="text-base font-semibold text-muted-foreground">/100</span>
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {eu.participa && eu.posicao ? `${eu.posicao}º de ${noRanking} no ranking` : 'fora do ranking'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                      <span>{eu.nivel_icone}</span> Nível {eu.nivel} · {eu.nivel_nome}
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
                      <span>XP · {eu.xp.toLocaleString('pt-BR')}</span>
                      <span>próximo nível em {eu.xp_proximo.toLocaleString('pt-BR')}</span>
                    </div>
                    <Progress value={eu.nivel_progresso} className="h-2" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                        <Flame className="h-4 w-4 text-orange-500" />
                        {eu.streak_atual}
                      </p>
                      <p className="text-[11px] text-muted-foreground">dias seguidos</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="text-lg font-bold tabular-nums">{eu.dias_ativos}</p>
                      <p className="text-[11px] text-muted-foreground">dias ativos</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        {eu.medalhas}
                      </p>
                      <p className="text-[11px] text-muted-foreground">medalhas</p>
                    </div>
                  </div>
                </div>
              )}
            </Bloco>
          </div>

          {/* Fila: onde está + próximos prazos */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bloco titulo={t('Onde está meu trabalho', 'Onde está o trabalho')} subtitulo="Cards em aberto, por etapa">
              {r.abertos === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('Nada em aberto com você. Tudo entregue. 🎉', 'Nada em aberto. Tudo entregue. 🎉')}</p>
              ) : (
                <ul className="space-y-3">
                  {r.porEtapa.map(e => (
                    <li key={e.status}>
                      <div className="mb-1 flex items-baseline justify-between text-[13px]">
                        <span className="font-medium">{getCardStatusLabel(e.status as CardStatus)}</span>
                        <span className="tabular-nums text-muted-foreground">{e.n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${e.n === 0 ? 0 : Math.max(6, (e.n / maxEtapa) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {(r.parados > 0 || r.semPrazo > 0) && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/50 pt-3 text-[11.5px] font-semibold">
                  {r.parados > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700">{r.parados} parado{r.parados === 1 ? '' : 's'} há mais de 14 dias</span>
                  )}
                  {r.semPrazo > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{r.semPrazo} sem prazo</span>
                  )}
                </div>
              )}
            </Bloco>

            <Bloco
              titulo="Próximos prazos"
              subtitulo="Atrasados primeiro, depois os que vencem logo"
              acao={
                <Link to="/tasks" className="text-[13px] font-semibold text-primary hover:underline">
                  Meu trabalho ›
                </Link>
              }
            >
              {r.proximosPrazos.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('Nenhum card seu com prazo definido.', 'Nenhum card com prazo definido.')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {r.proximosPrazos.map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks?card=${p.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', p.atrasado ? 'bg-red-500/10 text-red-600' : 'bg-muted text-muted-foreground')}>
                          {p.atrasado ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">{p.title}</span>
                          <span className="block text-[11.5px] text-muted-foreground">
                            {format(new Date(p.due), "dd 'de' MMM, HH:mm", { locale: ptBR })} · {getCardStatusLabel(p.status as CardStatus)}
                          </span>
                        </span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', p.atrasado ? 'bg-red-500/10 text-red-600' : 'bg-muted text-muted-foreground')}>
                          {rotuloDoPrazo(p.diasAtraso, p.atrasado)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
          </div>

          {/* Postagens (só para quem trabalha em Social Media) */}
          {r.postagens && (
            <Bloco
              titulo="Postagens da semana"
              subtitulo={t('Cards seus com data de postagem nos próximos 7 dias', 'Cards com data de postagem nos próximos 7 dias')}
              acao={<Megaphone className="h-5 w-5 text-primary" />}
            >
              {r.postagens.semData > 0 && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-[13px]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="leading-snug">
                    <strong>{r.postagens.semData}</strong> {r.postagens.semData === 1 ? t('card seu está', 'card está') : t('cards seus estão', 'cards estão')} sem data de postagem. Sem ela o card não aparece no quadro de Postagens.
                  </p>
                </div>
              )}
              {r.postagens.proximas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('Nenhuma postagem sua agendada para os próximos 7 dias.', 'Nenhuma postagem agendada para os próximos 7 dias.')}</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {r.postagens.proximas.map(p => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks?card=${p.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <span className="text-[13px] font-extrabold leading-none tabular-nums">{p.data.slice(8, 10)}</span>
                          <span className="text-[9.5px] font-bold uppercase leading-none">{format(new Date(`${p.data}T12:00:00`), 'MMM', { locale: ptBR })}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{p.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
          )}

          {/* Clientes + tempo */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bloco titulo="Por cliente" subtitulo="Cards em aberto e entregues no período">
              {r.porCliente.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem cards no período.</p>
              ) : (
                <ul className="space-y-3">
                  {r.porCliente.map(c => (
                    <li key={c.clientId ?? 'sem'}>
                      <div className="mb-1 flex items-baseline justify-between text-[13px]">
                        <span className="truncate font-medium">{c.clientId ? nomesClientes.get(c.clientId) ?? 'Cliente' : 'Sem cliente'}</span>
                        <span className="tabular-nums text-muted-foreground">{c.n}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(6, (c.n / maxCliente) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>

            <Bloco titulo={t('Meu tempo', 'Tempo')} subtitulo="Horas registradas no cronômetro">
              {!horas || (horas.atual === 0 && horas.anterior === 0) ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <p className="text-[14px] font-bold">{t('Você ainda não registrou tempo', 'Ainda não há tempo registrado')}</p>
                  <p className="mt-1 max-w-xs text-[13px] leading-snug text-muted-foreground">
                    {t('Ligue o cronômetro dentro do card para ver aqui quanto tempo vai em cada trabalho.', 'O tempo aparece aqui quando a pessoa usa o cronômetro dentro dos cards.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[32px] font-extrabold leading-none tracking-tight tabular-nums">
                    {horas.atual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                    <span className="ml-1 text-base font-semibold text-muted-foreground">h</span>
                  </p>
                  <Variacao valor={Math.round((horas.atual - horas.anterior) * 10) / 10} unidade=" h" />
                </div>
              )}
            </Bloco>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardExecutor;
