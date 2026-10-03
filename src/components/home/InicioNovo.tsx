import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Minus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInicioDados } from '@/hooks/home/useInicioDados';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { rotuloProblema } from '@/components/coordination/v2/Painel';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { ClientHealthWidget } from '@/components/dashboard/ClientHealthWidget';
import { TodayAgenda } from './TodayAgenda';
import { DailyInsights } from './DailyInsights';
import { MyTasksWidget } from './MyTasksWidget';
import { RecentActivityWidget } from './RecentActivityWidget';
import { AltControlPendingWidget } from '@/components/altcontrol/AltControlPendingWidget';
import { BirthdayBanner } from '@/components/notices/BirthdayBanner';
import { HolidayBanner } from '@/components/notices/HolidayBanner';

/**
 * Início com o visual novo (opção pessoal em teste).
 *
 * Reaproveita os widgets e os dados da Início atual (agenda, insights, minhas tarefas, atividade) e
 * acrescenta, no estilo do desenho: a faixa de indicadores de entrega, a fila "Precisa de decisão" e a
 * carga da equipe. Quem não tem acesso à Coordenação vê só os próprios cards na fila e não vê a carga.
 */

type Home = {
  agenda: any;
  insights: any;
  priorityTasks: any;
  isLoading: { agenda?: boolean; tasks?: boolean };
  errors: { agenda?: unknown };
  refetchAll: () => void;
};

function Tile({
  rotulo,
  valor,
  sufixo,
  atual,
  anterior,
  melhor,
  pp,
  ajuda,
  tom,
}: {
  rotulo: string;
  valor: React.ReactNode;
  sufixo?: string;
  atual?: number | null;
  anterior?: number | null;
  melhor?: 'sobe' | 'desce';
  pp?: boolean;
  ajuda?: string;
  tom?: 'perigo' | 'aviso';
}) {
  let delta: React.ReactNode = null;
  if (melhor && atual != null && anterior != null) {
    const diff = pp ? atual - anterior : anterior === 0 ? (atual === 0 ? 0 : 100) : ((atual - anterior) / anterior) * 100;
    const n = Math.round(diff);
    const bom = n === 0 ? null : melhor === 'sobe' ? n > 0 : n < 0;
    delta = (
      <span
        className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', bom == null ? 'text-muted-foreground' : bom ? 'text-green-600' : 'text-red-500')}
        title="Comparado aos 30 dias anteriores"
      >
        {n === 0 ? <Minus className="h-3 w-3" /> : n > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {n > 0 ? '+' : ''}
        {n}
        {pp ? ' pp' : '%'}
      </span>
    );
  }
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          'mt-2 flex items-baseline gap-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums',
          tom === 'perigo' && 'text-destructive',
          tom === 'aviso' && 'text-amber-600'
        )}
      >
        {valor}
        {sufixo && <span className="text-sm font-semibold text-muted-foreground">{sufixo}</span>}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {delta}
        {ajuda && <span className="text-[11.5px] text-muted-foreground">{ajuda}</span>}
      </div>
    </div>
  );
}

function Cartao({ titulo, contador, acao, children, className }: { titulo: string; contador?: number; acao?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-border/60 bg-card p-5 shadow-sm', className)}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-[15px] font-bold tracking-tight">{titulo}</h2>
        {contador != null && contador > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">{contador}</span>
        )}
        <span className="ml-auto text-xs font-semibold text-primary">{acao}</span>
      </header>
      {children}
    </section>
  );
}

