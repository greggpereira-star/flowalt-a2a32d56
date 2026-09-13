import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInCalendarDays, startOfDay, endOfDay } from 'date-fns';
import type {
  DashboardDelta, DashboardPeriod, DashboardSummary, OverdueCard, DashboardDelivery,
} from '@/lib/dashboard/dashboard-types';
import { calcularScoreAtraso } from '@/lib/dashboard/dashboard-priority';
import type { CardStatus } from '@/lib/supabase';
import type { SpaceBottleneck } from '@/lib/dashboard/dashboard-types';

/** Status que não representam trabalho em aberto. */
const STATUS_FECHADOS: CardStatus[] = ['delivered', 'archived'];

/**
 * Dados do Dashboard.
 *
 * Não usa `compute_dashboard_snapshot`: aquele RPC define atraso como
 * `due_date < CURRENT_DATE`, comparando timestamp com data. Um card que vence
 * hoje às 16:00 continuaria "no prazo" às 16:01, e cards arquivados entram na
 * contagem porque o filtro é apenas `status != 'delivered'`. Aqui o atraso usa
 * o instante real e exclui entregues e arquivados.
 *
 * As consultas rodam em paralelo via useQueries — em cascata, cada uma
 * esperaria a anterior e o painel levaria segundos para aparecer.
 */
