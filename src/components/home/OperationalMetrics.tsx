import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock3, ClipboardCheck, SquareCheckBig } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { describeWaitingSince, formatDurationHM } from '@/lib/home/home-utils';
import type { HomeMetrics } from '@/lib/home/home-types';

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  /** Destaca a descrição quando ela representa uma pendência real. */
  emphasis?: boolean;
  route: string;
}

function OperationalMetricCard({
  icon: Icon,
  label,
  value,
  description,
  emphasis,
  route,
}: MetricProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(route)}
      aria-label={`${label}: ${value}. ${description}`}
      className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(16,24,40,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>

      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>

      <p className={emphasis ? 'mt-1 text-xs font-medium text-red-600' : 'mt-1 text-xs text-slate-500'}>
        {description}
      </p>
    </button>
  );
}

/**
 * Diferença proposital em relação ao Painel do Dia: lá o recorte é "o que
 * exige ação agora"; aqui é o volume operacional do dia. Repetir os mesmos
 * números nos dois lugares faria a tela parecer maior sem informar mais.
 */
export function OperationalMetrics({ metrics }: { metrics: HomeMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <OperationalMetricCard
        icon={SquareCheckBig}
        label="Tarefas pendentes"
        value={String(metrics.pendingTasks)}
        description={
          metrics.dueTodayTasks > 0
            ? `${metrics.dueTodayTasks} vencendo hoje`
            : 'Nenhuma vencendo hoje'
        }
        emphasis={metrics.dueTodayTasks > 0}
        route="/tasks"
      />

      <OperationalMetricCard
        icon={CalendarCheck}
        label="Entregas hoje"
        value={`${metrics.deliveredToday}/${metrics.scheduledToday}`}
        description="Programadas para hoje"
        route="/tasks"
      />

      <OperationalMetricCard
        icon={Clock3}
        label="Tempo registrado"
        value={formatDurationHM(metrics.trackedSecondsToday)}
        description="Registrado hoje"
        route="/time"
      />

      <OperationalMetricCard
        icon={ClipboardCheck}
        label="Aprovações"
        value={String(metrics.approvals.total)}
        description={describeWaitingSince(metrics.approvals.oldestPendingAt)}
        emphasis={metrics.approvals.total > 0}
        route="/altcontrol"
      />
    </div>
  );
}
