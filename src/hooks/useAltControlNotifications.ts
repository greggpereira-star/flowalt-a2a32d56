import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface CreateNotificationParams {
  userId: string;
  type: 'altcontrol_approval_pending' | 'altcontrol_approved' | 'altcontrol_needs_adjustment';
  title: string;
  message: string;
  proposalId: string;
}

export function useAltControlNotifications() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const createNotification = useMutation({
    mutationFn: async (params: CreateNotificationParams) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não encontrado');

      const { error } = await supabase.from('notifications').insert({
        user_id: params.userId,
        workspace_id: currentWorkspace.id,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: { proposal_id: params.proposalId },
        is_read: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifyApprovers = async (proposalId: string, clientName: string, totalHours: number) => {
    if (!currentWorkspace?.id) return;

    // Buscar aprovadores ativos
    const { data: approvers } = await supabase
      .from('altcontrol_approvers')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_active', true);

    if (!approvers || approvers.length === 0) return;

    // Criar notificação para cada aprovador
    for (const approver of approvers) {
      await createNotification.mutateAsync({
        userId: approver.user_id,
        type: 'altcontrol_approval_pending',
        title: 'Nova proposta aguardando aprovação',
        message: `Proposta para ${clientName} (${totalHours}h) precisa da sua análise.`,
        proposalId,
      });
    }
  };

  const notifyProposalApproved = async (proposalId: string, sellerId: string, clientName: string) => {
    await createNotification.mutateAsync({
      userId: sellerId,
      type: 'altcontrol_approved',
      title: 'Proposta aprovada!',
      message: `A proposta para ${clientName} foi aprovada. Você já pode gerar o PDF.`,
      proposalId,
    });
  };

  const notifyProposalNeedsAdjustment = async (
    proposalId: string,
    sellerId: string,
    clientName: string,
    comment?: string
  ) => {
    await createNotification.mutateAsync({
      userId: sellerId,
      type: 'altcontrol_needs_adjustment',
      title: 'Proposta requer ajustes',
      message: comment
        ? `A proposta para ${clientName} precisa de ajustes: "${comment}"`
        : `A proposta para ${clientName} precisa de ajustes.`,
      proposalId,
    });
  };

  return {
    createNotification,
    notifyApprovers,
    notifyProposalApproved,
    notifyProposalNeedsAdjustment,
  };
}
