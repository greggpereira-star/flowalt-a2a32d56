import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface RankingSnapshot {
  id: string;
  workspace_id: string;
  user_id: string;
  score: number;
  rank: number;
  cards_created: number;
  cards_completed: number;
  hours_logged: number;
  badges_count: number;
  recorded_at: string;
  created_at: string;
}

export function useRankingHistory(userId?: string) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const targetUserId = userId || user?.id;

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['ranking-history', currentWorkspace?.id, targetUserId],
    queryFn: async () => {
      if (!currentWorkspace?.id || !targetUserId) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('ranking_history')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', targetUserId)
        .gte('recorded_at', thirtyDaysAgo.toISOString().split('T')[0])
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      return data as RankingSnapshot[];
    },
    enabled: !!currentWorkspace?.id && !!targetUserId,
  });

  const { data: allUsersHistory = [] } = useQuery({
    queryKey: ['ranking-history-all', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('ranking_history')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('recorded_at', thirtyDaysAgo.toISOString().split('T')[0])
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      return data as RankingSnapshot[];
    },
    enabled: !!currentWorkspace?.id,
  });

  return {
    history,
    allUsersHistory,
    isLoading,
  };
}
