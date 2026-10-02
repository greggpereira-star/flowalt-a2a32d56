import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Lightbulb,
  ListChecks,
  Minus,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useAnalyticsV2, type Insight } from '@/hooks/useAnalyticsV2';
import type { OpcaoPeriodo, Recorte } from '@/lib/analytics/metrics';

const OPCOES: { valor: OpcaoPeriodo; rotulo: string }[] = [
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: '90d', rotulo: 'Últimos 90 dias' },
  { valor: 'week', rotulo: 'Esta semana' },
  { valor: 'month', rotulo: 'Este mês' },
];

const iniciais = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

// ---------------------------------------------------------------------------
function PainelInsights({ insights }: { insights: Insight[] }) {
  const estilo: Record<Insight['nivel'], { cor: string; icone: React.ReactNode }> = {
    alerta: { cor: 'border-red-500/40 bg-red-500/5', icone: <AlertTriangle className="h-4 w-4 text-red-500" /> },
    atencao: { cor: 'border-amber-500/40 bg-amber-500/5', icone: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
    info: { cor: 'border-blue-500/40 bg-blue-500/5', icone: <Info className="h-4 w-4 text-blue-500" /> },
    ok: { cor: 'border-green-500/40 bg-green-500/5', icone: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" /> O que os números dizem
        </CardTitle>
        <CardDescription>Avisos calculados dos seus cards, do mais urgente ao menos</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nada fora do normal neste período.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {insights.slice(0, 6).map(i => (
              <div key={i.id} className={cn('rounded-lg border p-3', estilo[i.nivel].cor)}>
                <p className="flex items-start gap-2 text-sm font-semibold">
                  <span className="mt-0.5 shrink-0">{estilo[i.nivel].icone}</span>
                  {i.titulo}
                </p>
                <p className="mt-1 pl-6 text-xs text-muted-foreground">{i.texto}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Kpi({
  titulo,
  valor,
  sufixo,
  atual,
  anterior,
  melhor,
  ajuda,
  icone,
  pp,
}: {
  titulo: string;
  valor: React.ReactNode;
  sufixo?: string;
  atual?: number | null;
  anterior?: number | null;
  melhor?: 'sobe' | 'desce';
  ajuda?: string;
  icone: React.ReactNode;
  pp?: boolean; // diferença em pontos percentuais
}) {
  let delta: React.ReactNode = null;
  if (melhor && atual != null && anterior != null) {
    const diff = pp ? atual - anterior : anterior === 0 ? (atual === 0 ? 0 : 100) : ((atual - anterior) / anterior) * 100;
    const arred = Math.round(diff);
    const bom = arred === 0 ? null : melhor === 'sobe' ? arred > 0 : arred < 0;
    delta = (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-xs font-medium',
          bom == null ? 'text-muted-foreground' : bom ? 'text-green-600' : 'text-red-500'
        )}
        title="Comparado ao período anterior de mesma duração"
      >
        {arred === 0 ? <Minus className="h-3 w-3" /> : arred > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {arred > 0 ? '+' : ''}
        {arred}
        {pp ? ' pp' : '%'}
      </span>
    );
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{titulo}</span>
          {icone}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{valor}</span>
          {sufixo && <span className="text-sm text-muted-foreground">{sufixo}</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {delta}
          {ajuda && <span className="text-[11px] text-muted-foreground">{ajuda}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
type LinhaRecorte = Recorte & { nome: string; avatar?: string | null };

function TabelaRecorte({ linhas, vazio, comFoto }: { linhas: LinhaRecorte[]; vazio: string; comFoto?: boolean }) {
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>;
  const maxConcl = Math.max(1, ...linhas.map(l => l.concluidos));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-2 font-medium">Nome</th>
            <th className="px-2 font-medium">Concluídos</th>
            <th className="px-2 text-right font-medium">Em aberto</th>
            <th className="px-2 text-right font-medium">Atrasados</th>
            <th className="px-2 text-right font-medium" title="Mediana de dias entre criar e concluir">Tempo de entrega</th>
            <th className="pl-2 text-right font-medium">No prazo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.chave} className="border-b last:border-0">
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  {comFoto && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={l.avatar ?? undefined} alt={l.nome} />
                      <AvatarFallback className="text-[10px]">{iniciais(l.nome)}</AvatarFallback>
                    </Avatar>
                  )}
                  <span className="truncate font-medium">{l.nome}</span>
                </div>
              </td>
              <td className="px-2">
                <div className="flex items-center gap-2">
                  <Progress value={(l.concluidos / maxConcl) * 100} className="h-1.5 w-16" />
                  <span className="tabular-nums">{l.concluidos}</span>
                </div>
              </td>
              <td className="px-2 text-right tabular-nums">{l.abertos}</td>
              <td className={cn('px-2 text-right tabular-nums', l.atrasados > 0 && 'font-semibold text-red-500')}>{l.atrasados}</td>
              <td className="px-2 text-right tabular-nums">{l.leadMediana != null ? `${l.leadMediana} d` : '–'}</td>
              <td className="pl-2 text-right tabular-nums">{l.noPrazoPct != null ? `${l.noPrazoPct}%` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  usePageTracking('analytics');
  const [opcao, setOpcao] = useState<OpcaoPeriodo>('30d');
  const { dados, carregando, erro } = useAnalyticsV2(opcao);

  if (carregando) {
    return (
      <AppLayout>
        <div className="container mx-auto max-w-6xl space-y-6 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40" />
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      </AppLayout>
    );
  }

  const q = dados?.qualidade;
  const itensQualidade = q
    ? [
        { rotulo: 'Sem cliente', n: q.semCliente, dica: 'Sem cliente, não dá para ver entrega e prazo por cliente.' },
        { rotulo: 'Sem prazo', n: q.semPrazo, dica: 'Sem prazo, o card não entra no cálculo de atraso.' },
        { rotulo: 'Sem responsável', n: q.semResponsavel, dica: 'Não aparece na carga de ninguém.' },
        { rotulo: 'Sem estimativa de horas', n: q.semEstimativa, dica: 'Impede comparar previsto com realizado.' },
        { rotulo: 'Sem horas registradas', n: q.semHoras, dica: 'Use o cronômetro do card para medir esforço.' },
      ]
    : [];

  return (
    <AppLayout>
      <Helmet>
        <title>Analytics - Entrega, prazos e carga da equipe</title>
        <meta name="description" content="Entrega, prazos, carga e qualidade do cadastro dos seus cards" />
      </Helmet>

      <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 p-2.5">
              <BarChart3 className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Entrega, prazos e carga da equipe</p>
            </div>
          </div>
          <Select value={opcao} onValueChange={v => setOpcao(v as OpcaoPeriodo)}>
            <SelectTrigger className="w-[190px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES.map(o => (
                <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {erro || !dados ? (
          <p className="py-12 text-center text-muted-foreground">
            Não foi possível carregar os dados. Recarregue a página em instantes.
          </p>
        ) : (
          <>
            <PainelInsights insights={dados.insights} />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Kpi
                titulo="Entregas"
                valor={dados.atual.concluidos}
                atual={dados.atual.concluidos}
                anterior={dados.anterior.concluidos}
                melhor="sobe"
                icone={<CheckCircle2 className="h-4 w-4" />}
                ajuda={dados.rotulo}
              />
              <Kpi
                titulo="Demandas novas"
                valor={dados.atual.criados}
                atual={dados.atual.criados}
                anterior={dados.anterior.criados}
                icone={<ListChecks className="h-4 w-4" />}
                melhor={undefined}
              />
              <Kpi
                titulo="No prazo"
                valor={dados.atual.noPrazoPct ?? '–'}
                sufixo={dados.atual.noPrazoPct != null ? '%' : undefined}
                atual={dados.atual.noPrazoPct}
                anterior={dados.anterior.noPrazoPct}
                melhor="sobe"
                pp
                icone={<Timer className="h-4 w-4" />}
                ajuda={dados.atual.comPrazo ? `${dados.atual.noPrazo} de ${dados.atual.comPrazo}` : 'sem prazos'}
              />
              <Kpi
                titulo="Tempo de entrega"
                valor={dados.atual.leadMediana ?? '–'}
                sufixo={dados.atual.leadMediana != null ? 'dias' : undefined}
                atual={dados.atual.leadMediana}
                anterior={dados.anterior.leadMediana}
                melhor="desce"
                icone={<Clock className="h-4 w-4" />}
                ajuda="mediana"
              />
              <Kpi
                titulo="Em aberto"
                valor={dados.situacao.abertos}
                icone={<TrendingUp className="h-4 w-4" />}
                ajuda="agora"
              />
              <Kpi
                titulo="Atrasados"
                valor={<span className={dados.situacao.atrasados > 0 ? 'text-red-500' : ''}>{dados.situacao.atrasados}</span>}
                icone={<AlertTriangle className="h-4 w-4" />}
                ajuda="abertos, prazo vencido"
              />
            </div>

            <Tabs defaultValue="fluxo" className="space-y-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
                <TabsTrigger value="prazos">Prazos</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
                <TabsTrigger value="spaces">Spaces e clientes</TabsTrigger>
                <TabsTrigger value="qualidade">Qualidade dos dados</TabsTrigger>
              </TabsList>

              <TabsContent value="fluxo" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Entrada e saída por semana</CardTitle>
                    <CardDescription>Demandas criadas contra entregas concluídas, nas últimas 12 semanas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dados.serie}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="rotulo" className="text-xs" />
                          <YAxis allowDecimals={false} className="text-xs" />
                          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={l => `Semana de ${l}`} />
                          <Legend />
                          <Bar dataKey="criados" name="Criadas" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="concluidos" name="Concluídas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Tempo de entrega por semana</CardTitle>
                    <CardDescription>Mediana de dias entre criar e concluir, por semana de conclusão</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dados.serie}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="rotulo" className="text-xs" />
                          <YAxis className="text-xs" unit=" d" />
                          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={l => `Semana de ${l}`} />
                          <Line type="monotone" dataKey="leadMediana" name="Mediana (dias)" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="prazos" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Quanto as entregas atrasaram</CardTitle>
                      <CardDescription>Entregas com prazo, {dados.rotulo}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dados.atraso}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="rotulo" className="text-xs" />
                            <YAxis allowDecimals={false} className="text-xs" />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey="total" name="Entregas" radius={[3, 3, 0, 0]}>
                              {dados.atraso.map(f => (
                                <Cell key={f.id} fill={f.ok ? 'hsl(142, 71%, 40%)' : 'hsl(var(--destructive))'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Abertos mais atrasados</CardTitle>
                      <CardDescription>Cards ainda não entregues com o prazo vencido</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {dados.situacao.maisAtrasados.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum card aberto está atrasado.</p>
                      )}
                      {dados.situacao.maisAtrasados.map(({ card, diasAtraso }) => (
                        <div key={card.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{card.title}</span>
                          <Badge variant="destructive" className="shrink-0">{diasAtraso} d</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="equipe">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" /> Entrega e carga por pessoa
                    </CardTitle>
                    <CardDescription>
                      Conta os cards em que a pessoa é responsável. Concluídos e prazo no período; em aberto e atrasados agora.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TabelaRecorte linhas={dados.pessoas} vazio="Nenhum card com responsável." comFoto />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="spaces" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Por space</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TabelaRecorte linhas={dados.spaces} vazio="Sem dados de spaces." />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Por cliente</CardTitle>
                    <CardDescription>Cards sem cliente aparecem agrupados em "Sem cliente"</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TabelaRecorte linhas={dados.clientes} vazio="Sem dados de clientes." />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qualidade">
                <Card>
                  <CardHeader>
                    <CardTitle>Qualidade do cadastro</CardTitle>
                    <CardDescription>
                      Quanto cada análise depende de campos preenchidos. Base: {q?.total} cards ativos (não arquivados).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {itensQualidade.map(i => {
                      const pct = q && q.total ? Math.round((i.n / q.total) * 100) : 0;
                      return (
                        <div key={i.rotulo}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium">{i.rotulo}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {i.n} de {q?.total} ({pct}%)
                            </span>
                          </div>
                          <Progress value={pct} className={cn('h-2', pct >= 50 && '[&>div]:bg-amber-500')} />
                          <p className="mt-1 text-xs text-muted-foreground">{i.dica}</p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
