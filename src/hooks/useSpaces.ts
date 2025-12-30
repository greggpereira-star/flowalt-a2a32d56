import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { SpaceType } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';

export interface Space {
  id: string;
  workspace_id: string;
  name: string;
  type: SpaceType;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
  settings: Json;
  created_at: string;
  updated_at: string;
}

export const useSpaces = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['spaces', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Space[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useSpace = (spaceId: string | undefined) => {
  return useQuery({
    queryKey: ['space', spaceId],
    queryFn: async () => {
      if (!spaceId) return null;

      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', spaceId)
        .maybeSingle();

      if (error) throw error;
      return data as Space | null;
    },
    enabled: !!spaceId,
  });
};

export const useCreateSpace = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (space: {
      name: string;
      type?: SpaceType;
      description?: string;
      icon?: string;
      color?: string;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase
        .from('spaces')
        .insert({
          workspace_id: currentWorkspace.id,
          name: space.name,
          type: space.type || 'custom',
          description: space.description,
          icon: space.icon || 'folder',
          color: space.color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
};

export const useUpdateSpace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      is_archived?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('spaces')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['space', data.id] });
    },
  });
};
