import { useMemo } from 'react';
import { differenceInMinutes } from 'date-fns';
import { CalendarRange, Layers } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSpaces } from '@/hooks/useSpaces';
import { useDashboardFilters, OPCOES_PERIODO } from '@/hooks/dashboard/useDashboardFilters';
import { useDashboardData } from '@/hooks/dashboard/useDashboardData';
import { DashboardKpiGrid } from '@/components/dashboard/DashboardKpiGrid';
import { QuickActionMenu } from '@/components/dashboard/QuickActionMenu';
import { TodayFocusPanel } from '@/components/dashboard/today/TodayFocusPanel';
import { OverdueCardsWidget } from '@/components/dashboard/OverdueCardsWidget';
import { HoursPerDayChart, StatusDistributionChart } from '@/components/dashboard/charts/DashboardCharts';
// Widget de saude do cliente ja existia e tem regra propria de score:
// reaproveitado como esta, sem formula paralela.
import { ClientHealthWidget } from '@/components/dashboard/ClientHealthWidget';
import { SpaceBottleneckWidget } from '@/components/dashboard/bottlenecks/SpaceBottleneckWidget';
import {
  selecionarPrioridadeDoDia, gerarAlertasOperacionais, temaDaPrioridade,
} from '@/lib/dashboard/dashboard-priority';
import type { DashboardAgendaEvent } from '@/lib/dashboard/dashboard-types';

/**
 * Dashboard novo, em rota paralela.
 *
 * Fica em /dashboard-v2 enquanto o /dashboard antigo continua servindo o time.
 * O Dashboard é a primeira tela que as pessoas abrem; trocá-la de uma vez
 * significaria descobrir problemas com todo mundo dentro. Quando esta versão
 * for aprovada, a troca é uma linha no roteador.
 */
export default function DashboardV2() {
  const { currentWorkspace } = useWorkspace();
  // Quem executa vê o próprio trabalho; quem coordena vê onde o time trava.
  // Gargalo e saúde de cliente são leitura de gestão, não de execução.
  const permissoes = usePermissions();
  const { period, periodId, selecionarPeriodo, agora, spaceId, setSpaceId } =
    useDashboardFilters('esta_semana');
  const { data: spaces } = useSpaces();
  const dados = useDashboardData(period, agora, spaceId);

  const espacoAtual = spaces?.find(e => e.id === spaceId);

  // A agenda crua vira a forma que o painel entende, com o próximo evento
  // identificado aqui: só este ponto conhece `agora` e a lista inteira.
  const agenda = useMemo<DashboardAgendaEvent[]>(() => {
    const futuros = dados.agenda.filter(e => new Date(e.start_time) >= agora);
    const proximoId = futuros[0]?.id;

    return dados.agenda.map(e => {
      const minutos = differenceInMinutes(new Date(e.start_time), agora);
      return {
        id: e.id,
        title: e.title,
        startTime: e.start_time,
        durationMinutes: e.end_time
          ? differenceInMinutes(new Date(e.end_time), new Date(e.start_time))
          : null,
        isNext: e.id === proximoId,
        startingSoon: minutos >= 0 && minutos <= 30,
      };
    });
  }, [dados.agenda, agora]);

  const proximoEvento = agenda.find(e => e.isNext) ?? null;

  const prioridade = useMemo(
    () => selecionarPrioridadeDoDia({
      overdueCards: dados.overdueCards,
      upcomingDeliveries: dados.upcomingDeliveries,
      nextEvent: proximoEvento ?? undefined,
      pendingApprovals: dados.pendingApprovals,
      approvalOldestHours: dados.approvalOldestHours,
      agora,
    }),
    [dados.overdueCards, dados.upcomingDeliveries, proximoEvento, dados.pendingApprovals, dados.approvalOldestHours, agora],
  );

  const alertas = useMemo(
    () => gerarAlertasOperacionais({
      temaJaCoberto: temaDaPrioridade(prioridade),
      overdueCards: dados.overdueCards,
      dueTodayCount: dados.dueTodayCount,
      pendingApprovals: dados.pendingApprovals,
      agora,
    }),
    [dados.overdueCards, dados.dueTodayCount, dados.pendingApprovals, prioridade, agora],
  );

  return (
    <AppLayout>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="truncate text-sm text-muted-foreground">
              Visão geral do workspace {currentWorkspace?.name ?? ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  <span className="max-w-[9rem] truncate">
                    {espacoAtual?.name ?? 'Todos os espaços'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setSpaceId(undefined)}
                  className={!spaceId ? 'font-medium' : undefined}
                >
                  Todos os espaços
                </DropdownMenuItem>
                {(spaces ?? []).map(e => (
                  <DropdownMenuItem
                    key={e.id}
                    onClick={() => setSpaceId(e.id)}
                    className={e.id === spaceId ? 'font-medium' : undefined}
                  >
                    {e.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarRange className="h-4 w-4" aria-hidden="true" />
                  {period.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {OPCOES_PERIODO.map(op => (
                  <DropdownMenuItem
                    key={op.id}
                    onClick={() => selecionarPeriodo(op.id)}
                    className={op.id === periodId ? 'font-medium' : undefined}
                  >
                    {op.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <QuickActionMenu />
          </div>
        </header>

        {/* Erro num widget nao derruba a pagina: o painel avisa e o resto segue. */}
        {dados.error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Não foi possível carregar alguns indicadores.</p>
            <p className="mt-0.5 text-muted-foreground">Os blocos abaixo podem estar incompletos.</p>
          </div>
        )}

        <DashboardKpiGrid
          summary={dados.summary}
          isLoading={dados.isLoading}
          nextEvent={proximoEvento}
          criticos={dados.overdueCards.filter(c => c.overdueDays >= 3).length}
        />

        <TodayFocusPanel
          agora={agora}
          prioridade={prioridade}
          agenda={agenda}
          entregas={dados.upcomingDeliveries}
          alertas={alertas}
          isLoading={dados.isLoading}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HoursPerDayChart dados={dados.hoursByDay} isLoading={dados.isLoading} />
          <StatusDistributionChart
            dados={dados.statusDistribution}
            total={dados.summary.totalCards}
            isLoading={dados.isLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {permissoes.canViewClientFinancials && <ClientHealthWidget />}
          <OverdueCardsWidget cards={dados.overdueCards} isLoading={dados.isLoading} />
          {permissoes.canViewCoordination && !spaceId && (
            <SpaceBottleneckWidget espacos={dados.bottlenecks} isLoading={dados.isLoading} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
