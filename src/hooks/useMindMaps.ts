import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { MindMapNode } from '@/components/cards/FreeMindMap';

export interface MindMap {
  id: string;
  name: string;
  nodes: MindMapNode[];
  workspace_id: string;
  space_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useMindMaps(spaceId?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['mind-maps', currentWorkspace?.id, spaceId],
    queryFn: async () => {
      let query = supabase
        .from('mind_maps')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .order('updated_at', { ascending: false });

      if (spaceId) {
        query = query.eq('space_id', spaceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map(d => ({ ...d, nodes: d.nodes as MindMapNode[] })) as MindMap[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateMindMap() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, spaceId, nodes }: { name: string; spaceId?: string; nodes?: MindMapNode[] }) => {
      const { data, error } = await supabase
        .from('mind_maps')
        .insert({
          name,
          nodes: (nodes || []) as any,
          workspace_id: currentWorkspace!.id,
          space_id: spaceId || null,
          created_by: user!.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as any as MindMap;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mind-maps'] });
      toast.success('Mapa mental criado!');
    },
    onError: () => toast.error('Erro ao criar mapa mental'),
  });
}

export function useUpdateMindMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, nodes }: { id: string; name?: string; nodes?: MindMapNode[] }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (nodes !== undefined) updates.nodes = nodes as any;

      const { error } = await supabase
        .from('mind_maps')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mind-maps'] });
    },
    onError: () => toast.error('Erro ao salvar mapa mental'),
  });
}

export function useDeleteMindMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mind_maps')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mind-maps'] });
      toast.success('Mapa mental excluído');
    },
    onError: () => toast.error('Erro ao excluir mapa mental'),
  });
}