export function useDashboardData(period: DashboardPeriod, agora: Date, spaceId?: string) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const workspaceId = currentWorkspace?.id ?? null;
  const pronto = !!workspaceId;

  const agoraIso = agora.toISOString();
  const inicioHoje = startOfDay(agora).toISOString();
  const fimHoje = endOfDay(agora).toISOString();

  const base = () => {
    let q = supabase.from('cards').select('id, title, status, urgency, due_date, completed_at, space_id, created_at')
      .eq('workspace_id', workspaceId as string);
    if (spaceId) q = q.eq('space_id', spaceId);
    return q;
  };

  const resultados = useQueries({
    queries: [
      // 0 — Cards do período (volume, entregues, em produção).
      {
        queryKey: ['dashboard', workspaceId, 'cards', period.id, period.start, spaceId ?? 'all'],
        enabled: pronto,
        staleTime: 45_000,
        queryFn: async () => {
          const { data, error } = await base()
            .neq('status', 'archived')
            .gte('created_at', period.start)
            .lte('created_at', period.end);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 1 — Mesma janela no período anterior, só para o delta.
      {
        queryKey: ['dashboard', workspaceId, 'cards-anterior', period.id, period.previousStart, spaceId ?? 'all'],
        enabled: pronto,
        staleTime: 5 * 60_000,
        queryFn: async () => {
          const { data, error } = await base()
            .neq('status', 'archived')
            .gte('created_at', period.previousStart)
            .lte('created_at', period.previousEnd);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 2 — Pendências: independem do período, sempre contra `agora`.
      {
        queryKey: ['dashboard', workspaceId, 'pendencias', spaceId ?? 'all'],
        enabled: pronto,
        staleTime: 30_000,
        queryFn: async () => {
          const { data, error } = await base()
            .not('status', 'in', `(${STATUS_FECHADOS.join(',')})`)
            .not('due_date', 'is', null)
            .order('due_date', { ascending: true })
            .limit(200);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 3 — Horas: timers fechados do período + timer em andamento.
      {
        queryKey: ['dashboard', workspaceId, 'horas', period.start, period.end],
        enabled: pronto,
        staleTime: 45_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('time_entries')
            .select('duration_seconds, started_at, ended_at, is_running')
            .eq('workspace_id', workspaceId as string)
            .gte('started_at', period.start)
            .lte('started_at', period.end);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 5 — Aprovações aguardando ESTA pessoa.
      //
      // A tabela não tem workspace_id: o vínculo é pela proposta, então o
      // !inner garante que a linha só entra se a proposta for deste
      // workspace. Sem isso, uma aprovação de outro tenant apareceria aqui.
      {
        queryKey: ['dashboard', workspaceId, 'aprovacoes', user?.id ?? 'anon'],
        enabled: pronto && !!user?.id,
        staleTime: 60_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('altcontrol_approval_requests')
            .select('id, created_at, altcontrol_proposals!inner(workspace_id)')
            .eq('status', 'pending')
            .eq('approver_id', user!.id)
            .eq('altcontrol_proposals.workspace_id', workspaceId as string);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 6 — Todos os cards abertos, com espaço.
      //
      // A consulta de pendências só traz cards COM prazo; para a taxa de
      // atraso é preciso o denominador completo — um espaço pode ter muitos
      // cards abertos sem data, e ignorá-los inflaria a taxa.
      {
        queryKey: ['dashboard', workspaceId, 'abertos-por-espaco', spaceId ?? 'all'],
        enabled: pronto,
        staleTime: 60_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('cards')
            .select('id, space_id, due_date, status')
            .eq('workspace_id', workspaceId as string)
            .not('status', 'in', `(${STATUS_FECHADOS.join(',')})`);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 7 — Nomes dos espaços.
      {
        queryKey: ['dashboard', workspaceId, 'espacos'],
        enabled: pronto,
        staleTime: 10 * 60_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('spaces').select('id, name').eq('workspace_id', workspaceId as string);
          if (error) throw error;
          return data ?? [];
        },
      },

      // 8 — Retrato atual do workspace (sem recorte de período).
      {
        queryKey: ['dashboard', workspaceId, 'todos-cards', spaceId ?? 'all'],
        enabled: pronto,
        staleTime: 60_000,
        queryFn: async () => {
          const { data, error } = await base().neq('status', 'archived');
          if (error) throw error;
          return data ?? [];
        },
      },

      // 4 — Agenda de hoje.
      {
        queryKey: ['dashboard', workspaceId, 'agenda', inicioHoje],
        enabled: pronto,
        staleTime: 60_000,
        queryFn: async () => {
          const { data, error } = await supabase
            .from('events')
            .select('id, title, start_time, end_time, space_id, all_day')
            .eq('workspace_id', workspaceId as string)
            .gte('start_time', inicioHoje)
            .lte('start_time', fimHoje)
            .order('start_time', { ascending: true });
          if (error) throw error;
          return data ?? [];
        },
      },
    ],
  });

  const [cardsPeriodo, cardsAnterior, pendencias, horas, aprovacoes, abertosPorEspaco, espacos, todosCards, agenda] = resultados;

  const isLoading = resultados.some(r => r.isLoading);
  const error = resultados.find(r => r.error)?.error ?? null;

  const lista = cardsPeriodo.data ?? [];
  const listaAnterior = cardsAnterior.data ?? [];
  const abertos = pendencias.data ?? [];

  // Atrasado = tem prazo, o prazo já passou e o card não foi fechado.
  // A comparação é por instante, não por dia: 16:00 vira atraso às 16:01.
  const atrasados = abertos.filter(c => c.due_date && c.due_date < agoraIso);

  const overdueCards: OverdueCard[] = atrasados
    .map(c => {
      const dias = Math.max(0, differenceInCalendarDays(agora, new Date(c.due_date as string)));
      return {
        cardId: c.id,
        title: c.title,
        dueDate: c.due_date as string,
        overdueDays: dias,
        status: c.status as CardStatus,
        urgency: (c.urgency as string) ?? null,
        score: calcularScoreAtraso({ overdueDays: dias, urgency: c.urgency as string }),
      };
    })
    .sort((a, b) => b.score - a.score);

  const upcomingDeliveries: DashboardDelivery[] = abertos
    .filter(c => c.due_date && c.due_date >= agoraIso)
    .slice(0, 3)
    .map(c => {
      const dias = differenceInCalendarDays(new Date(c.due_date as string), agora);
      return {
        cardId: c.id,
        title: c.title,
        dueDate: c.due_date as string,
        relativeLabel: dias <= 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`,
      };
    });

  // Timer em andamento conta até agora; sem isso, quem está com o cronômetro
  // ligado veria as horas do dia paradas no último registro fechado.
  const segundos = (horas.data ?? []).reduce((total, e) => {
    if (e.is_running && e.started_at) {
      return total + Math.max(0, (agora.getTime() - new Date(e.started_at).getTime()) / 1000);
    }
    return total + (e.duration_seconds ?? 0);
  }, 0);

  // `lista` é o volume criado no período (serve ao delta de crescimento).
  // `todos` é o retrato atual do workspace, que é o que os KPIs mostram.
  const todos = todosCards.data ?? [];

  const summary: DashboardSummary = {
    totalCards: todos.length,
    completedCards: todos.filter(c => c.status === 'delivered').length,
    productionCards: todos.filter(c => c.status === 'in_progress').length,
    overdueCards: overdueCards.length,
    trackedMinutes: Math.round(segundos / 60),
    targetMinutes: null,
    todayAgendaCount: (agenda.data ?? []).length,
    deltas: {
      totalCards: calcularDelta(lista.length, listaAnterior.length, true),
      productionCards: calcularDelta(
        lista.filter(c => c.status === 'in_progress').length,
        listaAnterior.filter(c => c.status === 'in_progress').length,
        true,
      ),
    },
  };

  // Gargalo por espaço: absoluto para a barra, taxa para o julgamento.
  const nomeEspaco = new Map((espacos.data ?? []).map(e => [e.id, e.name]));
  const porEspaco = new Map<string, { abertos: number; atrasados: number }>();

  (abertosPorEspaco.data ?? []).forEach(c => {
    if (!c.space_id) return;
    const atual = porEspaco.get(c.space_id) ?? { abertos: 0, atrasados: 0 };
    atual.abertos += 1;
    if (c.due_date && c.due_date < agoraIso) atual.atrasados += 1;
    porEspaco.set(c.space_id, atual);
  });

  const bottlenecks: SpaceBottleneck[] = [...porEspaco.entries()]
    .map(([spaceId, v]) => ({
      spaceId,
      spaceName: nomeEspaco.get(spaceId) ?? 'Espaço sem nome',
      openCards: v.abertos,
      overdueCards: v.atrasados,
      overdueRate: v.abertos > 0 ? v.atrasados / v.abertos : 0,
      waitingApproval: 0,
    }))
    .filter(e => e.openCards > 0);

  // Distribuição por status: sobre o retrato atual, não sobre o período —
  // é a foto de onde o trabalho está parado agora.
  const contagemStatus = new Map<string, number>();
  todos.forEach(c => contagemStatus.set(c.status, (contagemStatus.get(c.status) ?? 0) + 1));

  const statusDistribution = [...contagemStatus.entries()]
    .map(([status, count]) => ({
      status: status as CardStatus,
      count,
      percent: todos.length > 0 ? (count / todos.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Horas por dia da semana. O timer em andamento entra no dia em que começou.
  const porDia = new Map<string, number>();
  (horas.data ?? []).forEach(e => {
    if (!e.started_at) return;
    const dia = e.started_at.slice(0, 10);
    const seg = e.is_running
      ? Math.max(0, (agora.getTime() - new Date(e.started_at).getTime()) / 1000)
      : (e.duration_seconds ?? 0);
    porDia.set(dia, (porDia.get(dia) ?? 0) + seg);
  });

  const hoursByDay = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, seg]) => ({ dia, horas: Number((seg / 3600).toFixed(2)) }));

  return {
    statusDistribution,
    hoursByDay,
    bottlenecks,
    isLoading,
    error,
    summary,
    overdueCards,
    upcomingDeliveries,
    agenda: agenda.data ?? [],
    pendingApprovals: (aprovacoes.data ?? []).length,
    approvalOldestHours: (aprovacoes.data ?? []).reduce((maior, a) => {
      const h = (agora.getTime() - new Date(a.created_at as string).getTime()) / 36e5;
      return Math.max(maior, h);
    }, 0),
    dueTodayCount: abertos.filter(
      c => c.due_date && c.due_date >= agoraIso && c.due_date <= fimHoje,
    ).length,
  };
}

/**
 * Variação entre períodos.
 *
 * Período anterior zerado devolve `percent: null` em vez de 0 ou Infinity:
 * "de 0 para 5" não é uma variação percentual, e a tela mostra só o absoluto.
 */
function calcularDelta(atual: number, anterior: number, higherIsBetter: boolean): DashboardDelta {
  return {
    absolute: atual - anterior,
    percent: anterior === 0 ? null : ((atual - anterior) / anterior) * 100,
    higherIsBetter,
  };
}
