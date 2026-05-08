import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export interface Folder {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string;
  is_personal: boolean;
  owner_id: string | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export const useFolders = (spaceId: string | undefined) => {
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;

  return useQuery({
    queryKey: ['folders', spaceId],
    queryFn: async () => {
      if (!spaceId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('space_id', spaceId)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Folder[];
    },
    enabled: !!spaceId && !!currentWorkspace?.id,
  });
};

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  const workspaceContext = useWorkspace();
  const currentWorkspace = workspaceContext?.currentWorkspace;
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (folder: {
      space_id: string;
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      is_personal?: boolean;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase
        .from('folders')
        .insert({
          workspace_id: currentWorkspace.id,
          space_id: folder.space_id,
          name: folder.name,
          description: folder.description,
          color: folder.color,
          icon: folder.icon || 'folder',
          is_personal: folder.is_personal || false,
          owner_id: folder.is_personal ? user?.id : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folders', data.space_id] });
    },
  });
};

export const useUpdateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Folder> & { id: string }) => {
      const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folders', data.space_id] });
    },
  });
};

export const useDeleteFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, spaceId }: { id: string; spaceId: string }) => {
      const { error } = await supabase
        .from('folders')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
      return { id, spaceId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folders', data.spaceId] });
    },
  });
};
