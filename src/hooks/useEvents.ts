import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export type EventType = 'meeting' | 'recording' | 'milestone' | 'deadline' | 'other';
export type ParticipantStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface Event {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  card_id: string | null;
  space_id: string | null;
  color: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  status: ParticipantStatus;
  responded_at: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export const useEvents = (startDate?: Date, endDate?: Date) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['events', currentWorkspace?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('start_time', { ascending: true });

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('end_time', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Event[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useMyEvents = (startDate?: Date, endDate?: Date) => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-events', currentWorkspace?.id, user?.id, startDate?.toISOString()],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      // Get events where user is creator or participant
      const { data: participations, error: partError } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      const eventIds = participations?.map(p => p.event_id) || [];

      let query = supabase
        .from('events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('start_time', { ascending: true });

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('end_time', endDate.toISOString());
      }

      // Filter by creator or participant
      if (eventIds.length > 0) {
        query = query.or(`created_by.eq.${user.id},id.in.(${eventIds.join(',')})`);
      } else {
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Event[];
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });
};

export const useEvent = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error) throw error;
      return data as Event | null;
    },
    enabled: !!eventId,
  });
};

export const useEventParticipants = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ['event_participants', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data: participants, error } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', eventId);

      if (error) throw error;

      // Fetch profiles
      const userIds = participants?.map(p => p.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      return participants?.map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.id === p.user_id),
      })) as EventParticipant[];
    },
    enabled: !!eventId,
  });
};

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      event_type: EventType;
      start_time: string;
      end_time: string;
      all_day?: boolean;
      location?: string;
      card_id?: string;
      space_id?: string;
      color?: string;
      participant_ids?: string[];
    }) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { participant_ids, ...eventData } = input;

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          ...eventData,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add participants
      if (participant_ids && participant_ids.length > 0) {
        const participants = participant_ids.map(userId => ({
          event_id: event.id,
          user_id: userId,
        }));

        await supabase.from('event_participants').insert(participants);
      }

      // Add creator as participant
      await supabase.from('event_participants').insert({
        event_id: event.id,
        user_id: user.id,
        status: 'accepted',
      });

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-agenda-participants-v2'] });
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      description?: string | null;
      event_type?: EventType;
      start_time?: string;
      end_time?: string;
      all_day?: boolean;
      location?: string | null;
      card_id?: string | null;
      space_id?: string | null;
      color?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-agenda-participants-v2'] });
      queryClient.invalidateQueries({ queryKey: ['event', data.id] });
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-agenda-participants-v2'] });
    },
  });
};

export const useUpdateParticipantStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event_id,
      status,
    }: {
      event_id: string;
      status: ParticipantStatus;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('event_participants')
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq('event_id', event_id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event_participants', data.event_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-agenda-participants-v2'] });
    },
  });
};

export const useAddParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event_id,
      user_id,
    }: {
      event_id: string;
      user_id: string;
    }) => {
      const { data, error } = await supabase
        .from('event_participants')
        .insert({ event_id, user_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event_participants', data.event_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-agenda-participants-v2'] });
    },
  });
};

export const useRemoveParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event_id,
      user_id,
    }: {
      event_id: string;
      user_id: string;
    }) => {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', event_id)
        .eq('user_id', user_id);

      if (error) throw error;
      return { event_id, user_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event_participants', data.event_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-agenda-participants-v2'] });
    },
  });
};

// Calculate hours blocked by events for capacity
export const useEventHours = (userId: string | undefined, startDate: Date, endDate: Date) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['event_hours', userId, currentWorkspace?.id, startDate.toISOString()],
    queryFn: async () => {
      if (!userId || !currentWorkspace?.id) return 0;

      // Get events where user is participant
      const { data: participations } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', userId)
        .in('status', ['accepted', 'pending']);

      if (!participations?.length) return 0;

      const eventIds = participations.map(p => p.event_id);

      const { data: events, error } = await supabase
        .from('events')
        .select('start_time, end_time, all_day')
        .in('id', eventIds)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString());

      if (error) throw error;

      // Calculate total hours
      const totalHours = events?.reduce((acc, event) => {
        if (event.all_day) return acc + 8; // Assume 8h for all-day events
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return acc + hours;
      }, 0) || 0;

      return Math.round(totalHours * 10) / 10;
    },
    enabled: !!userId && !!currentWorkspace?.id,
  });
};
