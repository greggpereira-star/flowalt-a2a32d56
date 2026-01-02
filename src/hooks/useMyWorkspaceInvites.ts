import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PendingWorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
  workspace_name: string;
  inviter_name: string | null;
}

/**
 * Hook to fetch pending workspace invites for the current user's email
 */
export function useMyWorkspaceInvites() {
  const { user } = useAuth();
  const userEmail = user?.email;

  return useQuery({
    queryKey: ['my-workspace-invites', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];

      // Fetch pending invites for this email that haven't expired
      const { data, error } = await supabase
        .from('workspace_invites')
        .select(`
          id,
          workspace_id,
          email,
          role,
          token,
          expires_at,
          created_at,
          workspaces:workspace_id (name)
        `)
        .eq('email', userEmail)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invites:', error);
        return [];
      }

      // Transform the data to a cleaner format
      return (data || []).map((invite: any) => ({
        id: invite.id,
        workspace_id: invite.workspace_id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
        workspace_name: invite.workspaces?.name || 'Workspace',
        inviter_name: null,
      })) as PendingWorkspaceInvite[];
    },
    enabled: !!userEmail,
    staleTime: 30000, // 30 seconds
  });
}
