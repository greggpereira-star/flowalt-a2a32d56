import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if the current user is a platform super admin
 */
export function usePlatformAdmin() {
  const { user } = useAuth();

  const { data: isSuperAdmin, isLoading } = useQuery({
    queryKey: ['is-platform-super-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase
        .from('platform_super_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    isSuperAdmin: isSuperAdmin || false,
    isLoading,
  };
}

/**
 * Hook to check if user has an active support session for a workspace
 */
export function useActiveSupportSession(workspaceId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['active-support-session', user?.id, workspaceId],
    queryFn: async () => {
      if (!user?.id || !workspaceId) return null;

      const { data, error } = await supabase
        .from('support_sessions')
        .select('*')
        .eq('super_admin_user_id', user.id)
        .eq('workspace_id', workspaceId)
        .is('ended_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: !!user?.id && !!workspaceId,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds to check expiry
  });
}
