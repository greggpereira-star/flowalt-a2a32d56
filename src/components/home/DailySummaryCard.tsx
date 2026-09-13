import { useNavigate } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HomeStatusTone } from '@/lib/home/home-types';

/**
 * Mapa de aparência por tom semântico.
 *
 * Centralizado de propósito: sem isso, cada card acaba com suas próprias
 * classes de cor e o Painel do Dia perde consistência conforme novos cards
 * são adicionados.
 */
const TONE_STYLES: Record<HomeStatusTone, { icon: string; value: string }> = {
  danger: { icon: 'bg-red-50 text-red-600', value: 'text-red-600' },
  warning: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-600' },
  success: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900' },
  info: { icon: 'bg-blue-50 text-blue-600', value: 'text-slate-900' },
  purple: { icon: 'bg-violet-50 text-violet-600', value: 'text-violet-600' },
  neutral: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
};

export interface DailySummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description?: string;
  meta?: string;
  tone?: HomeStatusTone;
  ctaLabel?: string;
  /** Rota interna. Quando ausente, o card não é clicável. */
  route?: string;
  isLoading?: boolean;
}

export function DailySummaryCard({
  icon: Icon,
  label,
  value,
  description,
  meta,
  tone = 'neutral',
  ctaLabel,
  route,
  isLoading,
}: DailySummaryCardProps) {
  const navigate = useNavigate();
  const styles = TONE_STYLES[tone];
  const isClickable = !!route;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-4 h-7 w-16 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', styles.icon)}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>

      <p className={cn('mt-1 text-2xl font-semibold tabular-nums leading-tight', styles.value)}>
        {value}
      </p>

      {(description || meta) && (
        <p className="mt-1 truncate text-xs text-slate-500">{meta ?? description}</p>
      )}

      {ctaLabel && isClickable && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors group-hover:text-indigo-600">
          {ctaLabel}
          <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </>
  );

  // Card clicável precisa ser <button>, não <div onClick>: sem isso não recebe
  // foco por teclado nem é anunciado como acionável por leitor de tela.
  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => navigate(route)}
        aria-label={`${label}: ${value}. ${ctaLabel ?? 'Abrir'}`}
        className={cn(
          'group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-left',
          'shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-all duration-200',
          'hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(16,24,40,0.06)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      {content}
    </div>
  );
}
