import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CardInvite {
  id: string;
  card_id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  permission: 'view' | 'comment' | 'edit';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useCardInvites = (cardId?: string) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card_invites', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('card_invites')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CardInvite[];
    },
    enabled: !!cardId,
  });
};

export const useMyPendingInvites = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my_pending_invites', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

      const { data, error } = await supabase
        .from('card_invites')
        .select(`
          *,
          cards:card_id (
            id,
            title,
            description,
            status,
            urgency
          )
        `)
        .eq('email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });
};

export const useCreateCardInvite = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      email,
      permission = 'view',
    }: {
      cardId: string;
      email: string;
      permission?: 'view' | 'comment' | 'edit';
    }) => {
      if (!currentWorkspace?.id || !user?.id) {
        throw new Error('Workspace ou usuário não encontrado');
      }

      const { data, error } = await supabase
        .from('card_invites')
        .insert({
          card_id: cardId,
          workspace_id: currentWorkspace.id,
          email: email.toLowerCase().trim(),
          invited_by: user.id,
          permission,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este e-mail já foi convidado para este card');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card_invites', variables.cardId] });
      toast.success('Convite enviado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar convite');
    },
  });
};

export const useRespondToInvite = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      inviteId,
      response,
    }: {
      inviteId: string;
      response: 'accepted' | 'declined';
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const updateData: Record<string, unknown> = {
        status: response,
      };

      if (response === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
        updateData.accepted_by = user.id;
      }

      const { data, error } = await supabase
        .from('card_invites')
        .update(updateData)
        .eq('id', inviteId)
        .select()
        .single();

      if (error) throw error;

      // If accepted, add user as card member
      if (response === 'accepted' && data) {
        const { error: memberError } = await supabase
          .from('card_members')
          .insert({
            card_id: data.card_id,
            user_id: user.id,
            is_owner: false,
          });

        if (memberError && memberError.code !== '23505') {
          console.error('Error adding card member:', memberError);
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my_pending_invites'] });
      queryClient.invalidateQueries({ queryKey: ['card_members'] });
      toast.success(
        variables.response === 'accepted' 
          ? 'Convite aceito! Você agora tem acesso ao card.' 
          : 'Convite recusado.'
      );
    },
    onError: () => {
      toast.error('Erro ao responder ao convite');
    },
  });
};

export const useRevokeInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('card_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card_invites'] });
      toast.success('Convite revogado');
    },
    onError: () => {
      toast.error('Erro ao revogar convite');
    },
  });
};
