import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface AnalyticsData {
  date: string;
  cards_created: number;
  cards_completed: number;
  hours_logged: number;
  comments: number;
  badges_earned: number;
  active_users: number;
}

export interface TeamMemberStats {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  cards_created: number;
  cards_completed: number;
  hours_logged: number;
  comments: number;
  completion_rate: number;
}

export function useAnalytics(dateRange: { start: Date; end: Date }) {
  const { currentWorkspace } = useWorkspace();

  const { data: dailyMetrics, isLoading: isLoadingDaily } = useQuery({
    queryKey: ['analytics-daily', currentWorkspace?.id, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Fetch all data in parallel
      const [cardsCreatedRes, cardsCompletedRes, timeEntriesRes, workspaceCardsRes, commentsRes] = await Promise.all([
        supabase
          .from('cards')
          .select('created_at')
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', startStr)
          .lte('created_at', endStr),
        supabase
          .from('cards')
          .select('completed_at')
          .eq('workspace_id', currentWorkspace.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', startStr)
          .lte('completed_at', endStr),
        supabase
          .from('time_entries')
          .select('started_at, duration_seconds')
          .eq('workspace_id', currentWorkspace.id)
          .gte('started_at', startStr)
          .lte('started_at', endStr),
        supabase
          .from('cards')
          .select('id')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('comments')
          .select('created_at, card_id')
          .gte('created_at', startStr)
          .lte('created_at', endStr),
      ]);

      const cardsCreated = cardsCreatedRes.data || [];
      const cardsCompleted = cardsCompletedRes.data || [];
      const timeEntries = timeEntriesRes.data || [];
      const cardIds = new Set((workspaceCardsRes.data || []).map(c => c.id));
      const workspaceComments = (commentsRes.data || []).filter(c => cardIds.has(c.card_id));

      // Build daily metrics
      const dailyData: Record<string, AnalyticsData> = {};
      
      // Initialize days
      const currentDate = new Date(dateRange.start);
      while (currentDate <= dateRange.end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        dailyData[dateKey] = {
          date: dateKey,
          cards_created: 0,
          cards_completed: 0,
          hours_logged: 0,
          comments: 0,
          badges_earned: 0,
          active_users: 0,
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Aggregate cards created
      cardsCreated.forEach(card => {
        const dateKey = card.created_at.split('T')[0];
        if (dailyData[dateKey]) {
          dailyData[dateKey].cards_created++;
        }
      });

      // Aggregate cards completed
      cardsCompleted.forEach(card => {
        if (card.completed_at) {
          const dateKey = card.completed_at.split('T')[0];
          if (dailyData[dateKey]) {
            dailyData[dateKey].cards_completed++;
          }
        }
      });

      // Aggregate time entries
      timeEntries.forEach(entry => {
        const dateKey = entry.started_at.split('T')[0];
        if (dailyData[dateKey]) {
          dailyData[dateKey].hours_logged += entry.duration_seconds / 3600;
        }
      });

      // Aggregate comments
      workspaceComments.forEach(comment => {
        const dateKey = comment.created_at.split('T')[0];
        if (dailyData[dateKey]) {
          dailyData[dateKey].comments++;
        }
      });

      return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  const { data: teamStats, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['analytics-team', currentWorkspace?.id, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Fetch all data in parallel (avoid N+1 queries!)
      // NOTE: keep card queries bounded by the selected range to prevent huge payloads.
      const [membersRes, cardsCreatedRes, cardsCompletedRes, timeEntriesRes, commentsRes] = await Promise.all([
        supabase
          .from('workspace_members')
          .select(`
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          `)
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_active', true),
        supabase
          .from('cards')
          .select('id, created_by, owner_id, created_at')
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', startStr)
          .lte('created_at', endStr),
        supabase
          .from('cards')
          .select('id, owner_id, completed_at')
          .eq('workspace_id', currentWorkspace.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', startStr)
          .lte('completed_at', endStr),
        supabase
          .from('time_entries')
          .select('user_id, duration_seconds')
          .eq('workspace_id', currentWorkspace.id)
          .gte('started_at', startStr)
          .lte('started_at', endStr),
        supabase
          .from('comments')
          .select('user_id, card_id')
          .gte('created_at', startStr)
          .lte('created_at', endStr),
      ]);

      const members = membersRes.data || [];
      const cardsCreatedInRange = cardsCreatedRes.data || [];
      const cardsCompletedInRange = cardsCompletedRes.data || [];
      const timeEntries = timeEntriesRes.data || [];
      const comments = commentsRes.data || [];

      // Filter comments to cards that appear in the selected period.
      // (This avoids needing an extra "all cards in workspace" query.)
      const cardIds = new Set<string>([
        ...cardsCreatedInRange.map(c => c.id),
        ...cardsCompletedInRange.map(c => c.id),
      ]);
      const workspaceComments = comments.filter(c => cardIds.has(c.card_id));

      // Aggregate stats per member
      const stats: TeamMemberStats[] = members.map(member => {
        const profile = member.profiles as any;

        const cardsCreated = cardsCreatedInRange.filter(c => c.created_by === member.user_id).length;
        const cardsCompleted = cardsCompletedInRange.filter(c => c.owner_id === member.user_id).length;
        const totalAssigned = cardsCreatedInRange.filter(c => c.owner_id === member.user_id).length;

        const hoursLogged = timeEntries
          .filter(e => e.user_id === member.user_id)
          .reduce((sum, e) => sum + e.duration_seconds / 3600, 0);

        const commentsCount = workspaceComments.filter(c => c.user_id === member.user_id).length;

        return {
          user_id: member.user_id,
          full_name: profile?.full_name || 'Usuário',
          avatar_url: profile?.avatar_url,
          cards_created: cardsCreated,
          cards_completed: cardsCompleted,
          hours_logged: Math.round(hoursLogged * 10) / 10,
          comments: commentsCount,
          completion_rate: totalAssigned
            ? Math.round((cardsCompleted / totalAssigned) * 100)
            : 0,
        };
      });


      return stats.sort((a, b) => b.cards_completed - a.cards_completed);
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60 * 1000,
  });

  const { data: summaryStats, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['analytics-summary', currentWorkspace?.id, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Fetch all summary data in parallel
      const [cardsCreatedRes, cardsCompletedRes, timeEntriesRes, badgesRes] = await Promise.all([
        supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('created_at', startStr)
          .lte('created_at', endStr),
        supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', startStr)
          .lte('completed_at', endStr),
        supabase
          .from('time_entries')
          .select('user_id, duration_seconds')
          .eq('workspace_id', currentWorkspace.id)
          .gte('started_at', startStr)
          .lte('started_at', endStr),
        supabase
          .from('user_badges')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('earned_at', startStr)
          .lte('earned_at', endStr),
      ]);

      const totalCardsCreated = cardsCreatedRes.count || 0;
      const totalCardsCompleted = cardsCompletedRes.count || 0;
      const timeEntries = timeEntriesRes.data || [];
      const badgesEarned = badgesRes.count || 0;

      const totalHours = timeEntries.reduce((sum, e) => sum + e.duration_seconds / 3600, 0);
      const uniqueActiveUsers = new Set(timeEntries.map(u => u.user_id));

      return {
        totalCardsCreated,
        totalCardsCompleted,
        totalHours: Math.round(totalHours * 10) / 10,
        activeUsers: uniqueActiveUsers.size,
        badgesEarned,
        completionRate: totalCardsCreated 
          ? Math.round((totalCardsCompleted / totalCardsCreated) * 100) 
          : 0,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60 * 1000,
  });

  return {
    dailyMetrics: dailyMetrics || [],
    teamStats: teamStats || [],
    summaryStats,
    isLoading: isLoadingDaily || isLoadingTeam || isLoadingSummary,
  };
}
