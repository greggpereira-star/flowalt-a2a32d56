import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerWebhook, getCardWorkspaceId } from '@/lib/webhookTrigger';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  mentions: string[] | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const useComments = (cardId: string | undefined) => {
  // Realtime subscription para comments do card
  useRealtimeSubscription({
    table: 'comments',
    filter: cardId ? `card_id=eq.${cardId}` : undefined,
    queryKeys: [['comments', cardId || '']],
    enabled: !!cardId,
  });

  return useQuery({
    queryKey: ['comments', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      // Get comments first
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Get unique user IDs
      const userIds = [...new Set(commentsData.map((c) => c.user_id))];

      // Fetch profiles for those users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      // Map profiles to comments
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return commentsData.map((comment) => ({
        ...comment,
        user: profileMap.get(comment.user_id) || undefined,
      })) as Comment[];
    },
    enabled: !!cardId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      card_id,
      content,
      mentions,
    }: {
      card_id: string;
      content: string;
      mentions?: string[];
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('comments')
        .insert({
          card_id,
          user_id: user.id,
          content,
          mentions: mentions || [],
        })
        .select()
        .single();

      if (error) throw error;

      // Get workspace ID and card title for notifications
      const workspaceId = await getCardWorkspaceId(card_id);
      
      // Get card title for notification
      const { data: cardData } = await supabase
        .from('cards')
        .select('title')
        .eq('id', card_id)
        .single();
      
      // Get commenter profile
      const { data: commenterProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      const commenterName = commenterProfile?.full_name || 'Alguém';
      const cardTitle = cardData?.title || 'um card';

      // Create notifications for mentioned users and card participants
      if (workspaceId) {
        // Load participants of the card (so they also get "new message" alerts)
        const { data: cardMembers, error: cardMembersError } = await supabase
          .from('card_members')
          .select('user_id')
          .eq('card_id', card_id);

        if (cardMembersError) {
          console.error('Error fetching card members for notifications:', cardMembersError);
        }

        const participantIds = (cardMembers || [])
          .map((m) => m.user_id)
          .filter(Boolean) as string[];

        const mentionIds = mentions || [];

        const recipientIds = Array.from(
          new Set([...participantIds, ...mentionIds])
        ).filter((id) => id && id !== user.id);

        if (recipientIds.length > 0) {
          const notificationsToInsert = recipientIds.map((recipientId) => {
            const isMention = mentionIds.includes(recipientId);
            return {
              user_id: recipientId,
              workspace_id: workspaceId,
              type: isMention ? 'mention' : 'assignment',
              title: isMention ? 'Você foi mencionado' : 'Nova mensagem',
              message: isMention
                ? `${commenterName} mencionou você em "${cardTitle}"`
                : `${commenterName} enviou uma nova mensagem em "${cardTitle}"`,
              metadata: {
                card_id,
                comment_id: data.id,
                commenter_id: user.id,
                commenter_name: commenterName,
                kind: isMention ? 'mention' : 'comment',
              },
              is_read: false,
            };
          });

          console.log('Creating comment notifications:', notificationsToInsert);

          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notificationsToInsert);

          if (notifError) {
            console.error('Error creating comment notifications:', notifError);
          }
        } else {
          console.log('No recipients to notify (only yourself or none):', {
            mentions,
            participantIds,
          });
        }
      } else {
        console.log('Missing workspaceId, skipping notifications:', { card_id });
      }

      // Trigger webhook
      if (workspaceId) {
        triggerWebhook(workspaceId, 'comment.created', {
          id: data.id,
          card_id: data.card_id,
          content: data.content,
          user_id: user.id,
          mentions: data.mentions,
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.card_id] });
    },
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
      content,
    }: {
      id: string;
      card_id: string;
      content: string;
    }) => {
      const { data, error } = await supabase
        .from('comments')
        .update({ content })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.card_id] });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, card_id }: { id: string; card_id: string }) => {
      const { error } = await supabase.from('comments').delete().eq('id', id);

      if (error) throw error;
      return { id, card_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.card_id] });
    },
  });
};
