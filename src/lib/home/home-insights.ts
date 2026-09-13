import type { HomeInsight, HomeInsightSeverity, HomeMetrics } from './home-types';

const SEVERITY_ORDER: Record<HomeInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  success: 3,
};

const MAX_INSIGHTS = 4;

/**
 * Motor de insights da Home — regras simples sobre números já apurados.
 *
 * Duas decisões de produto embutidas aqui:
 *
 * 1. Teto de 4 mensagens. Uma faixa com 10 avisos deixa de ser insight e vira
 *    ruído: o usuário para de ler. As mais graves ganham as vagas.
 *
 * 2. Mensagens positivas só aparecem quando NÃO há nada crítico. Dizer
 *    "nenhuma falha de publicação hoje" ao lado de "3 tarefas atrasadas"
 *    dilui o que importa.
 */
export function generateDailyInsights(metrics: HomeMetrics): HomeInsight[] {
  const insights: HomeInsight[] = [];

  if (metrics.overdueTasks > 0) {
    insights.push({
      key: 'overdue_tasks',
      severity: 'critical',
      text:
        metrics.overdueTasks === 1
          ? 'Você tem 1 tarefa atrasada.'
          : `Você tem ${metrics.overdueTasks} tarefas atrasadas.`,
    });
  }

  if (metrics.nextEventMinutes !== null && metrics.nextEventMinutes <= 60) {
    insights.push({
      key: 'next_event',
      severity: metrics.nextEventMinutes <= 30 ? 'critical' : 'warning',
      text:
        metrics.nextEventMinutes <= 1
          ? 'Seu próximo compromisso está começando agora.'
          : `Seu próximo compromisso começa em ${metrics.nextEventMinutes} minutos.`,
    });
  }

  if (metrics.deliveriesNext4h > 0) {
    insights.push({
      key: 'next_four_hours',
      severity: 'warning',
      text:
        metrics.deliveriesNext4h === 1
          ? 'Você tem 1 entrega nas próximas 4 horas.'
          : `Você tem ${metrics.deliveriesNext4h} entregas nas próximas 4 horas.`,
    });
  }

  if (metrics.publishingFailuresToday > 0) {
    insights.push({
      key: 'publishing_failures',
      severity: 'critical',
      text:
        metrics.publishingFailuresToday === 1
          ? '1 publicação falhou hoje e precisa de atenção.'
          : `${metrics.publishingFailuresToday} publicações falharam hoje.`,
    });
  }

  if (metrics.approvals.total > 0 && metrics.approvals.oldestPendingAt) {
    const hoursWaiting =
      (Date.now() - new Date(metrics.approvals.oldestPendingAt).getTime()) / 3_600_000;

    if (hoursWaiting >= 24) {
      insights.push({
        key: 'approval_old',
        severity: 'warning',
        text:
          metrics.approvals.total === 1
            ? '1 aprovação aguarda desde ontem.'
            : `${metrics.approvals.total} aprovações aguardam desde ontem.`,
      });
    }
  }

  const hasCritical = insights.some((i) => i.severity === 'critical');

  // Reforço positivo só quando não há nada urgente competindo por atenção.
  if (!hasCritical) {
    if (metrics.publishingFailuresToday === 0) {
      insights.push({
        key: 'publishing_ok',
        severity: 'success',
        text: 'Nenhuma falha de publicação hoje.',
      });
    }

    if (metrics.overdueTasks === 0 && metrics.pendingTasks > 0) {
      insights.push({
        key: 'no_overdue',
        severity: 'success',
        text: 'Nenhuma tarefa atrasada. Você está em dia com os prazos.',
      });
    }

    if (metrics.pendingTasks === 0 && metrics.scheduledToday === 0) {
      insights.push({
        key: 'all_clear',
        severity: 'success',
        text: 'Nada pendente para hoje. Bom momento para adiantar o que vem.',
      });
    }
  }

  return insights
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_INSIGHTS);
}
