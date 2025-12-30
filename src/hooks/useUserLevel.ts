import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface UserLevel {
  id: string;
  user_id: string;
  workspace_id: string;
  total_score: number;
  current_level: number;
  level_name: string;
  next_level_score: number;
  created_at: string;
  updated_at: string;
}

export interface LevelConfig {
  level: number;
  name: string;
  minScore: number;
  maxScore: number;
  color: string;
  icon: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, name: 'Iniciante', minScore: 0, maxScore: 99, color: 'text-gray-500', icon: '🌱' },
  { level: 2, name: 'Aprendiz', minScore: 100, maxScore: 299, color: 'text-green-500', icon: '📚' },
  { level: 3, name: 'Colaborador', minScore: 300, maxScore: 599, color: 'text-blue-500', icon: '🤝' },
  { level: 4, name: 'Profissional', minScore: 600, maxScore: 999, color: 'text-indigo-500', icon: '💼' },
  { level: 5, name: 'Especialista', minScore: 1000, maxScore: 1499, color: 'text-purple-500', icon: '🎯' },
  { level: 6, name: 'Expert', minScore: 1500, maxScore: 2499, color: 'text-orange-500', icon: '🔥' },
  { level: 7, name: 'Mestre', minScore: 2500, maxScore: 3999, color: 'text-red-500', icon: '⚔️' },
  { level: 8, name: 'Grão-Mestre', minScore: 4000, maxScore: 5999, color: 'text-pink-500', icon: '👑' },
  { level: 9, name: 'Lenda', minScore: 6000, maxScore: 9999, color: 'text-yellow-500', icon: '🌟' },
  { level: 10, name: 'Imortal', minScore: 10000, maxScore: 99999, color: 'text-amber-500', icon: '🏆' },
];

export function useUserLevel() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: userLevel, isLoading } = useQuery({
    queryKey: ['user-level', user?.id, currentWorkspace?.id],
    queryFn: async () => {
      if (!user?.id || !currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (error) throw error;

      // Create initial record if not exists
      if (!data) {
        const { data: newLevel, error: insertError } = await supabase
          .from('user_levels')
          .insert({
            user_id: user.id,
            workspace_id: currentWorkspace.id,
            total_score: 0
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newLevel as UserLevel;
      }

      return data as UserLevel;
    },
    enabled: !!user?.id && !!currentWorkspace?.id,
  });

  const { data: workspaceLevels } = useQuery({
    queryKey: ['workspace-levels', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('user_levels')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('total_score', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const getLevelConfig = (level: number): LevelConfig => {
    return LEVEL_CONFIGS.find(c => c.level === level) || LEVEL_CONFIGS[0];
  };

  const getProgressToNextLevel = (userLevel: UserLevel | null): number => {
    if (!userLevel) return 0;
    const config = getLevelConfig(userLevel.current_level);
    const prevMax = config.minScore;
    const range = userLevel.next_level_score - prevMax;
    const progress = userLevel.total_score - prevMax;
    return Math.min(100, Math.max(0, (progress / range) * 100));
  };

  return {
    userLevel,
    workspaceLevels,
    isLoading,
    getLevelConfig,
    getProgressToNextLevel,
    LEVEL_CONFIGS,
  };
}
