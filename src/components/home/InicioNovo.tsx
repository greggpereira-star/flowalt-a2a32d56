import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Minus, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useInicioDados } from '@/hooks/home/useInicioDados';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { rotuloProblema } from '@/components/coordination/v2/Painel';
import type { Problema } from '@/lib/coordination/coordMetrics';
import { enriquecerRisco, LIMITE_CARGA, rotuloRisco } from '@/lib/inteligencia/risco';
import { gerarLeituraDoDia, type Leitura } from '@/lib/home/leituraDoDia';
import { useDuracoesPorEtapa } from '@/hooks/useDuracoesPorEtapa';
import { useRodadasDeAjuste } from '@/hooks/useRodadasDeAjuste';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { useFeatureFlags, FEATURE_FLAGS } from '@/hooks/useFeatureFlags';
import { usePendingApprovals } from '@/hooks/useApprovals';
import { TodayAgenda } from './TodayAgenda';
import { LeituraDoDia } from './LeituraDoDia';
import { MetasEMissoesCard } from './MetasEMissoesCard';
import { MyTasksWidget } from './MyTasksWidget';
import { RecentActivityWidget } from './RecentActivityWidget';
import { AltControlPendingWidget } from '@/components/altcontrol/AltControlPendingWidget';
import { BirthdayBanner } from '@/components/notices/BirthdayBanner';
import { HolidayBanner } from '@/components/notices/HolidayBanner';

/**
 * Início com o visual novo.
 *
 * Composição em proporção áurea: o conteúdo se divide em 1,618 : 1 (coluna de trabalho : coluna de contexto) em todas as
 * linhas, e o espaçamento segue a sequência de Fibonacci (8, 13, 21, 34). Reaproveita os dados e as regras da Coordenação e
 * da tela Analytics; nada é recalculado por fora. Quem não tem acesso à Coordenação vê só os próprios cards na fila.
 */

/** Duas colunas em proporção áurea a partir de xl; empilha abaixo disso. */
const AUREA = 'xl:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]';

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
  to,
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
  /** Para onde o indicador leva; todo número da tela é um caminho para a ação. */
  to?: string;
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
  const conteudo = (
    <>
      <p className="text-xs font-semibold text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          'mt-2 flex items-baseline gap-1.5 text-[24px] font-bold leading-none tracking-tight tabular-nums sm:text-[28px]',
          tom === 'perigo' && 'text-destructive',
          tom === 'aviso' && 'text-amber-600'
        )}
      >
        {valor}
        {sufixo && <span className="text-sm font-semibold text-muted-foreground">{sufixo}</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2">
        {delta}
        {ajuda && <span className="text-xs text-muted-foreground">{ajuda}</span>}
      </div>
    </>
  );
  const caixa = 'block h-full rounded-2xl border border-border/60 bg-card p-[13px] shadow-sm sm:p-[21px]';
  return to ? (
    <Link to={to} className={cn(caixa, 'transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {conteudo}
    </Link>
  ) : (
    <div className={caixa}>{conteudo}</div>
  );
}

function Cartao({ titulo, contador, acao, children, className, id }: { titulo: string; contador?: number; acao?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className={cn('rounded-2xl border border-border/60 bg-card p-[21px] shadow-sm', className)}>
      <header className="mb-[13px] flex flex-wrap items-center gap-2">
        <h2 id={id} className="text-[15px] font-bold tracking-tight">
          {titulo}
        </h2>
        {contador != null && contador > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">{contador}</span>}
        <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary">{acao}</span>
      </header>
      {children}
    </section>
  );
}

type Categoria = 'atrasado' | 'etapa' | 'cadastro';
type Filtro = 'todos' | Categoria;
const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'atrasado', rotulo: 'Atrasados' },
  { chave: 'etapa', rotulo: 'Na etapa' },
  { chave: 'cadastro', rotulo: 'Cadastro' },
];

/** Em que grupo cada problema cai: prazo vencido, tempo na etapa/aprovação ou cadastro incompleto. */
function categoriasDe(problemas: ReadonlyArray<{ tipo: string }>): Set<Categoria> {
  const c = new Set<Categoria>();
  problemas.forEach(p => {
    if (p.tipo === 'atrasado') c.add('atrasado');
    else if (p.tipo === 'sem-prazo' || p.tipo === 'sem-responsavel' || p.tipo === 'responsavel-inativo') c.add('cadastro');
    else if (p.tipo !== 'sobrecarga') c.add('etapa');
  });
  return c;
}

