import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Hook to get the Clients space for the current workspace
export const useClientsSpace = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['clients-space', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('name', 'Clientes')
        .eq('is_archived', false)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });
};

// Hook to get the system folders for the Clients space
export const useClientsSpaceFolders = (spaceId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['clients-space-folders', spaceId],
    queryFn: async () => {
      if (!spaceId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('space_id', spaceId)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!spaceId && !!currentWorkspace?.id,
  });
};
