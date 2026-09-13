import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { endOfDay, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { generateDailyInsights } from '@/lib/home/home-insights';
import {
  decorateAgendaEvents,
  isDueToday,
  isDueWithinHours,
  isTaskClosed,
  isTaskOverdue,
  minutesUntilNextEvent,
  sortTasksByPriority,
} from '@/lib/home/home-utils';
import type {
  HomeActiveTimer,
  HomeAgendaEvent,
  HomeMetrics,
  HomeTaskItem,
} from '@/lib/home/home-types';

/**
 * Agregador de dados da Home.
 *
 * Usa useQueries para disparar tudo em PARALELO. O padrão a evitar aqui é o
 * waterfall (agenda → tarefas → timer → …), em que cada bloco só começa depois
 * que o anterior termina e a tela inteira fica refém da query mais lenta.
 *
 * Cada query carrega o workspaceId na queryKey — isolamento de tenant é
 * obrigatório: sem isso, trocar de workspace serviria o cache do anterior.
 */
export function useHomeDashboard() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const workspaceId = currentWorkspace?.id;
  const userId = user?.id;
  const enabled = !!workspaceId && !!userId;

  // Chave de dia: garante que a virada de meia-noite invalide o cache de hoje.
  const today = new Date();
  const dayKey = startOfDay(today).toISOString().slice(0, 10);
  const dayStart = startOfDay(today).toISOString();
  const dayEnd = endOfDay(today).toISOString();

  const results = useQueries({
    queries: [
      {
        // 0 — tarefas do usuário (base de atrasadas, urgentes e entregas)
        queryKey: ['home', 'my-tasks', workspaceId, userId],
        enabled,
        staleTime: 45_000,
        queryFn: async (): Promise<HomeTaskItem[]> => {
          const { data, error } = await supabase
            .from('cards')
            .select('id, title, urgency, status, due_date, space_id, completed_at')
            .eq('workspace_id', workspaceId!)
            .eq('owner_id', userId!)
            .not('status', 'in', '(delivered,archived)')
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(200);

          if (error) throw error;

          return (data ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            urgency: c.urgency,
            status: c.status,
            dueDate: c.due_date,
            spaceId: c.space_id,
            completedAt: c.completed_at,
          }));
        },
      },
      {
        // 1 — agenda de hoje
        queryKey: ['home', 'agenda', workspaceId, dayKey],
        enabled,
        staleTime: 60_000,
        queryFn: async (): Promise<HomeAgendaEvent[]> => {
          const { data, error } = await supabase
            .from('events')
            .select('id, title, start_time, end_time, all_day, location, event_type, color, card_id')
            .eq('workspace_id', workspaceId!)
            .gte('start_time', dayStart)
            .lte('start_time', dayEnd)
            .order('start_time', { ascending: true });

          if (error) throw error;

          return decorateAgendaEvents(
            (data ?? []).map((e) => ({
              id: e.id,
              title: e.title,
              startTime: e.start_time,
              endTime: e.end_time,
              allDay: !!e.all_day,
              location: e.location,
              eventType: e.event_type,
              color: e.color,
              cardId: e.card_id,
            })),
          );
        },
      },
      {
        // 2 — timer ativo (o do próprio usuário tem prioridade)
        queryKey: ['home', 'active-timer', workspaceId, userId],
        enabled,
        staleTime: 20_000,
        queryFn: async (): Promise<HomeActiveTimer | null> => {
          // Sem embed de profiles: as FKs de user_id apontam para auth.users,
          // não para public.profiles, então o PostgREST não consegue inferir
          // a relação e devolve PGRST200. O nome é resolvido numa segunda
          // consulta — mesmo padrão já usado em useCardHistory.
          const { data, error } = await supabase
            .from('time_entries')
            .select('id, user_id, card_id, started_at, cards(title)')
            .eq('workspace_id', workspaceId!)
            .eq('is_running', true)
            .order('started_at', { ascending: false })
            .limit(10);

          if (error) throw error;
          if (!data || data.length === 0) return null;

          const mine = data.find((t) => t.user_id === userId);
          const chosen = mine ?? data[0];

          let userName = 'Colaborador';
          if (chosen.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', chosen.user_id)
              .maybeSingle();
            if (profile?.full_name) userName = profile.full_name;
          }

          return {
            id: chosen.id,
            userId: chosen.user_id,
            userName,
            cardId: chosen.card_id,
            cardTitle: (chosen.cards as any)?.title ?? null,
            startedAt: chosen.started_at,
            isCurrentUser: chosen.user_id === userId,
          };
        },
      },
      {
        // 3 — tempo registrado hoje pelo usuário
        queryKey: ['home', 'tracked-time', workspaceId, userId, dayKey],
        enabled,
        staleTime: 45_000,
        queryFn: async (): Promise<number> => {
          const { data, error } = await supabase
            .from('time_entries')
            .select('duration_seconds')
            .eq('workspace_id', workspaceId!)
            .eq('user_id', userId!)
            .eq('is_running', false)
            .gte('started_at', dayStart)
            .lte('started_at', dayEnd);

          if (error) throw error;
          return (data ?? []).reduce((sum, t) => sum + (t.duration_seconds || 0), 0);
        },
      },
      {
        // 4 — falhas de publicação hoje
        queryKey: ['home', 'publishing-failures', workspaceId, dayKey],
        enabled,
        staleTime: 60_000,
        queryFn: async (): Promise<number> => {
          const { count, error } = await supabase
            .from('social_posts')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId!)
            .in('status', ['failed', 'error'])
            .gte('updated_at', dayStart)
            .lte('updated_at', dayEnd);

          if (error) throw error;
          return count ?? 0;
        },
      },
      {
        // 5 — aprovações comerciais pendentes (única fonte real de aprovação
        // no sistema hoje; não existe workflow genérico de aprovação).
        //
        // altcontrol_approval_requests NÃO tem workspace_id: o vínculo com o
        // tenant é indireto, via proposal_id. O !inner é obrigatório aqui —
        // sem ele o filtro de workspace não restringe nada e vazaria
        // aprovações de outros workspaces.
        queryKey: ['home', 'approvals', workspaceId],
        enabled,
        staleTime: 45_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('altcontrol_approval_requests')
            .select('id, created_at, status, altcontrol_proposals!inner(workspace_id)')
            .eq('altcontrol_proposals.workspace_id', workspaceId!)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(50);

          if (error) throw error;
          const rows = data ?? [];
          return {
            total: rows.length,
            oldestPendingAt: rows[0]?.created_at ?? null,
          };
        },
      },
      {
        // 6 — entregas programadas para hoje (workspace todo)
        queryKey: ['home', 'deliveries-today', workspaceId, dayKey],
        enabled,
        staleTime: 60_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('cards')
            .select('id, status, completed_at')
            .eq('workspace_id', workspaceId!)
            .gte('due_date', dayStart)
            .lte('due_date', dayEnd)
            .neq('status', 'archived');

          if (error) throw error;
          const rows = data ?? [];
          return {
            scheduled: rows.length,
            delivered: rows.filter((c) => c.status === 'delivered' || !!c.completed_at).length,
          };
        },
      },
    ],
  });

  const [
    tasksQuery,
    agendaQuery,
    timerQuery,
    trackedTimeQuery,
    failuresQuery,
    approvalsQuery,
    deliveriesQuery,
  ] = results;

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const agenda = useMemo(() => agendaQuery.data ?? [], [agendaQuery.data]);

  const metrics: HomeMetrics = useMemo(() => {
    const now = new Date();
    const open = tasks.filter((t) => !isTaskClosed(t));

    return {
      overdueTasks: open.filter((t) => isTaskOverdue(t, now)).length,
      urgentTasks: open.filter(
        (t) =>
          isTaskOverdue(t, now) ||
          ((t.urgency === 'critical' || t.urgency === 'high') && isDueToday(t, now)),
      ).length,
      deliveriesNext4h: open.filter((t) => isDueWithinHours(t, 4, now)).length,
      pendingTasks: open.length,
      dueTodayTasks: open.filter((t) => isDueToday(t, now)).length,
      deliveredToday: deliveriesQuery.data?.delivered ?? 0,
      scheduledToday: deliveriesQuery.data?.scheduled ?? 0,
      trackedSecondsToday: trackedTimeQuery.data ?? 0,
      publishingFailuresToday: failuresQuery.data ?? 0,
      approvals: approvalsQuery.data ?? { total: 0, oldestPendingAt: null },
      nextEventMinutes: minutesUntilNextEvent(agenda, now),
    };
  }, [
    tasks,
    agenda,
    deliveriesQuery.data,
    trackedTimeQuery.data,
    failuresQuery.data,
    approvalsQuery.data,
  ]);

  const insights = useMemo(() => generateDailyInsights(metrics), [metrics]);
  const priorityTasks = useMemo(() => sortTasksByPriority(tasks).slice(0, 3), [tasks]);

  return {
    metrics,
    insights,
    agenda,
    priorityTasks,
    activeTimer: timerQuery.data ?? null,
    isLoading: {
      tasks: tasksQuery.isLoading,
      agenda: agendaQuery.isLoading,
      timer: timerQuery.isLoading,
      metrics:
        trackedTimeQuery.isLoading || failuresQuery.isLoading || deliveriesQuery.isLoading,
    },
    errors: {
      tasks: tasksQuery.error,
      agenda: agendaQuery.error,
    },
    refetchAll: () => results.forEach((r) => r.refetch()),
  };
}
