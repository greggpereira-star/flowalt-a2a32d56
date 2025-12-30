import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useClients = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['clients', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (client: {
      name: string;
      description?: string;
      color?: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase
        .from('clients')
        .insert({
          workspace_id: currentWorkspace.id,
          name: client.name,
          description: client.description,
          color: client.color,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
};
