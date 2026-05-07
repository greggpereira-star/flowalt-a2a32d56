import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useRealtimeCards = (spaceId?: string) => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel('cards-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        (payload) => {
          console.log('Realtime card update:', payload);

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['cards'] });
          queryClient.invalidateQueries({ queryKey: ['card-history'] });
          queryClient.invalidateQueries({ queryKey: ['client-cards'] }); // Refresh client card associations if any
          
          if (spaceId) {
            queryClient.invalidateQueries({ queryKey: ['cards', 'space', spaceId] });
          }

          // Show toast for new cards created by others
          if (payload.eventType === 'INSERT') {
            const newCard = payload.new as { title: string; created_by: string };
            if (newCard.created_by !== user?.id) {
              toast({
                title: 'Novo card criado',
                description: newCard.title,
                duration: 3000,
              });
            }
          }

          if (payload.eventType === 'UPDATE') {
            const updatedCard = payload.new as { id: string };
            queryClient.invalidateQueries({ queryKey: ['card', updatedCard.id] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'card_spaces',
        },
        (payload) => {
          console.log('Realtime card_spaces update:', payload);
          queryClient.invalidateQueries({ queryKey: ['cards'] });
          queryClient.invalidateQueries({ queryKey: ['card-history'] });
          if (spaceId) {
            queryClient.invalidateQueries({ queryKey: ['cards', 'space', spaceId] });
          }
          if (payload.new && (payload.new as any).card_id) {
            queryClient.invalidateQueries({ queryKey: ['card', (payload.new as any).card_id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, user?.id, spaceId, queryClient, toast]);
};

export const useRealtimeNotifications = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, queryClient]);
};
