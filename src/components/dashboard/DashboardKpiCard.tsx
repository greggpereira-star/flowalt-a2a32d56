import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardDelta } from '@/lib/dashboard/dashboard-types';

export type KpiTone = 'neutral' | 'danger' | 'success';

interface DashboardKpiCardProps {
  label: string;
  value: string | number;
  /** Linha logo abaixo do número: "40 entregues", "3% do total". */
  caption?: string;
  icon: LucideIcon;
  delta?: DashboardDelta;
  /** Texto do rodapé quando não há delta: "Meta: 20h/semana". */
  footer?: React.ReactNode;
  tone?: KpiTone;
  /** Para onde o card leva. Sem isto o card não é clicável. */
  href?: string;
  isLoading?: boolean;
}

/**
 * Card de indicador do Dashboard.
 *
 * Duas escolhas que valem explicação:
 *
 * O tom de alerta só aparece quando há motivo. Um card de atrasados com valor
 * zero fica neutro, não vermelho: pintar de vermelho um "0" ensina o olho a
 * ignorar a cor, e aí ela não serve quando o número realmente subir.
 *
 * O delta sabe se subir é bom. "+2 atrasados" é ruim e "+12% de cards" é bom —
 * a mesma seta para cima com cores opostas. Sem isso, a cor viraria enfeite.
 */
export function DashboardKpiCard({
  label, value, caption, icon: Icon, delta, footer, tone = 'neutral', href, isLoading,
}: DashboardKpiCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-8 w-16" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    );
  }

  const clicavel = !!href;
  const alerta = tone === 'danger';

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            alerta ? 'bg-destructive/10 text-destructive'
              : tone === 'success' ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </span>
      </div>

      <p className={cn(
        'mt-2 text-2xl font-semibold tabular-nums tracking-tight',
        alerta && 'text-destructive',
      )}>
        {value}
      </p>

      {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}

      {(delta || footer) && (
        <div className="mt-3 border-t border-border/50 pt-2 text-xs">
          {delta ? <DeltaLinha delta={delta} /> : footer}
        </div>
      )}
    </>
  );

  const classes = cn(
    'rounded-xl border bg-card p-4 sm:p-5 text-left transition-colors',
    alerta ? 'border-destructive/30' : 'border-border/60',
    clicavel && 'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );

  if (!clicavel) return <div className={classes}>{conteudo}</div>;

  return (
    <button type="button" className={classes} onClick={() => navigate(href)}>
      {conteudo}
    </button>
  );
}

function DeltaLinha({ delta }: { delta: DashboardDelta }) {
  const { absolute, percent, higherIsBetter } = delta;

  if (absolute === 0) {
    return <span className="text-muted-foreground">Sem variação</span>;
  }

  const subiu = absolute > 0;
  const bom = subiu === higherIsBetter;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;

  // Período anterior zerado não gera percentual: "de 0 para 5" não é 500%.
  const texto = percent === null
    ? `${subiu ? '+' : ''}${absolute}`
    : `${subiu ? '+' : ''}${percent.toFixed(0)}%`;

  return (
    <span className="flex items-center gap-1">
      <span className={cn('inline-flex items-center font-medium', bom ? 'text-emerald-600' : 'text-destructive')}>
        <Seta className="mr-0.5 h-3 w-3" aria-hidden="true" />
        {texto}
      </span>
      <span className="text-muted-foreground">vs período anterior</span>
    </span>
  );
}
