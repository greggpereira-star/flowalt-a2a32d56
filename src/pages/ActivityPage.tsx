import { useMemo, useState } from 'react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, CheckCircle2, MessageSquare, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useRecentActivity } from '@/hooks/home/useRecentActivity';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
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

  const { inicio: novo } = useNewUiBeta();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const { data, isLoading, error } = useRecentActivity(60);

  // Visual novo: contagem por tipo (nos filtros) e quem mais aparece nas movimentações carregadas
  const contagens = useMemo(() => {
    const c: Record<ActivityFilter, number> = { all: 0, comment: 0, created: 0, done: 0 };
    (data ?? []).forEach((item) => {
      c.all += 1;
      c[activityKind(item)] += 1;
    });
    return c;
  }, [data]);

  const maisAtivos = useMemo(() => {
    const porPessoa = new Map<string, number>();
    (data ?? []).forEach((item) => {
      if (!item.actor || item.actor === 'Alguém') return;
      porPessoa.set(item.actor, (porPessoa.get(item.actor) ?? 0) + 1);
    });
    return Array.from(porPessoa.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data]);

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

  if (novo) {
    const maiorContagem = maisAtivos[0]?.[1] ?? 1;
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 sm:px-8 sm:py-8 sm:pb-10">
          <header className="mb-6">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">Atividade</h1>
            <p className="mt-1 text-sm text-muted-foreground">Movimentações recentes do workspace</p>
          </header>

          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
            <div className="min-w-0 flex-1">
              {/* Filtros com contagem */}
              <div
                className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Filtrar atividade"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={cn(
                      'h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-colors',
                      filter === f.key
                        ? 'bg-foreground text-background'
                        : 'border border-border/60 bg-card text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f.label}
                    {!isLoading && <span className="ml-1.5 tabular-nums opacity-60">{contagens[f.key]}</span>}
                  </button>
                ))}
              </div>

              {isLoading && (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              )}

              {!isLoading && error && (
                <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Não foi possível carregar a atividade.</p>
                </div>
              )}

              {!isLoading && !error && grouped.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  </span>
                  <p className="mt-3 text-[15px] font-bold">
                    Sem movimentações {filter === 'all' ? 'recentes' : 'neste filtro'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">As ações do time aparecerão aqui.</p>
                </div>
              )}

              {!isLoading && !error && grouped.length > 0 && (
                <div className="space-y-7">
                  {grouped.map(([day, items]) => (
                    <section key={day}>
                      <h2 className="mb-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80">
                        {day}
                      </h2>
                      <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                        {items.map((item, index) => {
                          const kind = activityKind(item);
                          const config = KIND_ICON[kind];
                          const Icon = config.icon;
                          return (
                            <li
                              key={item.id}
                              className={cn(
                                'flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5',
                                index > 0 && 'border-t border-border/50',
                              )}
                            >
                              <span
                                className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', config.className)}
                                aria-hidden="true"
                              >
                                <Icon className="h-4 w-4" strokeWidth={2} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] leading-snug text-foreground/80">
                                  <span className="font-bold text-foreground">{item.actor}</span> {item.actionText}
                                </p>
                                <p className="mt-0.5 text-[12px] text-muted-foreground sm:hidden">
                                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                                </p>
                              </div>
                              <span className="hidden shrink-0 pt-0.5 text-[12px] text-muted-foreground sm:block">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {/* Quem mais aparece nas movimentações carregadas */}
            {!isLoading && !error && maisAtivos.length > 0 && (
              <aside className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm xl:sticky xl:top-6 xl:w-80 xl:shrink-0">
                <h2 className="text-[15px] font-bold tracking-tight">Mais ativos</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">Nas últimas {contagens.all} movimentações</p>
                <ul className="mt-4 space-y-3">
                  {maisAtivos.map(([nome, n]) => (
                    <li key={nome}>
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate font-semibold">{nome}</span>
                        <span className="tabular-nums text-muted-foreground">{n}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (n / maiorContagem) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

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
