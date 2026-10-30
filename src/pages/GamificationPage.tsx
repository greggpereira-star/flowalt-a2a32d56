import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Trophy } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { WeeklyGoalsAdmin } from '@/components/gamification/WeeklyGoalsAdmin';
import { WeeklyGoalsCard } from '@/components/gamification/WeeklyGoalsCard';
import { RankingChart } from '@/components/gamification/RankingChart';
import {
  CartaoVoce,
  Conquistas,
  Desafios,
  Destaques,
  type Criterio,
  Niveis,
  Podio,
  RankingCompleto,
} from '@/components/gamification/v2/Sections';
import {
  useGamificationData,
  useMedalhasDoTime,
  type Periodo,
} from '@/components/gamification/v2/useGamificationData';
import { useRankingHistory } from '@/hooks/useRankingHistory';
import { useWeeklyGoals } from '@/hooks/useWeeklyGoals';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MetaDoTimeCard } from '@/components/gamification/MetaDoTimeCard';
import { MetaDoTimeAdmin } from '@/components/gamification/MetaDoTimeAdmin';
import { useSearchParams } from 'react-router-dom';
import { TemporadaTab } from '@/components/gamification/TemporadaTab';
import { PremioDaTemporadaAdmin } from '@/components/gamification/PremioDaTemporadaAdmin';
import { MissoesDaSemanaCard } from '@/components/gamification/MissoesDaSemanaCard';
import { MissoesDiariasCard } from '@/components/gamification/MissoesDiariasCard';
import { TrilhasDeConquista } from '@/components/gamification/TrilhasDeConquista';
import { KudosTab } from '@/components/gamification/KudosTab';

const PERIODOS: { valor: Periodo; rotulo: string; longo: string }[] = [
  { valor: 7, rotulo: 'Semana', longo: 'últimos 7 dias' },
  { valor: 30, rotulo: 'Mês', longo: 'últimos 30 dias' },
  { valor: 365, rotulo: 'Geral', longo: 'últimos 12 meses' },
];

export default function GamificationPage() {
  usePageTracking('gamification');
  const { currentRole } = useWorkspace();
  const isAdmin = currentRole === 'admin' || currentRole === 'owner';
  const [periodo, setPeriodo] = useState<Periodo>(30);
  // O aviso de fim de temporada abre direto na aba certa (?aba=temporada)
  const [params] = useSearchParams();
  const abaPedida = params.get('aba');
  const abaInicial = ['ranking', 'temporada', 'conquistas', 'kudos', 'niveis'].includes(abaPedida ?? '') ? (abaPedida as string) : 'ranking';
  const [criterio, setCriterio] = useState<Criterio>('score');

  const { jogadores, eu, pesos, meusUltimos7, carregando, erro } = useGamificationData(periodo);
  const { data: medalhasTime = [] } = useMedalhasDoTime();
  const { history } = useRankingHistory();
  const { goals } = useWeeklyGoals();

  const rotuloPeriodo = PERIODOS.find(p => p.valor === periodo)!.longo;

  return (
    <AppLayout>
      <Helmet>
        <title>Gamificação - Ranking & Conquistas</title>
        <meta name="description" content="Ranking da equipe, níveis, conquistas e desafios da semana" />
      </Helmet>

      <div className="container mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-yellow-500/25 to-amber-500/10 p-2.5">
              <Trophy className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gamificação</h1>
              <p className="text-muted-foreground">Ranking, níveis e conquistas da equipe</p>
            </div>
          </div>
          <div className="inline-flex rounded-full border bg-muted/40 p-1" role="group" aria-label="Período do ranking">
            {PERIODOS.map(p => (
              <button
                key={p.valor}
                onClick={() => setPeriodo(p.valor)}
                aria-pressed={periodo === p.valor}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  periodo === p.valor ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>

        <Tabs defaultValue={abaInicial} className="space-y-6">
          <TabsList>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="temporada">Temporada</TabsTrigger>
            <TabsTrigger value="conquistas">Conquistas</TabsTrigger>
            <TabsTrigger value="kudos">Kudos</TabsTrigger>
            <TabsTrigger value="niveis">Níveis</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Gerenciar Metas</TabsTrigger>}
          </TabsList>

          <TabsContent value="ranking" className="space-y-6">
            {carregando ? (
              <div className="space-y-4">
                <Skeleton className="h-44" />
                <Skeleton className="h-64" />
              </div>
            ) : erro ? (
              <p className="py-10 text-center text-muted-foreground">
                Não foi possível carregar o ranking. Recarregue a página em instantes.
              </p>
            ) : (
              <>
                <CartaoVoce eu={eu} jogadores={jogadores} rotuloPeriodo={rotuloPeriodo} />
                <div className="grid gap-6 lg:grid-cols-2">
                  <Podio jogadores={jogadores} meuId={eu?.user_id} />
                  <Desafios semana={meusUltimos7} />
                </div>
                <MissoesDiariasCard />
                <MetaDoTimeCard />
                <MissoesDaSemanaCard />
                <Destaques jogadores={jogadores} rotuloPeriodo={rotuloPeriodo} onSelecionar={setCriterio} />
                <RankingCompleto jogadores={jogadores} pesos={pesos} meuId={eu?.user_id} criterio={criterio} onCriterio={setCriterio} />
                {goals.length > 0 && <WeeklyGoalsCard />}
                {history.length >= 2 && <RankingChart />}
              </>
            )}
          </TabsContent>

          <TabsContent value="temporada">
            <TemporadaTab />
          </TabsContent>

          <TabsContent value="kudos">
            <KudosTab />
          </TabsContent>

          <TabsContent value="conquistas">
            <div className="space-y-6">
              <TrilhasDeConquista jogadores={jogadores} meuId={eu?.user_id} />
              <Conquistas jogadores={jogadores} meuId={eu?.user_id} medalhasTime={medalhasTime} />
            </div>
          </TabsContent>

          <TabsContent value="niveis">
            <Niveis jogadores={jogadores} eu={eu} pesos={pesos} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <div className="space-y-6">
                <PremioDaTemporadaAdmin />
                <MetaDoTimeAdmin />
                <WeeklyGoalsAdmin />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
