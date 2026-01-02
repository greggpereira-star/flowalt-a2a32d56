import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { triggerWebhook, getCardWorkspaceId } from '@/lib/webhookTrigger';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  assignee_id: string | null;
  function_title: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useChecklists = (cardId: string | undefined) => {
  // Realtime subscription para checklists do card
  useRealtimeSubscription({
    table: 'checklists',
    filter: cardId ? `card_id=eq.${cardId}` : undefined,
    queryKeys: [['checklists', cardId || '']],
    enabled: !!cardId,
  });

  return useQuery({
    queryKey: ['checklists', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('card_id', cardId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Checklist[];
    },
    enabled: !!cardId,
  });
};

export const useCreateChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      card_id,
      title,
      assignee_id,
      function_title,
    }: {
      card_id: string;
      title: string;
      assignee_id?: string;
      function_title?: string;
    }) => {
      const { data, error } = await supabase
        .from('checklists')
        .insert({
          card_id,
          title,
          assignee_id,
          function_title,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook
      const workspaceId = await getCardWorkspaceId(card_id);
      if (workspaceId) {
        triggerWebhook(workspaceId, 'checklist.item.created', {
          id: data.id,
          card_id: data.card_id,
          title: data.title,
          assignee_id: data.assignee_id,
          function_title: data.function_title,
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checklists', data.card_id] });
    },
  });
};

export const useUpdateChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
      ...updates
    }: {
      id: string;
      card_id: string;
      title?: string;
      is_completed?: boolean;
      assignee_id?: string | null;
      function_title?: string | null;
    }) => {
      const updateData: Record<string, unknown> = { ...updates };
      
      if (updates.is_completed !== undefined) {
        updateData.completed_at = updates.is_completed ? new Date().toISOString() : null;
      }

      const { data, error } = await supabase
        .from('checklists')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook if item was completed
      if (updates.is_completed === true) {
        const workspaceId = await getCardWorkspaceId(card_id);
        if (workspaceId) {
          triggerWebhook(workspaceId, 'checklist.item.completed', {
            id: data.id,
            card_id,
            title: data.title,
            completed_at: data.completed_at,
            assignee_id: data.assignee_id,
          });
        }
      }

      return { ...data, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checklists', data.card_id] });
    },
  });
};

export const useDeleteChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, card_id }: { id: string; card_id: string }) => {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checklists', data.card_id] });
    },
  });
};
