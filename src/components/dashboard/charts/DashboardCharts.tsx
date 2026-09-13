import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, PieChart as PieIcon, Lightbulb } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getCardStatusLabel } from '@/lib/cards/cardStatusLabels';
import type { CardStatus } from '@/lib/supabase';

/** Paleta por status, alinhada às cores semânticas do app. */
const COR_STATUS: Record<string, string> = {
  backlog: '#94A3B8',
  briefing: '#8B5CF6',
  todo: '#3B82F6',
  in_progress: '#F59E0B',
  review: '#EC4899',
  approved: '#10B981',
  delivered: '#16A34A',
};

export function HoursPerDayChart({ dados, isLoading }: {
  dados: { dia: string; horas: number }[]; isLoading?: boolean;
}) {
  const serie = useMemo(
    () => dados.map(d => ({ ...d, label: format(parseISO(d.dia), 'EEE', { locale: ptBR }) })),
    [dados],
  );

  const total = serie.reduce((s, d) => s + d.horas, 0);

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Horas por Dia
        </h2>
        <p className="text-xs text-muted-foreground">Tempo registrado no período</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : total === 0 ? (
        // Zero horas é informação: ou ninguém registrou, ou os timers não
        // estão em uso. Gráfico vazio sem texto pareceria falha de carga.
        <div className="flex h-40 flex-col items-center justify-center text-center">
          <p className="text-sm font-medium">Nenhuma hora registrada</p>
          <p className="text-xs text-muted-foreground">Ninguém apontou tempo neste período.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} />
            <ReTooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
              contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid hsl(var(--border))' }}
              formatter={(v: number) => [`${v.toFixed(1)}h`, 'Registradas']}
            />
            <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export function StatusDistributionChart({ dados, total, isLoading }: {
  dados: { status: CardStatus; count: number; percent: number }[];
  total: number;
  isLoading?: boolean;
}) {
  const serie = dados.map(d => ({
    ...d,
    label: getCardStatusLabel(d.status),
    cor: COR_STATUS[d.status] ?? '#94A3B8',
  }));

  const maior = serie[0];

  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PieIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Distribuição por Status
        </h2>
        <p className="text-xs text-muted-foreground">Cards agrupados por etapa</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : total === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">Nenhum card ativo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={serie} dataKey="count" nameKey="label"
                  innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}
                >
                  {serie.map(d => <Cell key={d.status} fill={d.cor} />)}
                </Pie>
                <ReTooltip
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid hsl(var(--border))' }}
                  formatter={(v: number, n) => [`${v} cards`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{total}</span>
              <span className="text-[11px] text-muted-foreground">Total</span>
            </div>
          </div>

          <ul className="space-y-1 self-center">
            {serie.map(d => (
              <li key={d.status} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.cor }} />
                <span className="min-w-0 flex-1 truncate">{d.label}</span>
                <span className="tabular-nums text-muted-foreground">{d.count}</span>
                <span className="w-8 text-right tabular-nums text-muted-foreground">
                  {d.percent.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && maior && total > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">{maior.label}</span> concentra{' '}
            {maior.percent.toFixed(0)}% dos cards ativos.
          </span>
        </p>
      )}
    </section>
  );
}