const PASSO_DA_FILA = 5;

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
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [visiveis, setVisiveis] = useState(PASSO_DA_FILA);
  const { isEnabled } = useFeatureFlags();
  const aprovacaoLigada = isEnabled(FEATURE_FLAGS.CLIENT_APPROVAL);
  const { data: aguardandoCliente } = usePendingApprovals(aprovacaoLigada);
  const radarLigado = isEnabled(FEATURE_FLAGS.RISK_RADAR);
  const { data: duracoes } = useDuracoesPorEtapa(radarLigado);
  const { data: ajustes } = useRodadasDeAjuste(radarLigado);

  const dataTexto = useMemo(() => {
    const t = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, []);

  // Cards abertos por pessoa: alimenta o radar de risco e o aviso único de sobrecarga.
  const abertosPorPessoa = useMemo(() => {
    const m = new Map<string, number>();
    dados?.todos.forEach(a => a.responsaveis.forEach(id => m.set(id, (m.get(id) ?? 0) + 1)));
    return m;
  }, [dados]);

  const sobrecarga = useMemo(
    () =>
      [...abertosPorPessoa.entries()]
        .filter(([id, n]) => n > LIMITE_CARGA && dados?.nomes.has(id))
        .map(([id, n]) => ({ nome: (dados!.nomes.get(id) ?? 'Membro').split(' ')[0], abertos: n }))
        .sort((x, y) => y.abertos - x.abertos),
    [abertosPorPessoa, dados],
  );

  // Fila: quem gerencia vê tudo; os demais veem só os cards em que são responsáveis. A sobrecarga do responsável vira um
  // aviso único acima da fila (antes repetia a mesma etiqueta em cada card); card que só tinha esse motivo sai da fila.
  const fila = useMemo(() => {
    if (!dados) return [];
    let base: Array<(typeof dados.emAtencao)[number] | ReturnType<typeof enriquecerRisco>[number]> = dados.emAtencao;
    if (radarLigado && duracoes) {
      base = enriquecerRisco(dados.todos, {
        agora: new Date(),
        duracoes,
        nomeEtapa: dados.nomeEtapa,
        abertosPorPessoa,
        pendentes: (aguardandoCliente ?? []).map(p => ({ card_id: p.card_id, enviado_em: p.created_at })),
        rodadas: ajustes?.rodadas,
        limitePorCliente: ajustes?.limitePorCliente,
      })
        .filter(a => a.pontos > 0)
        .sort((x, y) => y.pontos - x.pontos);
    }
    const proprios = canViewCoordination ? base : base.filter(a => user?.id && a.responsaveis.includes(user.id));
    return proprios.filter(a => categoriasDe(a.problemas as ReadonlyArray<{ tipo: string }>).size > 0);
  }, [dados, canViewCoordination, user?.id, radarLigado, duracoes, aguardandoCliente, ajustes, abertosPorPessoa]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: fila.length, atrasado: 0, etapa: 0, cadastro: 0 };
    fila.forEach(a => categoriasDe(a.problemas as ReadonlyArray<{ tipo: string }>).forEach(k => c[k]++));
    return c;
  }, [fila]);

  const filaFiltrada = useMemo(
    () => (filtro === 'todos' ? fila : fila.filter(a => categoriasDe(a.problemas as ReadonlyArray<{ tipo: string }>).has(filtro))),
    [fila, filtro],
  );

  const a = dados?.resumoAtual;
  const p = dados?.resumoAnterior;

  const leituras = useMemo<Leitura[]>(() => {
    if (!dados || !a || !p) return [];
    const atrasados = dados.todos
      .map(x => ({ x, dias: (x.problemas as Array<{ tipo: string; dias?: number }>).find(pr => pr.tipo === 'atrasado')?.dias ?? 0 }))
      .filter(v => v.dias > 0)
      .sort((u, v) => v.dias - u.dias);
    const parados14d = dados.todos.filter(x => (x.problemas as Array<{ tipo: string; dias?: number }>).some(pr => pr.tipo === 'parado' && (pr.dias ?? 0) >= 14)).length;
    const da = gerarLeituraDoDia({
      atrasados: dados.coord.atrasados,
      foraDoSla: dados.coord.foraDoSla,
      maisAntigoAtrasado: atrasados[0] ? { id: atrasados[0].x.card.id, titulo: atrasados[0].x.card.title, dias: atrasados[0].dias } : null,
      noPrazo: a.noPrazo,
      comPrazo: a.comPrazo,
      noPrazoPct: a.noPrazoPct,
      noPrazoAnteriorPct: p.noPrazoPct,
      entregas30: a.concluidos,
      entregas30Anterior: p.concluidos,
      cargaAcimaDoLimite: canViewCoordination ? sobrecarga : [],
      limiteDeCarga: LIMITE_CARGA,
      parados14d,
      aprovacoesNaoVistas: (aguardandoCliente ?? []).filter(x => x.view_count === 0).length,
    });
    // Alertas já existentes da Início (ex.: falha de publicação) entram na mesma leitura.
    const mapa = { critical: 'critico', warning: 'atencao', opportunity: 'info', success: 'positivo' } as const;
    const extras: Leitura[] = ((home.insights ?? []) as Array<{ key: string; severity: keyof typeof mapa; text: string }>).map(i => ({
      chave: `extra-${i.key}`,
      severidade: mapa[i.severity] ?? 'info',
      texto: i.text,
    }));
    const ordem = { critico: 0, atencao: 1, info: 2, positivo: 3 } as const;
    return [...da, ...extras].sort((u, v) => ordem[u.severidade] - ordem[v.severidade]).slice(0, 5);
  }, [dados, a, p, sobrecarga, canViewCoordination, aguardandoCliente, home.insights]);

  const destinoDaFila = canViewCoordination ? '/coordination' : '/tasks';

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-12 pt-8 sm:px-8">
      <header className="mb-[34px] flex flex-wrap items-end justify-between gap-x-[21px] gap-y-3">
        <div>
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
        </div>
        {fila.length > 0 && (
          <button
            type="button"
            onClick={() => setCardAberto(fila[0].card.id)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Zap className="h-4 w-4" aria-hidden /> Resolver o mais urgente
          </button>
        )}
      </header>

      <div className="space-y-[21px]">
        <HolidayBanner />
        <BirthdayBanner />

        {/* Indicadores: o que aconteceu (30 dias) e o que está acontecendo (agora), na proporção 1,618 : 1 */}
        {carregando || !a || !p || !dados ? (
          <div className={cn('grid grid-cols-1 gap-[21px]', AUREA)}>
            <Skeleton className="h-[134px] rounded-2xl" />
            <Skeleton className="h-[134px] rounded-2xl" />
          </div>
        ) : (
          <div className={cn('grid grid-cols-1 gap-[21px]', AUREA)}>
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimos 30 dias</h2>
              <div className="grid grid-cols-3 gap-[13px]">
                <Tile rotulo="Entregas" valor={a.concluidos} atual={a.concluidos} anterior={p.concluidos} melhor="sobe" to="/dashboard" />
                <Tile
                  rotulo="No prazo"
                  valor={a.noPrazoPct ?? '–'}
                  sufixo={a.noPrazoPct != null ? '%' : undefined}
                  atual={a.noPrazoPct}
                  anterior={p.noPrazoPct}
                  melhor="sobe"
                  pp
                  ajuda={a.comPrazo ? `${a.noPrazo} de ${a.comPrazo}` : 'sem prazos'}
                  to="/dashboard"
                />
                <Tile
                  rotulo="Tempo de entrega"
                  valor={a.leadMediana ?? '–'}
                  sufixo={a.leadMediana != null ? 'dias' : undefined}
                  atual={a.leadMediana}
                  anterior={p.leadMediana}
                  melhor="desce"
                  ajuda="mediana"
                  to="/dashboard"
                />
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agora</h2>
              <div className="grid grid-cols-3 gap-[13px]">
                <Tile rotulo="Em aberto" valor={dados.coord.abertos} to="/tasks" />
                <Tile rotulo="Atrasados" valor={dados.coord.atrasados} tom={dados.coord.atrasados > 0 ? 'perigo' : undefined} to={destinoDaFila} />
                <Tile rotulo="Fora do SLA" valor={dados.coord.foraDoSla} tom={dados.coord.foraDoSla > 0 ? 'aviso' : undefined} to={destinoDaFila} />
              </div>
            </div>
          </div>
        )}

        <section className={cn('grid grid-cols-1 items-start gap-[21px]', AUREA)}>
          <Cartao
            id="precisa-de-decisao"
            titulo={canViewCoordination ? 'Precisa de decisão' : 'Seus cards em atenção'}
            contador={fila.length}
            acao={
              <Link to={destinoDaFila} className="rounded-md px-2 py-1 hover:bg-primary/10">
                {canViewCoordination ? 'Coordenação ›' : 'Meu trabalho ›'}
              </Link>
            }
          >
            {canViewCoordination && sobrecarga.length > 0 && (
              <p className="mb-[13px] flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong>Sobrecarga:</strong> {sobrecarga.map(s => `${s.nome} (${s.abertos})`).join(', ')} com mais de {LIMITE_CARGA} cards abertos.
                </span>
              </p>
            )}

            {!carregando && fila.length > 0 && (
              <div className="mb-[13px] flex flex-wrap gap-2" role="group" aria-label="Filtrar a fila">
                {FILTROS.filter(f => f.chave === 'todos' || contagem[f.chave] > 0).map(f => (
                  <button
                    key={f.chave}
                    type="button"
                    aria-pressed={filtro === f.chave}
                    onClick={() => {
                      setFiltro(f.chave);
                      setVisiveis(PASSO_DA_FILA);
                    }}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                      filtro === f.chave ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {f.rotulo}
                    <span className="tabular-nums">{contagem[f.chave]}</span>
                  </button>
                ))}
              </div>
            )}

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
              <ul className="space-y-[13px]">
                {filaFiltrada.slice(0, visiveis).map((item, posicao) => (
                  <li key={item.card.id} className={cn(posicao >= 3 && 'max-sm:hidden')}>
                    <button
                      onClick={() => setCardAberto(item.card.id)}
                      className="w-full rounded-xl border border-border/60 p-[13px] text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="truncate text-sm font-semibold">{item.card.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.card.space?.name ?? 'Sem space'}
                        {' · '}
                        {item.responsaveis.length ? item.responsaveis.map(id => (dados?.nomes.get(id) ?? 'Ex-membro').split(' ')[0]).join(', ') : 'sem responsável'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.problemas
                          .filter(pr => (pr as { tipo: string }).tipo !== 'sobrecarga')
                          .slice(0, 3)
                          .map((pr, i) => {
                            const r = rotuloRisco(pr as never) ?? rotuloProblema(pr as Problema);
                            return (
                              <span
                                key={i}
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                                  i >= 2 && 'max-sm:hidden',
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
                {filaFiltrada.length > visiveis && (
                  <li className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setVisiveis(v => v + PASSO_DA_FILA)}
                      className="inline-flex h-9 items-center rounded-xl px-4 text-[13px] font-semibold text-primary hover:bg-primary/10"
                    >
                      Mostrar mais {Math.min(PASSO_DA_FILA, filaFiltrada.length - visiveis)} <span className="ml-1 text-muted-foreground">de {filaFiltrada.length - visiveis}</span>
                    </button>
                  </li>
                )}
                {filaFiltrada.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Nenhum item neste grupo.</li>}
              </ul>
            )}
          </Cartao>

          <div className="space-y-[21px]">
            <LeituraDoDia leituras={leituras} onAbrirCard={setCardAberto} />
            <TodayAgenda novo events={home.agenda} isLoading={home.isLoading.agenda} error={home.errors.agenda} onRetry={home.refetchAll} />
            <MetasEMissoesCard />
          </div>
        </section>

        {aprovacaoLigada && (aguardandoCliente?.length ?? 0) > 0 && (
          <Cartao id="aguardando-cliente" titulo="Aguardando o cliente" contador={aguardandoCliente!.length}>
            <ul className="divide-y divide-border/60">
              {aguardandoCliente!.slice(0, 5).map(a => (
                <li key={a.id}>
                  <button type="button" onClick={() => setCardAberto(a.card_id)} className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{a.cards?.title ?? a.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.client_name ? a.client_name + ' · ' : ''}Rodada {a.round} · enviado {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', a.view_count > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-muted text-muted-foreground')}>
                      {a.view_count > 0 ? 'Visto, sem resposta' : 'Não visto'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        <section className={cn('grid grid-cols-1 items-start gap-[21px]', AUREA)}>
          <RecentActivityWidget novo items={atividade.data ?? []} isLoading={atividade.isLoading} />
          <div className="space-y-[21px]">
            <MyTasksWidget novo tasks={home.priorityTasks} isLoading={home.isLoading.tasks} />
            <AltControlPendingWidget novo />
          </div>
        </section>
      </div>

      <CardDetailSheet cardId={cardAberto || undefined} open={!!cardAberto} onOpenChange={aberto => !aberto && setCardAberto(null)} />
    </div>
  );
}
