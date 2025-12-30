import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type { CardStatus, CardUrgency } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';

export interface Card {
  id: string;
  workspace_id: string;
  space_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: CardStatus;
  urgency: CardUrgency;
  due_date: string | null;
  completed_at: string | null;
  owner_id: string | null;
  briefing_completed: boolean;
  briefing_data: Json;
  traffic_briefing_data: Json | null;
  estimated_hours: number | null;
  actual_hours: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCardInput {
  title: string;
  space_id: string;
  folder_id?: string;
  description?: string;
  status?: CardStatus;
  urgency?: CardUrgency;
  due_date?: string;
  client_id?: string;
}

export const useCards = (spaceId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards', 'space', spaceId],
    queryFn: async () => {
      if (!spaceId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('space_id', spaceId)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!spaceId && !!currentWorkspace?.id,
  });
};

export const useAllCards = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards', 'all', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCardsByFolder = (folderId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards', 'folder', folderId],
    queryFn: async () => {
      if (!folderId || !currentWorkspace?.id) return [];

      const { data: cardFolders, error: cfError } = await supabase
        .from('card_folders')
        .select('card_id')
        .eq('folder_id', folderId);

      if (cfError) throw cfError;
      if (!cardFolders.length) return [];

      const cardIds = cardFolders.map(cf => cf.card_id);

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .in('id', cardIds)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!folderId && !!currentWorkspace?.id,
  });
};

export const useCard = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['card', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .maybeSingle();

      if (error) throw error;
      return data as Card | null;
    },
    enabled: !!cardId,
  });
};

export const useCreateCard = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCardInput) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { data: card, error: cardError } = await supabase
        .from('cards')
        .insert({
          workspace_id: currentWorkspace.id,
          space_id: input.space_id,
          title: input.title,
          description: input.description,
          status: input.status || 'backlog',
          urgency: input.urgency || 'medium',
          due_date: input.due_date,
          client_id: input.client_id,
          owner_id: user.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (cardError) throw cardError;

      // Add to folder if specified
      if (input.folder_id) {
        await supabase
          .from('card_folders')
          .insert({
            card_id: card.id,
            folder_id: input.folder_id,
          });
      }

      // Add creator as card member
      await supabase
        .from('card_members')
        .insert({
          card_id: card.id,
          user_id: user.id,
          is_owner: true,
        });

      return card;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['cards', 'space', data.space_id] });
    },
  });
};

export const useUpdateCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      description?: string;
      status?: CardStatus;
      urgency?: CardUrgency;
      due_date?: string | null;
      client_id?: string | null;
      owner_id?: string | null;
      briefing_completed?: boolean;
      estimated_hours?: number | null;
    }) => {
      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card', data.id] });
    },
  });
};

export const useUpdateCardStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, status }: { cardId: string; status: CardStatus }) => {
      const updates: { status: CardStatus; completed_at?: string } = { status };
      
      if (status === 'delivered') {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card', data.id] });
    },
  });
};

export const useDeleteCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('cards')
        .update({ status: 'archived' })
        .eq('id', cardId);

      if (error) throw error;
      return cardId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
};
