import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type { SpaceType } from '@/lib/supabase';
import type { SpaceTemplate } from '@/lib/spaceTemplates';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

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
  is_system: boolean;
  settings: Json;
  created_at: string;
  updated_at: string;
  // Access control fields
  access_level?: 'operational' | 'restricted';
  allowed_roles?: string[];
  template_key?: string;
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (space: {
      name: string;
      type?: SpaceType;
      description?: string;
      icon?: string;
      color?: string;
      template?: SpaceTemplate;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // 1. Create the space
      const { data: newSpace, error } = await supabase
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

      // 2. Apply template structure ONLY for social_media template
      // Other templates start blank - user creates their own structure
      if (space.template && space.template.id === 'social_media' && space.template.folders.length > 0) {
        await applyTemplateToSpace(newSpace.id, currentWorkspace.id, space.template, user?.id);
      }

      return newSpace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-usage'] });
      toast.success('Espaço criado com sucesso');
    },
    onError: (error: Error) => {
      // Parse entitlement-related errors for friendly messages
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('ENTITLEMENT_BLOCKED') || errorMessage.includes('Limite de espaços')) {
        toast.error('Limite de espaços atingido', {
          description: 'Faça upgrade do plano para criar mais espaços.',
          action: {
            label: 'Ver planos',
            onClick: () => window.location.href = '/settings?tab=billing',
          },
        });
      } else if (errorMessage.includes('PLAN_LIMIT')) {
        toast.error('Limite do plano atingido', {
          description: 'Você atingiu o limite de espaços do seu plano atual.',
        });
      } else {
        toast.error('Erro ao criar espaço', {
          description: errorMessage,
        });
      }
    },
  });
};

/**
 * Apply template structure to a space (creates folders and views)
 */
async function applyTemplateToSpace(
  spaceId: string, 
  workspaceId: string, 
  template: SpaceTemplate,
  userId?: string
) {
  // Create template folders
  if (template.folders.length > 0) {
    const foldersToCreate = template.folders.map((folder, index) => ({
      workspace_id: workspaceId,
      space_id: spaceId,
      name: folder.name,
      icon: folder.icon,
      color: folder.color,
      description: folder.description || null,
      is_personal: folder.isPersonal,
      owner_id: folder.isPersonal ? userId : null,
      sort_order: index,
    }));

    const { error: foldersError } = await supabase
      .from('folders')
      .insert(foldersToCreate);

    if (foldersError) {
      console.error('Error creating template folders:', foldersError);
    }
  }

  // Store template custom fields in space settings for future use
  if (template.customFields.length > 0) {
    const customFieldsJson = template.customFields.map(field => ({
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options || null,
      required: field.required || false,
    }));

    await supabase
      .from('spaces')
      .update({
        settings: {
          customFields: customFieldsJson,
          templateId: template.id,
        } as Json,
      })
      .eq('id', spaceId);
  }
}

export const useUpdateSpace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      access_level,
      allowed_roles,
      ...updates
    }: {
      id: string;
      name?: string;
      description?: string;
      icon?: string;
      color?: string;
      is_archived?: boolean;
      access_level?: 'operational' | 'restricted';
      allowed_roles?: string[];
    }) => {
      // Build update object with proper typing
      const updatePayload: Record<string, unknown> = { ...updates };
      if (access_level !== undefined) {
        updatePayload.access_level = access_level;
      }
      if (allowed_roles !== undefined) {
        updatePayload.allowed_roles = allowed_roles;
      }

      const { data, error } = await supabase
        .from('spaces')
        .update(updatePayload)
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

// ============================================================
// ENTERPRISE HOOKS - Reorder, Archive, Fix Order
// ============================================================

interface ReorderItem {
  id: string;
  sort_order: number;
}

/**
 * Hook para reordenar espaços com optimistic update, rollback e auditoria
 */
export const useReorderSpaces = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { items: ReorderItem[]; reason?: string }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const { data, error } = await supabase.rpc('reorder_spaces', {
        p_workspace_id: currentWorkspace.id,
        p_items: JSON.parse(JSON.stringify(params.items)),
        p_reason: params.reason || null,
      });

      if (error) throw error;
      return data as { success: boolean; updated_count: number };
    },
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['spaces', currentWorkspace?.id] });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<Space[]>(['spaces', currentWorkspace?.id]);

      // Optimistically update to the new value
      queryClient.setQueryData<Space[]>(['spaces', currentWorkspace?.id], (old) => {
        if (!old) return old;
        return old
          .map((space) => {
            const item = params.items.find((i) => i.id === space.id);
            return item ? { ...space, sort_order: item.sort_order } : space;
          })
          .sort((a, b) => a.sort_order - b.sort_order);
      });

      return { previous };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['spaces', currentWorkspace?.id], context.previous);
      }
      toast.error('Erro ao reordenar espaços');
    },
    onSuccess: () => {
      toast.success('Ordem dos espaços atualizada');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
};

/**
 * Hook para arquivar espaços (soft delete)
 * Bloqueia se is_system = true
 */
export const useArchiveSpace = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (spaceId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      // Verificar se é sistêmico
      const { data: space, error: fetchError } = await supabase
        .from('spaces')
        .select('is_system, name')
        .eq('id', spaceId)
        .single();

      if (fetchError) throw fetchError;

      if (space?.is_system) {
        throw new Error('Espaços do sistema não podem ser arquivados');
      }

      // Arquivar
      const { error: updateError } = await supabase
        .from('spaces')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', spaceId);

      if (updateError) throw updateError;

      // Audit log
      await supabase.from('audit_logs').insert({
        workspace_id: currentWorkspace.id,
        action: 'archived',
        entity_type: 'space',
        entity_id: spaceId,
        new_data: { is_archived: true },
      });

      // Domain event
      await supabase.from('domain_events').insert({
        workspace_id: currentWorkspace.id,
        event_type: 'SpaceArchived',
        aggregate_type: 'Space',
        aggregate_id: spaceId,
        payload: { space_name: space.name },
      });

      return { success: true, space_name: space.name };
    },
    onSuccess: (data) => {
      toast.success(`Espaço "${data.space_name}" arquivado`);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao arquivar espaço');
    },
  });
};

/**
 * Hook para corrigir ordem dos espaços (normalização)
 * Apenas para administradores
 */
export const useFixSpaceOrder = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const { data, error } = await supabase.rpc('fix_space_order', {
        p_workspace_id: currentWorkspace.id,
      });

      if (error) throw error;
      return data as number; // count of fixed spaces
    },
    onSuccess: (count) => {
      if (count > 0) {
        toast.success(`Ordem corrigida: ${count} espaço(s) atualizado(s)`);
      } else {
        toast.info('Ordem dos espaços já está correta');
      }
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
    onError: () => {
      toast.error('Erro ao corrigir ordem dos espaços');
    },
  });
};
