import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useMemo } from 'react';
import type { SocialPost, SocialPlatform, SocialContentType } from './useSocialPosts';

export interface SocialMetricsSummary {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  failedPosts: number;
  totalReach: number;
  totalImpressions: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews: number;
  avgEngagementRate: number;
}

export interface PlatformMetrics {
  platform: SocialPlatform;
  posts: number;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagementRate: number;
}

export interface ContentTypeMetrics {
  contentType: SocialContentType;
  posts: number;
  avgReach: number;
  avgEngagement: number;
  bestPerformingPost: SocialPost | null;
}

export interface TimeSlotMetrics {
  hour: number;
  dayOfWeek: number;
  avgEngagement: number;
  postCount: number;
}

export const useSocialMetrics = (filters?: {
  clientId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const { currentWorkspace } = useWorkspace();

  const { data: posts, isLoading } = useQuery({
    queryKey: ['social-metrics-posts', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'published');

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.startDate) {
        query = query.gte('published_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('published_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SocialPost[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const summary = useMemo<SocialMetricsSummary>(() => {
    if (!posts || posts.length === 0) {
      return {
        totalPosts: 0,
        publishedPosts: 0,
        scheduledPosts: 0,
        failedPosts: 0,
        totalReach: 0,
        totalImpressions: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0,
        avgEngagementRate: 0,
      };
    }

    let totalReach = 0;
    let totalImpressions = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalViews = 0;
    let totalEngagementRate = 0;
    let engagementCount = 0;

    posts.forEach(post => {
      const metrics = post.metrics || {};
      totalReach += metrics.reach || 0;
      totalImpressions += metrics.impressions || 0;
      totalLikes += metrics.likes || 0;
      totalComments += metrics.comments || 0;
      totalShares += metrics.shares || 0;
      totalViews += metrics.views || 0;
      
      if (metrics.engagement_rate) {
        totalEngagementRate += metrics.engagement_rate;
        engagementCount++;
      }
    });

    return {
      totalPosts: posts.length,
      publishedPosts: posts.filter(p => p.status === 'published').length,
      scheduledPosts: posts.filter(p => p.status === 'scheduled').length,
      failedPosts: posts.filter(p => p.status === 'failed').length,
      totalReach,
      totalImpressions,
      totalLikes,
      totalComments,
      totalShares,
      totalViews,
      avgEngagementRate: engagementCount > 0 ? totalEngagementRate / engagementCount : 0,
    };
  }, [posts]);

  const platformMetrics = useMemo<PlatformMetrics[]>(() => {
    if (!posts || posts.length === 0) return [];

    const byPlatform = new Map<SocialPlatform, SocialPost[]>();
    
    posts.forEach(post => {
      const existing = byPlatform.get(post.platform) || [];
      byPlatform.set(post.platform, [...existing, post]);
    });

    return Array.from(byPlatform.entries()).map(([platform, platformPosts]) => {
      let reach = 0;
      let impressions = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;
      let views = 0;
      let engagementSum = 0;
      let engagementCount = 0;

      platformPosts.forEach(post => {
        const metrics = post.metrics || {};
        reach += metrics.reach || 0;
        impressions += metrics.impressions || 0;
        likes += metrics.likes || 0;
        comments += metrics.comments || 0;
        shares += metrics.shares || 0;
        views += metrics.views || 0;
        
        if (metrics.engagement_rate) {
          engagementSum += metrics.engagement_rate;
          engagementCount++;
        }
      });

      return {
        platform,
        posts: platformPosts.length,
        reach,
        impressions,
        likes,
        comments,
        shares,
        views,
        engagementRate: engagementCount > 0 ? engagementSum / engagementCount : 0,
      };
    });
  }, [posts]);

  const contentTypeMetrics = useMemo<ContentTypeMetrics[]>(() => {
    if (!posts || posts.length === 0) return [];

    const byContentType = new Map<SocialContentType, SocialPost[]>();
    
    posts.forEach(post => {
      const existing = byContentType.get(post.content_type) || [];
      byContentType.set(post.content_type, [...existing, post]);
    });

    return Array.from(byContentType.entries()).map(([contentType, typePosts]) => {
      let totalReach = 0;
      let totalEngagement = 0;
      let bestPost: SocialPost | null = null;
      let bestEngagement = 0;

      typePosts.forEach(post => {
        const metrics = post.metrics || {};
        totalReach += metrics.reach || 0;
        const engagement = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0);
        totalEngagement += engagement;
        
        if (engagement > bestEngagement) {
          bestEngagement = engagement;
          bestPost = post;
        }
      });

      return {
        contentType,
        posts: typePosts.length,
        avgReach: totalReach / typePosts.length,
        avgEngagement: totalEngagement / typePosts.length,
        bestPerformingPost: bestPost,
      };
    });
  }, [posts]);

  const bestTimeSlots = useMemo<TimeSlotMetrics[]>(() => {
    if (!posts || posts.length === 0) return [];

    const timeSlots = new Map<string, { engagement: number; count: number }>();

    posts.forEach(post => {
      if (!post.published_at) return;
      
      const date = new Date(post.published_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${dayOfWeek}-${hour}`;

      const metrics = post.metrics || {};
      const engagement = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0);

      const existing = timeSlots.get(key) || { engagement: 0, count: 0 };
      timeSlots.set(key, {
        engagement: existing.engagement + engagement,
        count: existing.count + 1,
      });
    });

    return Array.from(timeSlots.entries())
      .map(([key, data]) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return {
          hour,
          dayOfWeek,
          avgEngagement: data.engagement / data.count,
          postCount: data.count,
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
  }, [posts]);

  return {
    posts,
    isLoading,
    summary,
    platformMetrics,
    contentTypeMetrics,
    bestTimeSlots,
  };
};

export const useTopPosts = (limit: number = 5, filters?: { clientId?: string; startDate?: string; endDate?: string }) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['social-top-posts', currentWorkspace?.id, limit, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'published')
        .not('metrics', 'is', null);

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.startDate) {
        query = query.gte('published_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('published_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Sort by total engagement
      const sorted = (data as SocialPost[]).sort((a, b) => {
        const engagementA = (a.metrics?.likes || 0) + (a.metrics?.comments || 0) + (a.metrics?.shares || 0);
        const engagementB = (b.metrics?.likes || 0) + (b.metrics?.comments || 0) + (b.metrics?.shares || 0);
        return engagementB - engagementA;
      });

      return sorted.slice(0, limit);
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const formatMetricNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
