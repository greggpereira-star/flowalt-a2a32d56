import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * Lightweight count of cards already created from ideas in the current workspace.
 * Used by the onboarding checklist to mark the "Transformar em card" step as done.
 */
export function useIdeaCardLinksCount() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  return useQuery({
    queryKey: ['idea-card-links-count', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('idea_card_links')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId!);
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}
