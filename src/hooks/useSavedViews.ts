import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { FilterQuery, SortConfig } from './useCardFilters';
import type { Json } from '@/integrations/supabase/types';

export interface SavedView {
  id: string;
  workspace_id: string;
  user_id: string;
  scope_type: 'space' | 'folder' | 'global';
  scope_id: string | null;
  name: string;
  is_default: boolean;
  query: FilterQuery;
  sort: SortConfig;
  view_mode: 'kanban' | 'list' | 'calendar';
  created_at: string;
  updated_at: string;
}

interface UseSavedViewsParams {
  scopeType: 'space' | 'folder' | 'global';
  scopeId?: string;
}

export function useSavedViews({ scopeType, scopeId }: UseSavedViewsParams) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['saved-views', currentWorkspace?.id, user?.id, scopeType, scopeId];

  const { data: views = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      let query = supabase
        .from('user_saved_views')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('scope_type', scopeType);

      if (scopeId) {
        query = query.eq('scope_id', scopeId);
      } else {
        query = query.is('scope_id', null);
      }

      const { data, error } = await query.order('name');

      if (error) {
        console.error('Error fetching saved views:', error);
        return [];
      }

      // Transform data to match SavedView interface
      return (data || []).map(item => ({
        id: item.id,
        workspace_id: item.workspace_id,
        user_id: item.user_id,
        scope_type: item.scope_type as 'space' | 'folder' | 'global',
        scope_id: item.scope_id,
        name: item.name,
        is_default: item.is_default,
        query: (item.query as unknown as FilterQuery) || {},
        sort: (item.sort as unknown as SortConfig) || { field: 'created_at', direction: 'desc' },
        view_mode: (item.view_mode as 'kanban' | 'list' | 'calendar') || 'kanban',
        created_at: item.created_at,
        updated_at: item.updated_at,
      })) as SavedView[];
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  const defaultView = views.find(v => v.is_default);

  const createView = useMutation({
    mutationFn: async (params: {
      name: string;
      query: FilterQuery;
      sort?: SortConfig;
      viewMode?: 'kanban' | 'list' | 'calendar';
      isDefault?: boolean;
    }) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_saved_views')
        .insert({
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          scope_type: scopeType,
          scope_id: scopeId || null,
          name: params.name,
          query: params.query as unknown as Json,
          sort: (params.sort || { field: 'created_at', direction: 'desc' }) as unknown as Json,
          view_mode: params.viewMode || 'kanban',
          is_default: params.isDefault || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Visão salva com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar visão');
    },
  });

  const updateView = useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      query?: FilterQuery;
      sort?: SortConfig;
      viewMode?: 'kanban' | 'list' | 'calendar';
      isDefault?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (params.name !== undefined) updates.name = params.name;
      if (params.query !== undefined) updates.query = params.query as unknown as Json;
      if (params.sort !== undefined) updates.sort = params.sort as unknown as Json;
      if (params.viewMode !== undefined) updates.view_mode = params.viewMode;
      if (params.isDefault !== undefined) updates.is_default = params.isDefault;

      const { data, error } = await supabase
        .from('user_saved_views')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Visão atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar visão');
    },
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_saved_views')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Visão removida');
    },
    onError: () => {
      toast.error('Erro ao remover visão');
    },
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_saved_views')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Visão definida como padrão');
    },
  });

  return {
    views,
    defaultView,
    isLoading,
    createView,
    updateView,
    deleteView,
    setDefault,
  };
}
