import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserSpaceTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  workspace_id: string;
  created_by: string;
  is_user_template: boolean;
  folders_config: FolderConfig[];
  views_config: ViewConfig[];
  custom_fields_config: CustomFieldConfig[];
  created_at: string;
  updated_at: string;
}

interface FolderConfig {
  name: string;
  icon: string;
  color: string;
  description?: string;
  views: ViewConfig[];
}

interface ViewConfig {
  name: string;
  view_type: string;
  view_config?: Record<string, unknown>;
}

interface CustomFieldConfig {
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

/**
 * Hook to fetch user-created space templates for the current workspace
 */
export const useUserSpaceTemplates = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['user-space-templates', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('space_templates')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_user_template', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse and map data to proper types
      return (data || []).map((template) => {
        const raw = template as unknown as Record<string, unknown>;
        return {
          id: raw.id as string || raw.key as string,
          key: raw.key as string,
          name: raw.name as string,
          description: raw.description as string | null,
          icon: (raw.icon as string) || 'folder',
          color: (raw.color as string) || '#6366f1',
          workspace_id: raw.workspace_id as string,
          created_by: raw.created_by as string,
          is_user_template: raw.is_user_template as boolean,
          folders_config: (raw.folders_config as FolderConfig[]) || [],
          views_config: (raw.views_config as ViewConfig[]) || [],
          custom_fields_config: (raw.custom_fields_config as CustomFieldConfig[]) || [],
          created_at: raw.created_at as string,
          updated_at: raw.updated_at as string,
        } as UserSpaceTemplate;
      });
    },
    enabled: !!currentWorkspace?.id,
  });
};

/**
 * Hook to save current space structure as a reusable template
 */
export const useSaveSpaceAsTemplate = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      spaceId: string;
      name: string;
      description?: string;
      icon: string;
      color: string;
    }) => {
      if (!currentWorkspace?.id || !user?.id) {
        throw new Error('Workspace ou usuário não encontrado');
      }

      // 1. Fetch current space folders
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('id, name, icon, color, description')
        .eq('space_id', params.spaceId)
        .eq('is_personal', false) // Don't include personal folders
        .order('sort_order', { ascending: true });

      if (foldersError) throw foldersError;

      // 2. Fetch views for each folder
      const foldersConfig: FolderConfig[] = [];
      
      for (const folder of folders || []) {
        const { data: views } = await supabase
          .from('folder_views')
          .select('name, view_type, view_config')
          .eq('folder_id', folder.id)
          .order('sort_order', { ascending: true });

        foldersConfig.push({
          name: folder.name,
          icon: folder.icon || 'folder',
          color: folder.color || '#6366f1',
          description: folder.description || undefined,
          views: (views || []).map((v) => ({
            name: v.name,
            view_type: v.view_type,
            view_config: v.view_config as Record<string, unknown> | undefined,
          })),
        });
      }

      // 3. Fetch custom fields from space settings
      const { data: space } = await supabase
        .from('spaces')
        .select('settings')
        .eq('id', params.spaceId)
        .single();

      const settings = space?.settings as Record<string, unknown> | null;
      const customFieldsConfig = (settings?.customFields as CustomFieldConfig[]) || [];

      // Generate a unique key for the template
      const templateKey = `user_${currentWorkspace.id.slice(0, 8)}_${Date.now()}`;

      // 4. Create the template using raw insert to bypass type issues
      const { data: template, error: templateError } = await supabase
        .from('space_templates')
        .insert([{
          key: templateKey,
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          is_user_template: true,
          name: params.name,
          description: params.description || null,
          icon: params.icon,
          color: params.color,
          folders_config: JSON.parse(JSON.stringify(foldersConfig)),
          views_config: [],
          custom_fields_config: JSON.parse(JSON.stringify(customFieldsConfig)),
        }])
        .select()
        .single();

      if (templateError) throw templateError;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-space-templates'] });
      toast.success('Template salvo com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar template', {
        description: error.message,
      });
    },
  });
};

/**
 * Hook to apply a user template to a space
 */
export const useApplyUserTemplate = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      spaceId: string;
      template: UserSpaceTemplate;
    }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não encontrado');

      const { spaceId, template } = params;

      // Create folders and their views
      for (let i = 0; i < template.folders_config.length; i++) {
        const folderConfig = template.folders_config[i];
        
        // Create folder
        const { data: folder, error: folderError } = await supabase
          .from('folders')
          .insert({
            workspace_id: currentWorkspace.id,
            space_id: spaceId,
            name: folderConfig.name,
            icon: folderConfig.icon,
            color: folderConfig.color,
            description: folderConfig.description || null,
            sort_order: i,
          })
          .select()
          .single();

        if (folderError) throw folderError;

        // Create views for this folder
        if (folderConfig.views && folderConfig.views.length > 0) {
          const viewsToInsert = folderConfig.views.map((v, idx) => ({
            workspace_id: currentWorkspace.id,
            folder_id: folder.id,
            name: v.name,
            view_type: v.view_type,
            view_config: JSON.parse(JSON.stringify(v.view_config || {})),
            sort_order: idx,
          }));

          const { error: viewsError } = await supabase
            .from('folder_views')
            .insert(viewsToInsert);

          if (viewsError) throw viewsError;
        }
      }

      // Update space settings with custom fields
      if (template.custom_fields_config.length > 0) {
        await supabase
          .from('spaces')
          .update({
            settings: JSON.parse(JSON.stringify({
              customFields: template.custom_fields_config,
              templateId: template.id,
            })),
          })
          .eq('id', spaceId);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-views'] });
      toast.success('Template aplicado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao aplicar template', {
        description: error.message,
      });
    },
  });
};

/**
 * Hook to delete a user-created template
 */
export const useDeleteUserTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateKey: string) => {
      const { error } = await supabase
        .from('space_templates')
        .delete()
        .eq('key', templateKey)
        .eq('is_user_template', true);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-space-templates'] });
      toast.success('Template excluído');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir template', {
        description: error.message,
      });
    },
  });
};
