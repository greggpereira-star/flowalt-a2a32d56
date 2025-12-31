import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface KitTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  space_type?: string;
  department_id?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: KitTemplateItem[];
}

export interface KitTemplateItem {
  id: string;
  template_id: string;
  item_id: string;
  quantity: number;
  is_required: boolean;
  workspace_id: string;
  created_at: string;
  item?: {
    id: string;
    name: string;
    code: string;
    category: string;
  };
}

export function useKitTemplates(spaceType?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['kit-templates', currentWorkspace?.id, spaceType],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('kit_templates')
        .select(`
          *,
          items:kit_template_items(
            *,
            item:inventory_items(id, name, code, category)
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (spaceType) {
        query = query.eq('space_type', spaceType);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      return data as KitTemplate[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateKitTemplate() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      description?: string;
      space_type?: string;
      department_id?: string;
      items?: { item_id: string; quantity: number; is_required: boolean }[];
    }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Create template
      const { data: newTemplate, error: templateError } = await supabase
        .from('kit_templates')
        .insert({
          workspace_id: currentWorkspace.id,
          name: template.name,
          description: template.description,
          space_type: template.space_type,
          department_id: template.department_id,
          created_by: user?.id,
          is_active: true,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Add items
      if (template.items && template.items.length > 0) {
        const itemsToInsert = template.items.map(item => ({
          template_id: newTemplate.id,
          item_id: item.item_id,
          quantity: item.quantity,
          is_required: item.is_required,
          workspace_id: currentWorkspace.id,
        }));

        const { error: itemsError } = await supabase
          .from('kit_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
      toast.success('Template de kit criado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });
}

export function useApplyKitTemplate() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ templateId, cardId }: { templateId: string; cardId: string }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      // Fetch template items
      const { data: templateItems, error: fetchError } = await supabase
        .from('kit_template_items')
        .select('item_id, quantity, is_required')
        .eq('template_id', templateId);

      if (fetchError) throw fetchError;
      if (!templateItems || templateItems.length === 0) {
        throw new Error('Template sem itens');
      }

      // Add items to card kit
      const kitItems = templateItems.map(item => ({
        workspace_id: currentWorkspace.id,
        card_id: cardId,
        item_id: item.item_id,
        quantity_required: item.quantity,
        status: 'pending',
        notes: item.is_required ? 'Item obrigatório' : undefined,
      }));

      const { data, error } = await supabase
        .from('card_kits')
        .insert(kitItems)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['card-kit', variables.cardId] });
      toast.success('Template aplicado ao kit');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aplicar template: ${error.message}`);
    },
  });
}

export function useUpdateKitTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KitTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('kit_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
      toast.success('Template atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useDeleteKitTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete - just deactivate
      const { error } = await supabase
        .from('kit_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kit-templates'] });
      toast.success('Template removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}
