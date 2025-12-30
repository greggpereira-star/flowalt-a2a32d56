import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface Dependency {
  id: string;
  workspace_id: string;
  blocking_card_id: string | null;
  blocking_checklist_id: string | null;
  dependent_card_id: string | null;
  dependent_checklist_id: string | null;
  created_at: string;
}

export const useDependencies = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dependencies', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('dependencies')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return data as Dependency[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCardDependencies = (cardId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['card_dependencies', cardId],
    queryFn: async () => {
      if (!cardId || !currentWorkspace?.id) return { blocking: [], dependents: [] };

      // Get cards that block this card
      const { data: blocking, error: blockingError } = await supabase
        .from('dependencies')
        .select('*, blocking_card:cards!dependencies_blocking_card_id_fkey(id, title, status)')
        .eq('dependent_card_id', cardId);

      if (blockingError) throw blockingError;

      // Get cards that depend on this card
      const { data: dependents, error: dependentsError } = await supabase
        .from('dependencies')
        .select('*, dependent_card:cards!dependencies_dependent_card_id_fkey(id, title, status)')
        .eq('blocking_card_id', cardId);

      if (dependentsError) throw dependentsError;

      return {
        blocking: blocking || [],
        dependents: dependents || [],
      };
    },
    enabled: !!cardId && !!currentWorkspace?.id,
  });
};

export const useCreateDependency = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      blocking_card_id,
      dependent_card_id,
    }: {
      blocking_card_id: string;
      dependent_card_id: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const { data, error } = await supabase
        .from('dependencies')
        .insert({
          workspace_id: currentWorkspace.id,
          blocking_card_id,
          dependent_card_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['card_dependencies'] });
    },
  });
};

export const useDeleteDependency = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dependencies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependencies'] });
      queryClient.invalidateQueries({ queryKey: ['card_dependencies'] });
    },
  });
};
