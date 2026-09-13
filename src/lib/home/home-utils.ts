import { differenceInMinutes, isSameDay, startOfDay } from 'date-fns';
import {
  CLOSED_CARD_STATUSES,
  type CardUrgency,
  type HomeAgendaEvent,
  type HomeTaskItem,
} from './home-types';

/**
 * `cards.due_date` é timestamptz (tem hora real), então a comparação de
 * atraso é feita por instante — `due < agora` — e não por dia. Isso é
 * diferente de `transactions.due_date`, que é uma coluna `date` e exige
 * normalizar o início do dia. Confundir os dois foi a origem de um bug real
 * no financeiro, em que contas apareciam vencidas 3h antes da hora.
 */
export function isTaskOverdue(task: HomeTaskItem, now: Date = new Date()): boolean {
  if (!task.dueDate) return false;
  if (isTaskClosed(task)) return false;
  return new Date(task.dueDate) < now;
}

export function isTaskClosed(task: HomeTaskItem): boolean {
  if (task.completedAt) return true;
  return CLOSED_CARD_STATUSES.includes(task.status);
}

export function isDueToday(task: HomeTaskItem, now: Date = new Date()): boolean {
  if (!task.dueDate || isTaskClosed(task)) return false;
  return isSameDay(new Date(task.dueDate), now);
}

/** Entregas que vencem dentro da janela informada (padrão: 4 horas). */
export function isDueWithinHours(
  task: HomeTaskItem,
  hours = 4,
  now: Date = new Date(),
): boolean {
  if (!task.dueDate || isTaskClosed(task)) return false;
  const due = new Date(task.dueDate);
  const limit = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return due >= now && due <= limit;
}

const URGENCY_WEIGHT: Record<CardUrgency, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Ranking de prioridade para "Minhas Tarefas".
 *
 * Ordena por atraso → urgência → proximidade do prazo, nesta ordem. Ordenar
 * por `created_at`, como é comum, mostraria a tarefa mais antiga em vez da
 * mais urgente — que é justamente a pergunta que a Home precisa responder.
 * Quanto MAIOR o score, mais prioritária.
 */
export function rankTaskPriority(task: HomeTaskItem, now: Date = new Date()): number {
  let score = 0;

  if (isTaskOverdue(task, now)) score += 1000;
  score += URGENCY_WEIGHT[task.urgency] * 100;
  if (isDueToday(task, now)) score += 50;

  if (task.dueDate) {
    // Prazo mais próximo ganha um empurrão pequeno, sem passar por cima dos
    // critérios acima. Limitado para não distorcer prazos muito distantes.
    const minutesUntilDue = differenceInMinutes(new Date(task.dueDate), now);
    score += Math.max(0, 48 * 60 - Math.max(0, minutesUntilDue)) / (48 * 60) * 10;
  }

  return score;
}

export function sortTasksByPriority(
  tasks: HomeTaskItem[],
  now: Date = new Date(),
): HomeTaskItem[] {
  return [...tasks].sort((a, b) => rankTaskPriority(b, now) - rankTaskPriority(a, now));
}

/** Marca o próximo evento e os já encerrados, para a timeline da agenda. */
export function decorateAgendaEvents(
  events: Omit<HomeAgendaEvent, 'isNext' | 'isPast'>[],
  now: Date = new Date(),
): HomeAgendaEvent[] {
  const ordered = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const nextIndex = ordered.findIndex((e) => new Date(e.startTime) >= now);

  return ordered.map((event, index) => ({
    ...event,
    isNext: index === nextIndex,
    isPast: new Date(event.endTime ?? event.startTime) < now,
  }));
}

export function minutesUntilNextEvent(
  events: HomeAgendaEvent[],
  now: Date = new Date(),
): number | null {
  const next = events.find((e) => e.isNext);
  if (!next) return null;
  return Math.max(0, differenceInMinutes(new Date(next.startTime), now));
}

/** Segundos → "HH:MM" (usado no tempo registrado no dia). */
export function formatDurationHM(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Segundos → "HH:MM:SS" (usado no contador do timer ativo). */
export function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Rótulo humano para "há quanto tempo isso está parado".
 * Usado na descrição do card de aprovações.
 */
export function describeWaitingSince(
  isoDate: string | null,
  now: Date = new Date(),
): string {
  if (!isoDate) return 'Nenhuma pendência';

  const date = new Date(isoDate);
  const minutes = differenceInMinutes(now, date);

  if (minutes < 60) return 'Há poucos minutos';
  if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60);
    return `Há ${hours} hora${hours > 1 ? 's' : ''}`;
  }
  if (startOfDay(date).getTime() === startOfDay(new Date(now.getTime() - 86400000)).getTime()) {
    return 'Desde ontem';
  }

  const days = Math.floor(minutes / (60 * 24));
  return `Há ${days} dias`;
}
