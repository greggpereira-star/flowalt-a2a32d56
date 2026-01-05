/**
 * Real-time hook for social posts with automatic updates
 * Provides live status updates when posts are published or fail
 */

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { SocialPost, SocialPostStatus } from '@/hooks/useSocialPosts';

interface UseRealtimeSocialPostsOptions {
  status?: SocialPostStatus | SocialPostStatus[];
  limit?: number;
}

export function useRealtimeSocialPosts(options: UseRealtimeSocialPostsOptions = {}) {
  const { status, limit = 100 } = options;
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const statusArray = status 
    ? (Array.isArray(status) ? status : [status])
    : undefined;

  const queryKey = ['social-posts-realtime', currentWorkspace?.id, statusArray?.join(',')];

  // Initial data fetch
  const { data: posts, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (statusArray && statusArray.length > 0) {
        query = query.in('status', statusArray);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as SocialPost[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    console.log('[Realtime] Setting up social_posts subscription for workspace:', currentWorkspace.id);

    const channel = supabase
      .channel(`social-posts-${currentWorkspace.id}-${statusArray?.join('-') || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        (payload) => {
          console.log('[Realtime] Received post update:', payload.eventType, payload);
          
          const newPost = payload.new as SocialPost;
          const oldPost = payload.old as SocialPost;

          // Check if the update is relevant to our status filter
          if (statusArray && statusArray.length > 0) {
            const isRelevant = 
              payload.eventType === 'DELETE' ||
              (payload.eventType === 'INSERT' && statusArray.includes(newPost.status)) ||
              (payload.eventType === 'UPDATE' && (
                statusArray.includes(newPost.status) || 
                (oldPost && statusArray.includes(oldPost.status))
              ));

            if (!isRelevant) {
              console.log('[Realtime] Ignoring update - not relevant to status filter');
              return;
            }
          }

          // Invalidate and refetch to get full data with joins
          queryClient.invalidateQueries({ queryKey });
          
          // Also invalidate the standard social-posts queries
          queryClient.invalidateQueries({ queryKey: ['social-posts'] });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Posts subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up social_posts subscription');
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, queryClient, queryKey, statusArray]);

  // Calculate stats
  const stats = {
    total: posts?.length || 0,
    draft: posts?.filter(p => p.status === 'draft').length || 0,
    scheduled: posts?.filter(p => p.status === 'scheduled').length || 0,
    published: posts?.filter(p => p.status === 'published').length || 0,
    failed: posts?.filter(p => p.status === 'failed').length || 0,
    pending: posts?.filter(p => p.status === 'pending_approval').length || 0,
  };

  return {
    posts,
    stats,
    isLoading,
    error,
    refetch,
    realtimeStatus,
  };
}

export default useRealtimeSocialPosts;
