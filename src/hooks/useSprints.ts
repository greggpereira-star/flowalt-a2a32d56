import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { triggerWebhook } from '@/lib/webhookTrigger';

export interface Sprint {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  goal: string | null;
  capacity_hours: number;
  allocated_hours: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SprintCard {
  id: string;
  sprint_id: string;
  card_id: string;
  added_at: string;
  added_by: string | null;
}

export const useSprints = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['sprints', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as Sprint[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useSprint = (sprintId: string | undefined) => {
  return useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: async () => {
      if (!sprintId) return null;

      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('id', sprintId)
        .maybeSingle();

      if (error) throw error;
      return data as Sprint | null;
    },
    enabled: !!sprintId,
  });
};

export const useSprintCards = (sprintId: string | undefined) => {
  return useQuery({
    queryKey: ['sprint_cards', sprintId],
    queryFn: async () => {
      if (!sprintId) return [];

      const { data, error } = await supabase
        .from('sprint_cards')
        .select(`
          *,
          card:cards(*)
        `)
        .eq('sprint_id', sprintId);

      if (error) throw error;
      return data;
    },
    enabled: !!sprintId,
  });
};

export const useCreateSprint = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      start_date: string;
      end_date: string;
      goal?: string;
      capacity_hours?: number;
    }) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sprints')
        .insert({
          workspace_id: currentWorkspace.id,
          name: input.name,
          description: input.description,
          start_date: input.start_date,
          end_date: input.end_date,
          goal: input.goal,
          capacity_hours: input.capacity_hours || 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger webhook
      triggerWebhook(currentWorkspace.id, 'sprint.created', {
        id: data.id,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        goal: data.goal,
        created_by: user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
};

export const useUpdateSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      description?: string | null;
      start_date?: string;
      end_date?: string;
      status?: 'planning' | 'active' | 'completed' | 'cancelled';
      goal?: string | null;
      capacity_hours?: number;
      allocated_hours?: number;
    }) => {
      const { data, error } = await supabase
        .from('sprints')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Determine webhook event type
      const isCompleted = updates.status === 'completed';
      const eventType = isCompleted ? 'sprint.completed' : 'sprint.updated';

      // Trigger webhook
      triggerWebhook(data.workspace_id, eventType, {
        id: data.id,
        name: data.name,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date,
        goal: data.goal,
        ...(isCompleted && { completed_at: new Date().toISOString() }),
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['sprint', data.id] });
    },
  });
};

export const useDeleteSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sprints')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
};

export const useAddCardToSprint = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      sprint_id,
      card_id,
    }: {
      sprint_id: string;
      card_id: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sprint_cards')
        .insert({
          sprint_id,
          card_id,
          added_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sprint_cards', data.sprint_id] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
};

export const useRemoveCardFromSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sprint_id,
      card_id,
    }: {
      sprint_id: string;
      card_id: string;
    }) => {
      const { error } = await supabase
        .from('sprint_cards')
        .delete()
        .eq('sprint_id', sprint_id)
        .eq('card_id', card_id);

      if (error) throw error;
      return { sprint_id, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sprint_cards', data.sprint_id] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
};
