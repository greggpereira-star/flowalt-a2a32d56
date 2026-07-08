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
        
        const result = await sendWorkspaceInviteEmail({
          email: variables.email,
          workspace_id: currentWorkspace!.id,
          workspace_name: currentWorkspace!.name,
          inviter_name: inviterProfile?.name || user?.email || 'Administrador',
          inviter_email: user?.email || undefined,
          role: variables.role,
          token: inviteData?.token || '',
          expires_in: '7 dias',
        });
        
        if (result.success) {
          toast.success(`Convite enviado para ${variables.email}`, {
            description: 'O email foi entregue. Peça para a pessoa verificar a caixa de entrada (e a pasta de spam).',
          });
        } else {
          toast.warning('Convite criado, mas o email falhou', {
            description: result.error || 'Compartilhe o link manualmente com a pessoa.',
          });
        }
      } catch (emailError: any) {
        console.error('Erro ao enviar email:', emailError);
        toast.warning('Convite criado, mas o email não pôde ser enviado', {
          description: emailError?.message || 'Compartilhe o link de convite manualmente.',
        });
      }
    },
    onError: (error: Error) => {
      const msg = error.message || '';
      if (msg.includes('pending invite')) {
        toast.error('Este email já tem um convite pendente', {
          description: 'Revogue o convite atual antes de enviar um novo, ou reenvie o link existente.',
        });
      } else if (msg.includes('already a member')) {
        toast.error('Este usuário já faz parte do workspace');
      } else if (msg.includes('Permission denied')) {
        toast.error('Você não tem permissão para convidar usuários');
      } else {
        toast.error(msg || 'Erro ao enviar convite');
      }
    },
  });
}

/**
 * Hook to resend a pending workspace invite with client-side rate limiting.
 * Limits: min 60s between resends per email, max 5 resends per email per 24h.
 */
const RESEND_STORAGE_KEY = 'workspace_invite_resends_v1';
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_MAX_PER_DAY = 5;
const RESEND_WINDOW_MS = 24 * 60 * 60 * 1000;

type ResendHistory = Record<string, number[]>;

function readResendHistory(): ResendHistory {
  try {
    const raw = localStorage.getItem(RESEND_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ResendHistory;
  } catch {
    return {};
  }
}

function writeResendHistory(history: ResendHistory) {
  try {
    localStorage.setItem(RESEND_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

export function checkResendLimit(email: string): { allowed: boolean; reason?: string; retryAfterSec?: number } {
  const now = Date.now();
  const history = readResendHistory();
  const key = email.toLowerCase();
  const recent = (history[key] || []).filter((t) => now - t < RESEND_WINDOW_MS);
  if (recent.length > 0) {
    const last = recent[recent.length - 1];
    const elapsed = now - last;
    if (elapsed < RESEND_COOLDOWN_MS) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }
  if (recent.length >= RESEND_MAX_PER_DAY) {
    return { allowed: false, reason: 'daily_limit' };
  }
  return { allowed: true };
}

function recordResend(email: string) {
  const now = Date.now();
  const history = readResendHistory();
  const key = email.toLowerCase();
  const recent = (history[key] || []).filter((t) => now - t < RESEND_WINDOW_MS);
  recent.push(now);
  history[key] = recent;
  writeResendHistory(history);
}

export function useResendWorkspaceInvite() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (invite: WorkspaceInvite) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const limit = checkResendLimit(invite.email);
      if (!limit.allowed) {
        if (limit.reason === 'cooldown') {
          throw new Error(`Aguarde ${limit.retryAfterSec}s para reenviar para este email.`);
        }
        throw new Error(`Limite diário de reenvios atingido para ${invite.email} (máx. ${RESEND_MAX_PER_DAY}/dia).`);
      }

      // Check invite is still pending and not expired
      if (invite.status !== 'pending') {
        throw new Error('Este convite não está mais pendente.');
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        throw new Error('Convite expirado. Crie um novo convite.');
      }

      const inviterProfile = user?.id ? await fetchUserProfile(user.id) : null;

      const result = await sendWorkspaceInviteEmail({
        email: invite.email,
        workspace_id: currentWorkspace.id,
        workspace_name: currentWorkspace.name,
        inviter_name: inviterProfile?.name || user?.email || 'Administrador',
        inviter_email: user?.email || undefined,
        role: invite.role,
        token: invite.token,
        expires_in: '7 dias',
      });

      if (!result.success) {
        throw new Error(result.error || 'Falha ao reenviar o email.');
      }

      recordResend(invite.email);
      return result;
    },
    onSuccess: (_, invite) => {
      toast.success(`Convite reenviado para ${invite.email}`, {
        description: 'Peça para verificar a caixa de entrada e a pasta de spam.',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao reenviar convite');
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

      const result = data as { success?: boolean; error?: string; message?: string } | null;
      if (result?.success === false) {
        const friendlyErrors: Record<string, string> = {
          NOT_AUTHENTICATED: 'Faça login para aceitar o convite.',
          EMAIL_NOT_AVAILABLE: 'Não foi possível validar o email da sessão. Faça login novamente.',
          INVITE_NOT_FOUND: 'Convite não encontrado.',
          INVITE_EXPIRED: 'Este convite expirou. Solicite um novo convite.',
          INVITE_REVOKED: 'Este convite foi revogado.',
          INVITE_ALREADY_USED: 'Este convite já foi utilizado.',
          EMAIL_MISMATCH: 'Este convite pertence a outro email. Entre com o email convidado.',
        };
        throw new Error(friendlyErrors[result.error || ''] || result.error || 'Erro ao aceitar convite');
      }

      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      await refreshWorkspaces();
      await queryClient.invalidateQueries({ queryKey: ['profile-complete'] });
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
