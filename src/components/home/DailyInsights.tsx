import { AlertCircle, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HomeInsight, HomeInsightSeverity } from '@/lib/home/home-types';

const SEVERITY_CONFIG: Record<
  HomeInsightSeverity,
  { icon: typeof Info; className: string; srLabel: string }
> = {
  // srLabel existe porque a severidade não pode ser comunicada só por cor —
  // quem usa leitor de tela precisa saber que é um alerta e não um elogio.
  critical: { icon: AlertCircle, className: 'text-red-600', srLabel: 'Crítico:' },
  warning: { icon: AlertCircle, className: 'text-amber-600', srLabel: 'Atenção:' },
  opportunity: { icon: Lightbulb, className: 'text-violet-600', srLabel: 'Oportunidade:' },
  success: { icon: CheckCircle2, className: 'text-emerald-600', srLabel: 'Tudo certo:' },
};

export function DailyInsights({ insights }: { insights: HomeInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <section
      aria-labelledby="daily-insights-title"
      className="rounded-2xl border border-slate-200/80 bg-white px-6 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <h2
          id="daily-insights-title"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-900"
        >
          <Lightbulb className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
          Insights do dia
        </h2>

        <ul className="flex flex-1 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-2">
          {insights.map((insight) => {
            const config = SEVERITY_CONFIG[insight.severity];
            const Icon = config.icon;

            return (
              <li key={insight.key} className="flex items-start gap-2 text-sm text-slate-600">
                <Icon
                  className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.className)}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className="sr-only">{config.srLabel}</span>
                <span>{insight.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
