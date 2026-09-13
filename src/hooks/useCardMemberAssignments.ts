import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface CardMemberAssignment {
  card_id: string;
  user_id: string;
}

/**
 * Hook to fetch all card-member assignments for the workspace
 * This is used to know which members are assigned to which cards
 */
export const useCardMemberAssignments = (options?: { includeInactive?: boolean }) => {
  const { currentWorkspace } = useWorkspace();
  // Por padrao so interessa trabalho em andamento. Telas que desenham a linha
  // do tempo inteira (Gantt) precisam tambem dos cards ja entregues, senao as
  // barras concluidas ficam sem responsavel.
  const includeInactive = options?.includeInactive ?? false;

  return useQuery({
    queryKey: ['card_member_assignments', currentWorkspace?.id, includeInactive],
    queryFn: async (): Promise<CardMemberAssignment[]> => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('card_members')
        .select(`
          card_id,
          user_id,
          cards!inner(workspace_id, status)
        `)
        .eq('cards.workspace_id', currentWorkspace.id);

      if (!includeInactive) {
        query = query.not('cards.status', 'in', '("delivered","archived")');
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(item => ({
        card_id: item.card_id,
        user_id: item.user_id,
      }));
    },
    enabled: !!currentWorkspace?.id,
  });
};
