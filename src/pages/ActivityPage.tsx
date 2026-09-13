import { useMemo, useState } from 'react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, CheckCircle2, MessageSquare, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useRecentActivity } from '@/hooks/home/useRecentActivity';
import { cn } from '@/lib/utils';
import type { HomeActivityItem } from '@/lib/home/home-types';

type ActivityFilter = 'all' | 'comment' | 'created' | 'done';

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'comment', label: 'Comentários' },
  { key: 'created', label: 'Criados' },
  { key: 'done', label: 'Concluídos' },
];

/**
 * O tipo é derivado do prefixo do id montado em useRecentActivity
 * (comment- / created- / done-), evitando duplicar a consulta só para
 * carregar um campo a mais.
 */
function activityKind(item: HomeActivityItem): ActivityFilter {
  if (item.id.startsWith('comment-')) return 'comment';
  if (item.id.startsWith('created-')) return 'created';
  if (item.id.startsWith('done-')) return 'done';
  return 'all';
}

const KIND_ICON = {
  comment: { icon: MessageSquare, className: 'bg-blue-50 text-blue-600' },
  created: { icon: Plus, className: 'bg-violet-50 text-violet-600' },
  done: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' },
  all: { icon: Activity, className: 'bg-slate-100 text-slate-600' },
} as const;

/** Agrupa por dia para dar noção de tempo sem repetir a data em cada linha. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "d 'de' MMMM", { locale: ptBR });
}

export default function ActivityPage() {
  usePageTracking();

  const [filter, setFilter] = useState<ActivityFilter>('all');
  const { data, isLoading, error } = useRecentActivity(60);

  const grouped = useMemo(() => {
    const items = (data ?? []).filter(
      (item) => filter === 'all' || activityKind(item) === filter,
    );

    const byDay = new Map<string, HomeActivityItem[]>();
    items.forEach((item) => {
      const key = dayLabel(item.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    });

    return Array.from(byDay.entries());
  }, [data, filter]);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Activity className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
            Atividade
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Movimentações recentes do workspace
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar atividade">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">Não foi possível carregar a atividade.</p>
          </div>
        )}

        {!isLoading && !error && grouped.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Activity className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-900">
              Sem movimentações {filter === 'all' ? 'recentes' : 'neste filtro'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              As ações do time aparecerão aqui.
            </p>
          </div>
        )}

        {!isLoading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([day, items]) => (
              <section key={day}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {day}
                </h2>

                <ul className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                  {items.map((item, index) => {
                    const kind = activityKind(item);
                    const config = KIND_ICON[kind];
                    const Icon = config.icon;

                    return (
                      <li
                        key={item.id}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3',
                          index > 0 && 'border-t border-slate-100',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                            config.className,
                          )}
                          aria-hidden="true"
                        >
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium text-slate-900">{item.actor}</span>{' '}
                            {item.actionText}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
