/**
 * Contratos da Home V2.
 *
 * Os valores de `CardUrgency` e `CardStatus` espelham os enums reais do banco
 * (verificados em pg_enum), não uma suposição: urgency = low|medium|high|critical
 * e status = backlog|briefing|todo|in_progress|review|approved|delivered|archived.
 */

export type HomeStatusTone =
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'purple'
  | 'neutral';

export type CardUrgency = 'low' | 'medium' | 'high' | 'critical';

export type CardStatus =
  | 'backlog'
  | 'briefing'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'delivered'
  | 'archived';

/** Status que significam "não é mais trabalho pendente". */
export const CLOSED_CARD_STATUSES: CardStatus[] = ['delivered', 'archived'];

export interface HomeTaskItem {
  id: string;
  title: string;
  urgency: CardUrgency;
  status: CardStatus;
  dueDate: string | null;
  spaceId: string | null;
  completedAt: string | null;
}

export interface HomeAgendaEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  eventType: string | null;
  color: string | null;
  cardId: string | null;
  /** Calculado no cliente: primeiro evento que ainda vai começar. */
  isNext: boolean;
  isPast: boolean;
}

export interface HomeActiveTimer {
  id: string;
  userId: string;
  userName: string;
  cardId: string | null;
  cardTitle: string | null;
  startedAt: string;
  isCurrentUser: boolean;
}

export interface HomeApprovalSummary {
  total: number;
  oldestPendingAt: string | null;
}

/** Números crus que alimentam tanto os cards quanto o motor de insights. */
export interface HomeMetrics {
  overdueTasks: number;
  urgentTasks: number;
  deliveriesNext4h: number;
  pendingTasks: number;
  dueTodayTasks: number;
  deliveredToday: number;
  scheduledToday: number;
  trackedSecondsToday: number;
  publishingFailuresToday: number;
  approvals: HomeApprovalSummary;
  nextEventMinutes: number | null;
}

export type HomeInsightSeverity = 'critical' | 'warning' | 'opportunity' | 'success';

export interface HomeInsight {
  key: string;
  severity: HomeInsightSeverity;
  text: string;
}

export interface HomeActivityItem {
  id: string;
  actor: string;
  actionText: string;
  createdAt: string;
  route: string | null;
}
