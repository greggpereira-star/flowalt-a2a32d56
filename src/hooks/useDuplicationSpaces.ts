import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface DuplicationSpace {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

/**
 * Returns ALL non-archived spaces in the current workspace, bypassing per-space ACL,
 * so users can duplicate cards into teams' spaces they can't otherwise browse.
 */
export const useDuplicationSpaces = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['duplication-spaces', currentWorkspace?.id],
    queryFn: async (): Promise<DuplicationSpace[]> => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase.rpc(
        'list_workspace_spaces_for_duplication',
        { _workspace_id: currentWorkspace.id }
      );
      if (error) throw error;
      return (data || []) as DuplicationSpace[];
    },
    enabled: !!currentWorkspace?.id,
  });
};