export function InicioNovo({
  firstName,
  workspaceName,
  home,
  atividade,
}: {
  firstName: string;
  workspaceName?: string;
  home: Home;
  atividade: { data?: any[]; isLoading: boolean };
}) {
  const { user } = useAuth();
  const { canViewCoordination } = usePermissions();
  const { dados, carregando } = useInicioDados(true);
  const [cardAberto, setCardAberto] = useState<string | null>(null);

  const dataTexto = useMemo(() => {
    const t = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, []);

  // Fila: quem gerencia vê tudo; os demais veem só os cards em que são responsáveis.
  const fila = useMemo(() => {
    if (!dados) return [];
    return canViewCoordination ? dados.emAtencao : dados.emAtencao.filter(a => user?.id && a.responsaveis.includes(user.id));
  }, [dados, canViewCoordination, user?.id]);

  const maxCarga = Math.max(1, ...(dados?.carga.map(c => c.abertos) ?? [1]));
  const mediaCarga = useMemo(() => {
    const com = (dados?.carga ?? []).filter(c => c.abertos > 0);
    return com.length ? com.reduce((s, c) => s + c.abertos, 0) / com.length : 0;
  }, [dados]);

  const a = dados?.resumoAtual;
  const p = dados?.resumoAnterior;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-12 pt-8 sm:px-8">
      <header className="mb-7">
        <h1 className="text-[26px] font-bold tracking-tight sm:text-[30px]">Olá, {firstName}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dataTexto}
          {workspaceName ? ` · ${workspaceName}` : ''}
          {dados && (
            <>
              {' · '}
              {fila.length === 0
                ? 'nada precisa de decisão agora'
                : `${fila.length} ${fila.length === 1 ? 'item espera' : 'itens esperam'} ${canViewCoordination ? 'por você' : 'sua atenção'}`}
            </>
          )}
        </p>
      </header>

      <div className="space-y-5">
        <HolidayBanner />
        <BirthdayBanner />

        {/* Indicadores de entrega: mesmas regras da tela Analytics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {carregando || !a || !p || !dados ? (
            [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
          ) : (
            <>
              <Tile rotulo="Entregas · 30 dias" valor={a.concluidos} atual={a.concluidos} anterior={p.concluidos} melhor="sobe" />
              <Tile
                rotulo="No prazo"
                valor={a.noPrazoPct ?? '–'}
                sufixo={a.noPrazoPct != null ? '%' : undefined}
                atual={a.noPrazoPct}
                anterior={p.noPrazoPct}
                melhor="sobe"
                pp
                ajuda={a.comPrazo ? `${a.noPrazo} de ${a.comPrazo}` : 'sem prazos'}
              />
              <Tile
                rotulo="Tempo de entrega"
                valor={a.leadMediana ?? '–'}
                sufixo={a.leadMediana != null ? 'dias' : undefined}
                atual={a.leadMediana}
                anterior={p.leadMediana}
                melhor="desce"
                ajuda="mediana"
              />
              <Tile rotulo="Em aberto" valor={dados.coord.abertos} ajuda="agora" />
              <Tile rotulo="Atrasados" valor={dados.coord.atrasados} tom={dados.coord.atrasados > 0 ? 'perigo' : undefined} ajuda="prazo vencido" />
              <Tile rotulo="Fora do SLA" valor={dados.coord.foraDoSla} tom={dados.coord.foraDoSla > 0 ? 'aviso' : undefined} ajuda="tempo na etapa" />
            </>
          )}
        </div>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
          <Cartao
            titulo={canViewCoordination ? 'Precisa de decisão' : 'Seus cards em atenção'}
            contador={fila.length}
            acao={canViewCoordination ? <Link to="/coordination">Ver tudo ›</Link> : <Link to="/tasks">Meu trabalho ›</Link>}
          >
            {carregando ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : fila.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-9 w-9 text-green-500" />
                <p className="font-semibold">Tudo em ordem</p>
                <p className="text-sm text-muted-foreground">Nenhum card com atraso, SLA estourado ou cadastro incompleto.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {fila.slice(0, 5).map(item => (
                  <li key={item.card.id}>
                    <button
                      onClick={() => setCardAberto(item.card.id)}
                      className="w-full rounded-xl border border-border/60 p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <p className="truncate text-sm font-semibold">{item.card.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.card.space?.name ?? 'Sem space'}
                        {' · '}
                        {item.responsaveis.length
                          ? item.responsaveis.map(id => (dados?.nomes.get(id) ?? 'Ex-membro').split(' ')[0]).join(', ')
                          : 'sem responsável'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.problemas.slice(0, 3).map((pr, i) => {
                          const r = rotuloProblema(pr);
                          return (
                            <span
                              key={i}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                r.grave ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              )}
                            >
                              {r.texto}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  </li>
                ))}
                {fila.length > 5 && (
                  <li className="pt-1 text-center text-xs font-semibold text-muted-foreground">e mais {fila.length - 5}</li>
                )}
              </ul>
            )}
          </Cartao>

          <TodayAgenda novo events={home.agenda} isLoading={home.isLoading.agenda} error={home.errors.agenda} onRetry={home.refetchAll} />
        </section>

        <DailyInsights novo insights={home.insights} />

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {canViewCoordination && (
            <Cartao titulo="Carga da equipe" acao={<Link to="/coordination">Coordenação ›</Link>}>
              {carregando || !dados ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : dados.carga.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum card aberto com responsável.</p>
              ) : (
                <ul className="space-y-3">
                  {dados.carga.slice(0, 6).map(c => (
                    <li key={c.userId} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-sm font-semibold">
                        {(dados.nomes.get(c.userId) ?? 'Ex-membro').split(' ')[0]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', mediaCarga > 0 && c.abertos >= mediaCarga * 1.8 && c.abertos >= 3 ? 'bg-red-500' : 'bg-primary')}
                          style={{ width: `${(c.abertos / maxCarga) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums">{c.abertos}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Cards abertos por responsável.
              </p>
            </Cartao>
          )}
          <MyTasksWidget novo tasks={home.priorityTasks} isLoading={home.isLoading.tasks} />
          <ClientHealthWidget novo />
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <AltControlPendingWidget novo />
          <RecentActivityWidget novo items={atividade.data ?? []} isLoading={atividade.isLoading} />
        </section>
      </div>

      <CardDetailSheet cardId={cardAberto || undefined} open={!!cardAberto} onOpenChange={aberto => !aberto && setCardAberto(null)} />
    </div>
  );
}
