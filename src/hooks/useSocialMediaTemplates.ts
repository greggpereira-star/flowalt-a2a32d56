import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { Database } from '@/integrations/supabase/types';

// ==================== FOLDER TEMPLATES ====================

type FolderTemplate = Database['public']['Tables']['folder_templates']['Row'];

export function useFolderTemplates(spaceType: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['folder-templates', currentWorkspace?.id, spaceType],
    queryFn: async () => {
      if (!currentWorkspace) return [];

      const { data, error } = await supabase
        .from('folder_templates')
        .select('*')
        .or(`workspace_id.eq.${currentWorkspace.id},workspace_id.is.null`)
        .eq('space_type', spaceType)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace && !!spaceType,
  });
}

export function useApplyFolderTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, templateId }: { folderId: string; templateId: string }) => {
      const { data, error } = await supabase.rpc('apply_folder_template', {
        p_folder_id: folderId,
        p_template_id: templateId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { folderId }) => {
      queryClient.invalidateQueries({ queryKey: ['folder-views', folderId] });
    },
  });
}

// ==================== FOLDER VIEWS ====================

type FolderView = Database['public']['Tables']['folder_views']['Row'];

export function useFolderViews(folderId: string | undefined) {
  return useQuery({
    queryKey: ['folder-views', folderId],
    queryFn: async () => {
      if (!folderId) return [];

      const { data, error } = await supabase
        .from('folder_views')
        .select('*')
        .eq('folder_id', folderId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!folderId,
  });
}

export function useCreateFolderView() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      folderId,
      name,
      viewType,
      config = {},
    }: {
      folderId: string;
      name: string;
      viewType: string;
      config?: Record<string, unknown>;
    }) => {
      if (!currentWorkspace) throw new Error('No workspace');

      const { data, error } = await supabase
        .from('folder_views')
        .insert([{
          folder_id: folderId,
          workspace_id: currentWorkspace.id,
          name,
          view_type: viewType,
          view_config: config,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folder-views', data.folder_id] });
    },
  });
}

export function useDeleteFolderView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (viewId: string) => {
      const { data: view } = await supabase
        .from('folder_views')
        .select('folder_id')
        .eq('id', viewId)
        .single();

      const { error } = await supabase.from('folder_views').delete().eq('id', viewId);
      if (error) throw error;
      return view?.folder_id;
    },
    onSuccess: (folderId) => {
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: ['folder-views', folderId] });
      }
    },
  });
}

// ==================== CUSTOM FIELD DEFINITIONS ====================

type CustomFieldDefinition = Database['public']['Tables']['space_custom_field_definitions']['Row'];

export function useCustomFieldDefinitions(spaceType: string | undefined) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['custom-field-definitions', currentWorkspace?.id, spaceType],
    queryFn: async () => {
      if (!currentWorkspace || !spaceType) return [];

      const { data, error } = await supabase
        .from('space_custom_field_definitions')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('space_type', spaceType)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace && !!spaceType,
  });
}

export function useInitializeSpaceCustomFields() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (spaceType: string) => {
      if (!currentWorkspace) throw new Error('No workspace selected');

      const { data, error } = await supabase.rpc('initialize_space_custom_fields', {
        p_workspace_id: currentWorkspace.id,
        p_space_type: spaceType,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, spaceType) => {
      queryClient.invalidateQueries({
        queryKey: ['custom-field-definitions', currentWorkspace?.id, spaceType],
      });
    },
  });
}

// ==================== CARD CUSTOM FIELDS ====================

type CardCustomField = Database['public']['Tables']['card_custom_fields']['Row'];

export function useCardCustomFields(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card-custom-fields', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('card_custom_fields')
        .select('*')
        .eq('card_id', cardId);

      if (error) throw error;
      return data;
    },
    enabled: !!cardId,
  });
}

export function useUpdateCardCustomFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      fields,
    }: {
      cardId: string;
      fields: Record<string, string>;
    }) => {
      const updates = Object.entries(fields).map(([field_key, field_value]) => ({
        card_id: cardId,
        field_key,
        field_value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('card_custom_fields')
        .upsert(updates, { onConflict: 'card_id,field_key' });

      if (error) throw error;
      return { cardId, fields };
    },
    onSuccess: ({ cardId }) => {
      queryClient.invalidateQueries({ queryKey: ['card-custom-fields', cardId] });
    },
  });
}
