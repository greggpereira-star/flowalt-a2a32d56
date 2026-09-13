import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarX2,
  Share2,
  Timer,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { DailySummaryCard } from './DailySummaryCard';
import { describeWaitingSince, formatDurationHMS } from '@/lib/home/home-utils';
import type { HomeActiveTimer, HomeMetrics } from '@/lib/home/home-types';

interface DailyOverviewProps {
  metrics: HomeMetrics;
  activeTimer: HomeActiveTimer | null;
  isLoading?: boolean;
}

/**
 * Contador do timer.
 *
 * O tempo decorrido é calculado no cliente a partir de `started_at`. Consultar
 * o servidor a cada segundo para exibir um relógio seria desperdício puro: o
 * dado necessário (o instante de início) não muda enquanto o timer roda.
 */
function useElapsedSeconds(startedAt: string | undefined) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const compute = () =>
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

export function DailyOverview({ metrics, activeTimer, isLoading }: DailyOverviewProps) {
  const elapsed = useElapsedSeconds(activeTimer?.startedAt);

  return (
    <section aria-labelledby="daily-overview-title">
      <div className="mb-4">
        <h2 id="daily-overview-title" className="text-[15px] font-semibold text-slate-900">
          Painel do Dia
        </h2>
        <p className="text-sm text-slate-500">Seu resumo inteligente para agir com foco.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <DailySummaryCard
          icon={TriangleAlert}
          label="Atenção urgente"
          value={String(metrics.urgentTasks)}
          description="Tarefas críticas"
          tone={metrics.urgentTasks > 0 ? 'danger' : 'success'}
          ctaLabel="Ver agora"
          route="/tasks"
          isLoading={isLoading}
        />

        <DailySummaryCard
          icon={Zap}
          label="Próximas entregas"
          value={String(metrics.deliveriesNext4h)}
          description="nas próximas 4h"
          tone={metrics.deliveriesNext4h > 0 ? 'warning' : 'neutral'}
          ctaLabel="Ver entregas"
          route="/tasks"
          isLoading={isLoading}
        />

        <DailySummaryCard
          icon={Timer}
          label="Timer ativo"
          value={activeTimer ? formatDurationHMS(elapsed) : '00:00:00'}
          meta={
            activeTimer
              ? activeTimer.isCurrentUser
                ? 'Seu timer em andamento'
                : activeTimer.userName
              : 'Nenhum timer rodando'
          }
          tone={activeTimer ? 'info' : 'neutral'}
          ctaLabel="Ver tempo"
          route="/time"
          isLoading={isLoading}
        />

        <DailySummaryCard
          icon={Share2}
          label="Falhas de publicação"
          value={String(metrics.publishingFailuresToday)}
          description="Hoje"
          // Zero falhas é uma boa notícia, não um número neutro.
          tone={metrics.publishingFailuresToday > 0 ? 'danger' : 'success'}
          ctaLabel="Ver publicações"
          route="/marketing"
          isLoading={isLoading}
        />

        <DailySummaryCard
          icon={BadgeCheck}
          label="Aprovações pendentes"
          value={String(metrics.approvals.total)}
          description={describeWaitingSince(metrics.approvals.oldestPendingAt)}
          tone={metrics.approvals.total > 0 ? 'purple' : 'success'}
          ctaLabel="Ver aprovações"
          route="/altcontrol"
          isLoading={isLoading}
        />

        {/* Substitui "Mensagens não lidas" do desenho original: não existe
            sistema de mensagens no banco, e inventar um contador seria pior
            que não ter o card. Tarefas atrasadas é dado real e acionável. */}
        <DailySummaryCard
          icon={CalendarX2}
          label="Tarefas atrasadas"
          value={String(metrics.overdueTasks)}
          description={metrics.overdueTasks > 0 ? 'Precisam de atenção' : 'Nenhum atraso'}
          tone={metrics.overdueTasks > 0 ? 'danger' : 'success'}
          ctaLabel="Ver tarefas"
          route="/tasks"
          isLoading={isLoading}
        />
      </div>
    </section>
  );
}
