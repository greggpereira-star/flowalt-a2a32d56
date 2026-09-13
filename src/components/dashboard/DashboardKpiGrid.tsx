import { LayoutGrid, PlayCircle, AlertTriangle, Timer, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard';
import { Progress } from '@/components/ui/progress';
import { getCardStatusLabel } from '@/lib/cards/cardStatusLabels';
import type { DashboardSummary } from '@/lib/dashboard/dashboard-types';

interface DashboardKpiGridProps {
  summary: DashboardSummary;
  /** Atrasados há mais de 3 dias, para o rodapé do card. */
  criticos?: number;
  isLoading: boolean;
  /** Próximo evento de hoje, para o rodapé do card de agenda. */
  nextEvent?: { title: string; startTime: string } | null;
}

/**
 * Os cinco indicadores do topo.
 *
 * Todos levam a algum lugar com o filtro já aplicado (§43–44): um número que
 * informa mas não deixa agir obriga a pessoa a refazer o filtro na mão em
 * outra tela, e aí ela para de clicar.
 */
export function DashboardKpiGrid({ summary, isLoading, nextEvent, criticos = 0 }: DashboardKpiGridProps) {
  const {
    totalCards, completedCards, productionCards, overdueCards,
    trackedMinutes, targetMinutes, todayAgendaCount, deltas,
  } = summary;

  const horas = trackedMinutes / 60;
  const metaHoras = targetMinutes ? targetMinutes / 60 : null;
  const percentualMeta = metaHoras ? Math.min(100, Math.round((horas / metaHoras) * 100)) : null;

  const percentualProducao = totalCards > 0
    ? Math.round((productionCards / totalCards) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 sm:gap-4">
      <DashboardKpiCard
        label="Total de Cards"
        value={totalCards}
        caption={`${completedCards} ${completedCards === 1 ? 'entregue' : 'entregues'}`}
        icon={LayoutGrid}
        delta={deltas.totalCards}
        href="/tasks"
        isLoading={isLoading}
      />

      <DashboardKpiCard
        label={getCardStatusLabel('in_progress')}
        value={productionCards}
        caption={`${percentualProducao}% do total`}
        icon={PlayCircle}
        delta={deltas.productionCards}
        href="/tasks?status=in_progress"
        isLoading={isLoading}
      />

      {/* Zero atrasados nao e erro nem alerta: vira estado saudavel. Pintar de
          vermelho um zero ensina o olho a ignorar a cor. */}
      <DashboardKpiCard
        label="Atrasados"
        value={overdueCards}
        caption={overdueCards > 0 ? 'Precisa de atenção' : 'Nenhuma pendência'}
        icon={AlertTriangle}
        tone={overdueCards > 0 ? 'danger' : 'success'}
        delta={deltas.overdueCards}
        href="/tasks?filter=overdue"
        isLoading={isLoading}
        footer={
          !deltas.overdueCards && overdueCards > 0
            ? <span className="text-muted-foreground">{criticos} há mais de 3 dias</span>
            : undefined
        }
      />

      <DashboardKpiCard
        label="Horas do Período"
        value={`${horas.toFixed(1)}h`}
        caption="Registradas até agora"
        icon={Timer}
        href="/time"
        isLoading={isLoading}
        footer={
          metaHoras ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Meta: {metaHoras}h</span>
                <span className="tabular-nums">{percentualMeta}%</span>
              </div>
              <Progress value={percentualMeta ?? 0} className="h-1" />
            </div>
          ) : (
            // Sem meta configurada o rodape diz isso, em vez de inventar 40h
            // e exibir um percentual que nao corresponde a acordo nenhum.
            <span className="text-muted-foreground">Meta não configurada</span>
          )
        }
      />

      <DashboardKpiCard
        label="Agenda de Hoje"
        value={todayAgendaCount}
        caption="Eventos e entregas"
        icon={CalendarDays}
        href="/calendar"
        isLoading={isLoading}
        footer={
          nextEvent ? (
            <span className="text-muted-foreground">
              Próxima: {format(new Date(nextEvent.startTime), 'HH:mm', { locale: ptBR })} ·{' '}
              <span className="text-foreground/80">{nextEvent.title}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nada mais hoje</span>
          )
        }
      />
    </div>
  );
}
