import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HomeActivityItem } from '@/lib/home/home-types';

/** Iniciais para o avatar — evita depender de foto, que pode não existir. */
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface RecentActivityWidgetProps {
  items: HomeActivityItem[];
  isLoading?: boolean;
}

export function RecentActivityWidget({ items, isLoading }: RecentActivityWidgetProps) {
  const navigate = useNavigate();

  return (
    <section
      aria-labelledby="recent-activity-title"
      className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="recent-activity-title"
            className="flex items-center gap-2 text-base font-semibold text-slate-900"
          >
            <Activity className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.75} />
            Atividade Recente
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Últimas movimentações do workspace</p>
        </div>

        <Button variant="ghost" size="sm" onClick={() => navigate('/activity')}>
          Ver tudo
        </Button>
      </div>

      <div className="mt-4 flex-1">
        {isLoading && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
              <Activity className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-900">Sem movimentações recentes</p>
            <p className="mt-1 text-sm text-slate-500">
              As ações do time aparecerão aqui.
            </p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600"
                  aria-hidden="true"
                >
                  {initials(item.actor)}
                </span>

                <div className="min-w-0 flex-1">
                  {/* line-clamp em vez de truncate: o texto tem duas partes
                      (quem + o quê) e cortar na primeira linha esconderia
                      justamente a ação. */}
                  <p className="line-clamp-2 text-sm text-slate-700">
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
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
