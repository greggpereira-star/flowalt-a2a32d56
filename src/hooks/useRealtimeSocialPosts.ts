/**
 * Real-time hook for social posts with automatic updates
 * Provides live status updates when posts are published or fail
 */

import { useEffect, useState, useMemo, useRef } from 'react';
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

  // Stabilize status array to prevent infinite re-renders
  const statusKey = useMemo(() => {
    if (!status) return '';
    return Array.isArray(status) ? status.sort().join(',') : status;
  }, [status]);

  const statusArray = useMemo(() => {
    if (!status) return undefined;
    return Array.isArray(status) ? status : [status];
  }, [statusKey]);

  // Stable query key
  const queryKey = useMemo(
    () => ['social-posts-realtime', currentWorkspace?.id, statusKey],
    [currentWorkspace?.id, statusKey]
  );

  // Use ref to track if subscription is active
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  // Set up realtime subscription - stable dependencies
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    // Don't recreate if already subscribed
    if (subscriptionRef.current) return;

    const channelName = `social-posts-${currentWorkspace.id}-${statusKey || 'all'}`;
    console.log('[Realtime] Setting up social_posts subscription:', channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        (payload) => {
          console.log('[Realtime] Received post update:', payload.eventType);
          
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

            if (!isRelevant) return;
          }

          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['social-posts-realtime'] });
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

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        console.log('[Realtime] Cleaning up social_posts subscription');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [currentWorkspace?.id, statusKey]); // Stable dependencies only

  // Calculate stats
  const stats = useMemo(() => ({
    total: posts?.length || 0,
    draft: posts?.filter(p => p.status === 'draft').length || 0,
    scheduled: posts?.filter(p => p.status === 'scheduled').length || 0,
    published: posts?.filter(p => p.status === 'published').length || 0,
    failed: posts?.filter(p => p.status === 'failed').length || 0,
    pending: posts?.filter(p => p.status === 'pending_approval').length || 0,
  }), [posts]);

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
