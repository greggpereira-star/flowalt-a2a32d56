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
    queryKey: ['analytics-daily', currentWorkspace?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Get cards created per day
      const { data: cardsCreated } = await supabase
        .from('cards')
        .select('created_at')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      // Get cards completed per day
      const { data: cardsCompleted } = await supabase
        .from('cards')
        .select('completed_at')
        .eq('workspace_id', currentWorkspace.id)
        .not('completed_at', 'is', null)
        .gte('completed_at', startStr)
        .lte('completed_at', endStr);

      // Get time entries per day
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('started_at, duration_seconds')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', startStr)
        .lte('started_at', endStr);

      // Get comments per day
      const { data: comments } = await supabase
        .from('comments')
        .select('created_at, card_id')
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      // Filter comments by workspace
      const { data: workspaceCards } = await supabase
        .from('cards')
        .select('id')
        .eq('workspace_id', currentWorkspace.id);

      const cardIds = new Set(workspaceCards?.map(c => c.id) || []);
      const workspaceComments = comments?.filter(c => cardIds.has(c.card_id)) || [];

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
      cardsCreated?.forEach(card => {
        const dateKey = card.created_at.split('T')[0];
        if (dailyData[dateKey]) {
          dailyData[dateKey].cards_created++;
        }
      });

      // Aggregate cards completed
      cardsCompleted?.forEach(card => {
        if (card.completed_at) {
          const dateKey = card.completed_at.split('T')[0];
          if (dailyData[dateKey]) {
            dailyData[dateKey].cards_completed++;
          }
        }
      });

      // Aggregate time entries
      timeEntries?.forEach(entry => {
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
  });

  const { data: teamStats, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['analytics-team', currentWorkspace?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Get workspace members
      const { data: members } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (!members) return [];

      const stats: TeamMemberStats[] = [];

      for (const member of members) {
        const profile = member.profiles as any;

        // Cards created by user
        const { count: cardsCreated } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('created_by', member.user_id)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        // Cards completed (where user is owner)
        const { count: cardsCompleted } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('owner_id', member.user_id)
          .not('completed_at', 'is', null)
          .gte('completed_at', startStr)
          .lte('completed_at', endStr);

        // Total cards assigned
        const { count: totalAssigned } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('owner_id', member.user_id)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        // Time entries
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('duration_seconds')
          .eq('workspace_id', currentWorkspace.id)
          .eq('user_id', member.user_id)
          .gte('started_at', startStr)
          .lte('started_at', endStr);

        const hoursLogged = (timeEntries || []).reduce(
          (sum, e) => sum + e.duration_seconds / 3600,
          0
        );

        // Get workspace cards for comment filtering
        const { data: workspaceCards } = await supabase
          .from('cards')
          .select('id')
          .eq('workspace_id', currentWorkspace.id);

        const cardIds = workspaceCards?.map(c => c.id) || [];

        // Comments
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', member.user_id)
          .in('card_id', cardIds)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        stats.push({
          user_id: member.user_id,
          full_name: profile?.full_name || 'Usuário',
          avatar_url: profile?.avatar_url,
          cards_created: cardsCreated || 0,
          cards_completed: cardsCompleted || 0,
          hours_logged: Math.round(hoursLogged * 10) / 10,
          comments: commentsCount || 0,
          completion_rate: totalAssigned 
            ? Math.round(((cardsCompleted || 0) / totalAssigned) * 100) 
            : 0,
        });
      }

      return stats.sort((a, b) => b.cards_completed - a.cards_completed);
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: summaryStats, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['analytics-summary', currentWorkspace?.id, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Total cards created
      const { count: totalCardsCreated } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      // Total cards completed
      const { count: totalCardsCompleted } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .not('completed_at', 'is', null)
        .gte('completed_at', startStr)
        .lte('completed_at', endStr);

      // Total hours logged
      const { data: allTimeEntries } = await supabase
        .from('time_entries')
        .select('duration_seconds')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', startStr)
        .lte('started_at', endStr);

      const totalHours = (allTimeEntries || []).reduce(
        (sum, e) => sum + e.duration_seconds / 3600,
        0
      );

      // Active users (who did something in the period)
      const { data: activeUsers } = await supabase
        .from('time_entries')
        .select('user_id')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', startStr)
        .lte('started_at', endStr);

      const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id) || []);

      // Badges earned
      const { count: badgesEarned } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('earned_at', startStr)
        .lte('earned_at', endStr);

      return {
        totalCardsCreated: totalCardsCreated || 0,
        totalCardsCompleted: totalCardsCompleted || 0,
        totalHours: Math.round(totalHours * 10) / 10,
        activeUsers: uniqueActiveUsers.size,
        badgesEarned: badgesEarned || 0,
        completionRate: totalCardsCreated 
          ? Math.round(((totalCardsCompleted || 0) / totalCardsCreated) * 100) 
          : 0,
      };
    },
    enabled: !!currentWorkspace?.id,
  });

  return {
    dailyMetrics: dailyMetrics || [],
    teamStats: teamStats || [],
    summaryStats,
    isLoading: isLoadingDaily || isLoadingTeam || isLoadingSummary,
  };
}
