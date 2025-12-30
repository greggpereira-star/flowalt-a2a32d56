import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface WeeklyGoal {
  id: string;
  workspace_id: string;
  week_start: string;
  goal_type: 'cards_created' | 'cards_completed' | 'hours_logged' | 'comments_made';
  target_value: number;
  reward_badge: string | null;
  reward_points: number;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserGoalProgress {
  id: string;
  goal_id: string;
  user_id: string;
  current_value: number;
  completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalWithProgress extends WeeklyGoal {
  progress?: UserGoalProgress;
}

export function useWeeklyGoals() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['weekly-goals', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get current week's start date (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('weekly_goals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('week_start', weekStartStr)
        .eq('is_active', true);

      if (error) throw error;
      return data as WeeklyGoal[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: userProgress = [] } = useQuery({
    queryKey: ['user-goal-progress', user?.id, goals.map(g => g.id).join(',')],
    queryFn: async () => {
      if (!user?.id || goals.length === 0) return [];

      const { data, error } = await supabase
        .from('user_goal_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('goal_id', goals.map(g => g.id));

      if (error) throw error;
      return data as UserGoalProgress[];
    },
    enabled: !!user?.id && goals.length > 0,
  });

  const goalsWithProgress: GoalWithProgress[] = goals.map(goal => ({
    ...goal,
    progress: userProgress.find(p => p.goal_id === goal.id),
  }));

  const createGoal = useMutation({
    mutationFn: async (goal: Omit<WeeklyGoal, 'id' | 'created_at' | 'workspace_id' | 'week_start'>) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('weekly_goals')
        .insert({
          ...goal,
          workspace_id: currentWorkspace.id,
          week_start: weekStartStr,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-goals'] });
    },
  });

  const getGoalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cards_created: 'Cards criados',
      cards_completed: 'Cards entregues',
      hours_logged: 'Horas registradas',
      comments_made: 'Comentários feitos',
    };
    return labels[type] || type;
  };

  const getGoalTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      cards_created: '📝',
      cards_completed: '✅',
      hours_logged: '⏱️',
      comments_made: '💬',
    };
    return icons[type] || '🎯';
  };

  return {
    goals: goalsWithProgress,
    isLoading,
    createGoal,
    getGoalTypeLabel,
    getGoalTypeIcon,
  };
}
