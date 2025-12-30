import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface CardAutomation {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  trigger_status: string;
  action_type: string;
  action_config: Json;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  card_id: string;
  trigger_status: string;
  action_type: string;
  action_result: Json;
  executed_at: string;
  success: boolean;
  error_message: string | null;
}

export interface CreateAutomationInput {
  name: string;
  description?: string;
  trigger_status: string;
  action_type: string;
  action_config: Record<string, string>;
}

export const useAutomations = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['automations', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('card_automations')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CardAutomation[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useAutomationLogs = (automationId?: string) => {
  return useQuery({
    queryKey: ['automation-logs', automationId],
    queryFn: async () => {
      if (!automationId) return [];

      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('automation_id', automationId)
        .order('executed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AutomationLog[];
    },
    enabled: !!automationId,
  });
};

export const useCreateAutomation = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateAutomationInput) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('card_automations')
        .insert({
          workspace_id: currentWorkspace.id,
          name: input.name,
          description: input.description,
          trigger_status: input.trigger_status,
          action_type: input.action_type,
          action_config: input.action_config,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CardAutomation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
};

export const useUpdateAutomation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      description?: string;
      trigger_status?: string;
      action_type?: string;
      action_config?: Record<string, string>;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('card_automations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CardAutomation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
};

export const useDeleteAutomation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('card_automations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });
};
