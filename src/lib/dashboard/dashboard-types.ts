import type { CardStatus } from '@/lib/supabase';

/**
 * Tipos do Dashboard.
 *
 * Duas noções de tempo convivem aqui e não podem ser misturadas:
 *
 * - `periodo` é a janela de análise que a pessoa escolhe (esta semana, mês
 *   passado...). Vale para volume, comparações e tendência.
 * - `agora` é o instante real. Vale para atraso, vencimento hoje, próxima
 *   reunião — coisas que não fazem sentido "no mês passado".
 *
 * Selecionar "mês passado" não pode fazer o app dizer que existem 8 cards
 * atrasados naquela época como se fossem pendências de agora.
 */

export type DashboardPeriodId =
  | 'hoje'
  | 'esta_semana'
  | 'semana_passada'
  | 'ultimos_7_dias'
  | 'este_mes'
  | 'mes_passado'
  | 'personalizado';

export interface DashboardPeriod {
  id: DashboardPeriodId;
  label: string;
  /** Início inclusivo, em ISO. */
  start: string;
  /** Fim inclusivo, em ISO. */
  end: string;
  /** Janela anterior de mesma duração, para o delta "vs período anterior". */
  previousStart: string;
  previousEnd: string;
}

export interface DashboardFilters {
  workspaceId: string;
  period: DashboardPeriod;
  spaceId?: string;
  folderId?: string;
  viewId?: string;
  clientId?: string;
  userId?: string;
}

/** Variação entre o período atual e o anterior. */
export interface DashboardDelta {
  /** Diferença absoluta (ex.: +2 cards atrasados). */
  absolute: number;
  /**
   * Variação percentual, ou null quando o período anterior é zero.
   *
   * Null em vez de 0 ou Infinity de propósito: "saiu de 0 para 5" não é
   * "aumento de 500%", é uma comparação que não existe. A tela mostra só o
   * número absoluto nesse caso.
   */
  percent: number | null;
  /** true quando subir é bom (entregas); false quando subir é ruim (atrasos). */
  higherIsBetter: boolean;
}

export interface DashboardSummary {
  totalCards: number;
  completedCards: number;
  productionCards: number;
  overdueCards: number;
  /** Minutos efetivamente registrados, incluindo timer em andamento. */
  trackedMinutes: number;
  targetMinutes: number | null;
  todayAgendaCount: number;

  deltas: {
    totalCards: DashboardDelta;
    productionCards: DashboardDelta;
    /**
     * Ausente de propósito: não há histórico de atrasados no banco, e
     * comparar pendências de agora com cards antigos produzia percentuais
     * absurdos (+2600%). Melhor não afirmar do que afirmar errado.
     */
    overdueCards?: DashboardDelta;
  };
}

export interface DashboardDelivery {
  cardId: string;
  title: string;
  dueDate: string;
  spaceName?: string;
  clientName?: string;
  /** "Hoje", "Amanhã", "Em 5 dias" — já resolvido para exibição. */
  relativeLabel: string;
}

export interface DashboardAgendaEvent {
  id: string;
  title: string;
  startTime: string;
  durationMinutes: number | null;
  spaceName?: string;
  isNext: boolean;
  /** Começa em até 30 minutos. */
  startingSoon: boolean;
}

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  count?: number;
  route?: string;
  actionLabel?: string;
}

export interface OverdueCard {
  cardId: string;
  title: string;
  dueDate: string;
  overdueDays: number;
  status: CardStatus;
  urgency: string | null;
  spaceName?: string;
  assigneeName?: string;
  /** Peso usado para ordenar; ver dashboard-priority. */
  score: number;
}

export interface SpaceBottleneck {
  spaceId: string;
  spaceName: string;
  openCards: number;
  overdueCards: number;
  /** overdueCards / openCards. Distingue gargalo real de volume alto. */
  overdueRate: number;
  waitingApproval: number;
}

export interface TodayDashboardData {
  nextEvent?: DashboardAgendaEvent;
  agenda: DashboardAgendaEvent[];
  upcomingDeliveries: DashboardDelivery[];
  overdueCount: number;
  criticalOverdueCount: number;
  pendingApprovals: number;
  alerts: OperationalAlert[];
}
