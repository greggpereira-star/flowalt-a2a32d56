import { SlidersHorizontal } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useHomeDashboard } from '@/hooks/home/useHomeDashboard';
import { DailyOverview } from '@/components/home/DailyOverview';
import { TodayAgenda } from '@/components/home/TodayAgenda';
import { OperationalMetrics } from '@/components/home/OperationalMetrics';
import { DailyInsights } from '@/components/home/DailyInsights';
import { MyTasksWidget } from '@/components/home/MyTasksWidget';
import { RecentActivityWidget } from '@/components/home/RecentActivityWidget';
import { useRecentActivity } from '@/hooks/home/useRecentActivity';
import { AltControlPendingWidget } from '@/components/altcontrol/AltControlPendingWidget';
import { BirthdayBanner } from '@/components/notices/BirthdayBanner';
import { HolidayBanner } from '@/components/notices/HolidayBanner';

/**
 * Home V2 — painel operacional do dia.
 *
 * A composição segue a prioridade de leitura definida no produto: primeiro o
 * que exige ação (Painel do Dia), depois o compromisso mais próximo (Agenda),
 * e só então volume operacional e módulos. Os banners de aniversário e feriado
 * foram preservados da Home anterior — são parte da cultura da agência, não
 * ruído a ser removido numa reformulação visual.
 */
export default function HomePage() {
  // Sem argumento de propósito: o union ModuleName não tem 'home', e inventar
  // um valor só para preencher quebraria a tipagem do rastreamento.
  usePageTracking();

  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const {
    metrics,
    insights,
    agenda,
    priorityTasks,
    activeTimer,
    isLoading,
    errors,
    refetchAll,
  } = useHomeDashboard();

  const activity = useRecentActivity(5);

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'por aqui';

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-7">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
              Olá, {firstName}!
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Aqui está o que importa hoje
              {currentWorkspace?.name ? ` no ${currentWorkspace.name}` : ''}.
            </p>
          </div>

          {/* Personalização de widgets ainda não está disponível; o botão só
              aparece quando houver a tela, para não oferecer algo que não
              responde ao clique. */}
          {false && (
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Personalizar
            </Button>
          )}
        </header>

        <div className="space-y-5">
          <HolidayBanner />
          <BirthdayBanner />

          <DailyOverview
            metrics={metrics}
            activeTimer={activeTimer}
            isLoading={isLoading.tasks || isLoading.metrics}
          />

          {/* A agenda ocupa a coluna maior: é o bloco que responde "qual é o
              meu próximo compromisso?", a pergunta mais frequente da tela. */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
            <TodayAgenda
              events={agenda}
              isLoading={isLoading.agenda}
              error={errors.agenda}
              onRetry={refetchAll}
            />
            <OperationalMetrics metrics={metrics} />
          </section>

          <DailyInsights insights={insights} />

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <MyTasksWidget tasks={priorityTasks} isLoading={isLoading.tasks} />
            <AltControlPendingWidget />
            <RecentActivityWidget items={activity.data ?? []} isLoading={activity.isLoading} />
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
