import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { triggerWebhook } from '@/lib/webhookTrigger';

export interface TimeEntry {
  id: string;
  card_id: string;
  checklist_id: string | null;
  user_id: string;
  workspace_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  is_running: boolean;
  notes: string | null;
  function_title: string | null;
  created_at: string;
}

export const useTimeEntries = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['time_entries', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!cardId,
  });
};

export const useRunningTimer = (cardId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['running_timer', cardId, user?.id],
    queryFn: async () => {
      if (!cardId || !user?.id) return null;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('card_id', cardId)
        .eq('user_id', user.id)
        .eq('is_running', true)
        .maybeSingle();

      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!cardId && !!user?.id,
    refetchInterval: 1000, // Refetch every second for running timer
  });
};

export const useStartTimer = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      card_id,
      checklist_id,
      function_title,
    }: {
      card_id: string;
      checklist_id?: string;
      function_title?: string;
    }) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('Not authenticated');

      // First stop any running timers for this user on this card
      await supabase
        .from('time_entries')
        .update({ 
          is_running: false,
          ended_at: new Date().toISOString(),
        })
        .eq('card_id', card_id)
        .eq('user_id', user.id)
        .eq('is_running', true);

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          card_id,
          checklist_id,
          user_id: user.id,
          workspace_id: currentWorkspace.id,
          started_at: new Date().toISOString(),
          is_running: true,
          function_title,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['running_timer', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['card-history', data.card_id] });
    },
  });
};

export const useStopTimer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
      notes,
    }: {
      id: string;
      card_id: string;
      notes?: string;
    }) => {
      // Get the current entry to calculate duration
      const { data: entry, error: fetchError } = await supabase
        .from('time_entries')
        .select('started_at')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const endedAt = new Date();
      const startedAt = new Date(entry.started_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      const { data, error } = await supabase
        .from('time_entries')
        .update({
          is_running: false,
          ended_at: endedAt.toISOString(),
          duration_seconds: durationSeconds,
          notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update actual_hours on the card
      const { data: allEntries } = await supabase
        .from('time_entries')
        .select('duration_seconds')
        .eq('card_id', card_id)
        .eq('is_running', false);

      if (allEntries) {
        const totalSeconds = allEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
        const totalHours = parseFloat((totalSeconds / 3600).toFixed(2));
        await supabase
          .from('cards')
          .update({ actual_hours: totalHours })
          .eq('id', card_id);
      }

      // Trigger webhook
      triggerWebhook(data.workspace_id, 'time_entry.logged', {
        id: data.id,
        card_id: data.card_id,
        user_id: data.user_id,
        duration_seconds: durationSeconds,
        started_at: data.started_at,
        ended_at: data.ended_at,
        notes: data.notes,
      });

      return { ...data, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['running_timer', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['card', data.card_id] });
      queryClient.invalidateQueries({ queryKey: ['card-history', data.card_id] });
    },
  });
};

export const useDeleteTimeEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, card_id }: { id: string; card_id: string }) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time_entries', data.card_id] });
    },
  });
};
