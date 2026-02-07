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
export const useCardMemberAssignments = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card_member_assignments', currentWorkspace?.id],
    queryFn: async (): Promise<CardMemberAssignment[]> => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('card_members')
        .select(`
          card_id,
          user_id,
          cards!inner(workspace_id, status)
        `)
        .eq('cards.workspace_id', currentWorkspace.id)
        .not('cards.status', 'in', '("delivered","archived")');

      if (error) throw error;

      return (data || []).map(item => ({
        card_id: item.card_id,
        user_id: item.user_id,
      }));
    },
    enabled: !!currentWorkspace?.id,
  });
};
