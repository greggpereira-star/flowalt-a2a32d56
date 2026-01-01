import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Card } from './useCards';

// Fetch all cards associated with a specific client
export const useClientSpaceCards = (clientId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['client-space-cards', clientId],
    queryFn: async () => {
      if (!clientId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('client_id', clientId)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!clientId && !!currentWorkspace?.id,
  });
};

// Stats for client cards
export const useClientSpaceStats = (clientId: string | undefined) => {
  const { data: cards } = useClientSpaceCards(clientId);

  const stats = {
    total: cards?.length || 0,
    backlog: cards?.filter(c => c.status === 'backlog').length || 0,
    briefing: cards?.filter(c => c.status === 'briefing').length || 0,
    todo: cards?.filter(c => c.status === 'todo').length || 0,
    inProgress: cards?.filter(c => c.status === 'in_progress').length || 0,
    review: cards?.filter(c => c.status === 'review').length || 0,
    approved: cards?.filter(c => c.status === 'approved').length || 0,
    delivered: cards?.filter(c => c.status === 'delivered').length || 0,
    overdue: cards?.filter(c => {
      if (!c.due_date || c.status === 'delivered' || c.status === 'approved') return false;
      return new Date(c.due_date) < new Date();
    }).length || 0,
    totalHours: cards?.reduce((sum, c) => sum + (c.estimated_hours || 0), 0) || 0,
    actualHours: cards?.reduce((sum, c) => sum + (c.actual_hours || 0), 0) || 0,
  };

  return stats;
};
