import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface ViewTemplate {
  id: string;
  workspace_id: string | null;
  space_type: string;
  name: string;
  description: string | null;
  view_type: string;
  icon: string;
  default_config: Record<string, unknown>;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export function useViewTemplates(spaceType: string | undefined) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['view-templates', currentWorkspace?.id, spaceType],
    queryFn: async () => {
      if (!spaceType) return [];

      const { data, error } = await supabase
        .from('view_templates')
        .select('*')
        .eq('space_type', spaceType)
        .or(`workspace_id.is.null,workspace_id.eq.${currentWorkspace?.id}`)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ViewTemplate[];
    },
    enabled: !!spaceType,
  });
}

export function useCreateFolderViewFromTemplate() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      folderId,
      templateId,
      name,
    }: {
      folderId: string;
      templateId: string;
      name: string;
    }) => {
      if (!currentWorkspace) throw new Error('No workspace');

      // Get the template
      const { data: template, error: templateError } = await supabase
        .from('view_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Create the view with template config
      const { data, error } = await supabase
        .from('folder_views')
        .insert({
          folder_id: folderId,
          workspace_id: currentWorkspace.id,
          name,
          view_type: template.view_type,
          view_config: template.default_config,
          source_template_id: templateId,
        })
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
