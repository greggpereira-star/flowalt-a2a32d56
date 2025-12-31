import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export function useUserPreference<T>(preferenceKey: string, defaultValue: T) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-preferences', user?.id, currentWorkspace?.id, preferenceKey],
    queryFn: async () => {
      if (!user?.id || !currentWorkspace?.id) return defaultValue;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id)
        .eq('preference_key', preferenceKey)
        .maybeSingle();

      if (error) throw error;
      return (data?.preference_value as T) ?? defaultValue;
    },
    enabled: !!user?.id && !!currentWorkspace?.id,
  });

  const mutation = useMutation({
    mutationFn: async (value: T) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('No user or workspace');

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          [{
            user_id: user.id,
            workspace_id: currentWorkspace.id,
            preference_key: preferenceKey,
            preference_value: JSON.parse(JSON.stringify(value)) as Json,
            updated_at: new Date().toISOString(),
          }],
          { onConflict: 'user_id,workspace_id,preference_key' }
        );

      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      queryClient.setQueryData(
        ['user-preferences', user?.id, currentWorkspace?.id, preferenceKey],
        value
      );
    },
  });

  return {
    value: query.data ?? defaultValue,
    isLoading: query.isLoading,
    setValue: mutation.mutate,
    setValueAsync: mutation.mutateAsync,
  };
}

export function useExpandedFolders(spaceId: string | undefined) {
  const key = spaceId ? `expanded_folders_${spaceId}` : 'expanded_folders';
  return useUserPreference<string[]>(key, []);
}
