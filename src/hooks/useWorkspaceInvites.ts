import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { AppRole } from '@/lib/supabase';
import { sendWorkspaceInviteEmail, fetchUserProfile } from '@/hooks/useEmailNotifications';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: AppRole;
  token: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch pending invites for current workspace
 */
export function useWorkspaceInvites() {
  const { currentWorkspace } = useWorkspace();

  // Realtime subscription para workspace_invites
  useRealtimeSubscription({
    table: 'workspace_invites',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [['workspace-invites', currentWorkspace?.id || '']],
    enabled: !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: ['workspace-invites', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WorkspaceInvite[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

/**
 * Hook to create a workspace invite
 */
export function useCreateWorkspaceInvite() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('create_workspace_invite', {
        p_workspace_id: currentWorkspace.id,
        p_email: email,
        p_role: role,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invites'] });
      queryClient.invalidateQueries({ queryKey: ['my-workspace-invites'] });
      
      // Criar notificação in-app para o usuário convidado (se já existe na plataforma)
      try {
        // Verificar se o usuário já existe na plataforma
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', variables.email)
          .maybeSingle();
        
        if (existingProfile) {
          // Criar notificação in-app
          await supabase.from('notifications').insert({
            user_id: existingProfile.id,
            workspace_id: currentWorkspace!.id,
            type: 'workspace_invite',
            title: 'Novo convite de workspace',
            message: `Você foi convidado para o workspace "${currentWorkspace!.name}"`,
            metadata: {
              workspace_name: currentWorkspace!.name,
              role: variables.role,
              invited_by: user?.email,
            },
          });
        }
      } catch (notifError) {
        console.error('Erro ao criar notificação:', notifError);
      }
      
      // Enviar email de notificação
      try {
        const inviterProfile = user?.id ? await fetchUserProfile(user.id) : null;
        const inviteData = data as { token?: string } | null;
        
        await sendWorkspaceInviteEmail({
          email: variables.email,
          workspace_id: currentWorkspace!.id,
          workspace_name: currentWorkspace!.name,
          inviter_name: inviterProfile?.name || 'Administrador',
          role: variables.role,
          token: inviteData?.token || '',
          expires_in: '7 dias',
        });
        
        toast.success('Convite enviado por email!');
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
        toast.success('Convite criado! (email não enviado)');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar convite');
    },
  });
}

/**
 * Hook to revoke a workspace invite
 */
export function useRevokeWorkspaceInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabase.rpc('revoke_workspace_invite', {
        p_invite_id: inviteId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invites'] });
      toast.success('Convite revogado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao revogar convite');
    },
  });
}

/**
 * Hook to accept a workspace invite (for the invited user)
 */
export function useAcceptWorkspaceInvite() {
  const queryClient = useQueryClient();
  const { refreshWorkspaces } = useWorkspace();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_workspace_invite', {
        p_token: token,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      refreshWorkspaces();
      toast.success('Convite aceito! Você foi adicionado ao workspace.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao aceitar convite');
    },
  });
}

/**
 * Hook to change a member's role
 */
export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('change_member_role', {
        p_workspace_id: currentWorkspace.id,
        p_user_id: userId,
        p_new_role: newRole,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Função atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao alterar função');
    },
  });
}

/**
 * Hook to promote a user to owner
 */
export function usePromoteToOwner() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('promote_to_owner', {
        p_workspace_id: currentWorkspace.id,
        p_target_user_id: userId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      toast.success('Usuário promovido a proprietário');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao promover usuário');
    },
  });
}

/**
 * Hook to transfer ownership
 */
export function useTransferOwnership() {
  const queryClient = useQueryClient();
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();

  return useMutation({
    mutationFn: async ({ newOwnerId, demoteSelf }: { newOwnerId: string; demoteSelf?: boolean }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('transfer_ownership', {
        p_workspace_id: currentWorkspace.id,
        p_new_owner_id: newOwnerId,
        p_demote_self: demoteSelf ?? false,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      refreshWorkspaces();
      toast.success('Propriedade transferida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao transferir propriedade');
    },
  });
}
