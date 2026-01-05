import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EdgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricsResponse {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views?: number;
  engagement_rate: number;
  clicks?: number;
  profile_visits?: number;
}

// Simple decryption for tokens
function decryptToken(encrypted: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const decoded = atob(encrypted);
  const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

// REAL metrics fetcher - fetches from actual platform APIs
async function fetchPlatformMetrics(
  platform: string, 
  platformPostId: string,
  accessToken: string,
  assetType?: string
): Promise<MetricsResponse> {
  try {
    switch (platform) {
      case 'facebook':
      case 'instagram': {
        // Try fetching post insights from Facebook/Instagram Graph API
        const fields = 'impressions,reach,engagement,likes.summary(true),comments.summary(true),shares';
        const response = await fetch(
          `https://graph.facebook.com/v24.0/${platformPostId}?fields=${fields}&access_token=${accessToken}`
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Failed to fetch metrics for ${platform}/${platformPostId}:`, errorData.error?.message || response.status);
          
          // Stories expire after 24h - this is expected
          if (errorData.error?.code === 100 || errorData.error?.message?.includes('does not exist')) {
            console.log(`Post ${platformPostId} may have expired (Stories last 24h)`);
          }
          
          return createEmptyMetrics();
        }
        
        const data = await response.json();
        console.log(`Fetched metrics for ${platform}/${platformPostId}:`, JSON.stringify(data).substring(0, 200));
        
        // For Instagram business, try to get insights
        if (assetType === 'instagram_business') {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v24.0/${platformPostId}/insights?metric=impressions,reach,engagement,saved&access_token=${accessToken}`
          );
          
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json();
            const metrics: Record<string, number> = {};
            
            for (const item of insightsData.data || []) {
              metrics[item.name] = item.values?.[0]?.value || 0;
            }
            
            return {
              reach: metrics.reach || 0,
              impressions: metrics.impressions || 0,
              likes: data.likes?.summary?.total_count || 0,
              comments: data.comments?.summary?.total_count || 0,
              shares: data.shares?.count || 0,
              saves: metrics.saved || 0,
              engagement_rate: metrics.engagement || 0,
            };
          }
        }
        
        return {
          reach: data.reach || 0,
          impressions: data.impressions || 0,
          likes: data.likes?.summary?.total_count || 0,
          comments: data.comments?.summary?.total_count || 0,
          shares: data.shares?.count || 0,
          saves: 0,
          engagement_rate: data.engagement || 0,
        };
      }

      case 'youtube': {
        // YouTube video statistics
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${platformPostId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!response.ok) {
          console.error(`Failed to fetch YouTube metrics for ${platformPostId}`);
          return createEmptyMetrics();
        }
        
        const data = await response.json();
        const stats = data.items?.[0]?.statistics;
        
        if (!stats) {
          return createEmptyMetrics();
        }
        
        const views = parseInt(stats.viewCount || '0');
        const likes = parseInt(stats.likeCount || '0');
        const comments = parseInt(stats.commentCount || '0');
        
        return {
          reach: views,
          impressions: views,
          likes,
          comments,
          shares: 0,
          saves: 0,
          views,
          engagement_rate: views > 0 ? ((likes + comments) / views) * 100 : 0,
        };
      }

      case 'twitter': {
        // Twitter/X metrics (requires elevated access)
        const response = await fetch(
          `https://api.twitter.com/2/tweets/${platformPostId}?tweet.fields=public_metrics`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!response.ok) {
          console.error(`Failed to fetch Twitter metrics for ${platformPostId}`);
          return createEmptyMetrics();
        }
        
        const data = await response.json();
        const metrics = data.data?.public_metrics;
        
        if (!metrics) {
          return createEmptyMetrics();
        }
        
        return {
          reach: metrics.impression_count || 0,
          impressions: metrics.impression_count || 0,
          likes: metrics.like_count || 0,
          comments: metrics.reply_count || 0,
          shares: metrics.retweet_count || 0,
          saves: metrics.bookmark_count || 0,
          engagement_rate: metrics.impression_count > 0 
            ? ((metrics.like_count + metrics.reply_count + metrics.retweet_count) / metrics.impression_count) * 100 
            : 0,
        };
      }

      case 'linkedin': {
        // LinkedIn UGC post stats
        const response = await fetch(
          `https://api.linkedin.com/v2/socialActions/${platformPostId}?fields=likesSummary,commentsSummary`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!response.ok) {
          console.error(`Failed to fetch LinkedIn metrics for ${platformPostId}`);
          return createEmptyMetrics();
        }
        
        const data = await response.json();
        
        return {
          reach: 0, // LinkedIn doesn't provide reach for organic posts easily
          impressions: 0,
          likes: data.likesSummary?.totalLikes || 0,
          comments: data.commentsSummary?.totalFirstLevelComments || 0,
          shares: 0,
          saves: 0,
          engagement_rate: 0,
        };
      }

      default:
        console.log(`Metrics not supported for platform: ${platform}`);
        return createEmptyMetrics();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching metrics for ${platform}/${platformPostId}:`, errorMessage);
    return createEmptyMetrics();
  }
}

function createEmptyMetrics(): MetricsResponse {
  return {
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagement_rate: 0,
  };
}

serve(async (req) => {
  const logger = new EdgeLogger("social-metrics-sync");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info("Starting metrics synchronization");

    // Find posts published in the last 7 days that have a platform_post_id
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: publishedPosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("id, workspace_id, platform, platform_post_id, metrics, metrics_updated_at")
      .eq("status", "published")
      .not("platform_post_id", "is", null)
      .gte("published_at", sevenDaysAgo)
      .order("metrics_updated_at", { ascending: true, nullsFirst: true })
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch published posts: ${fetchError.message}`);
    }

    if (!publishedPosts || publishedPosts.length === 0) {
      logger.info("No posts to sync metrics for");
      return new Response(
        JSON.stringify({ synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info(`Found ${publishedPosts.length} posts to sync`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const post of publishedPosts) {
      try {
        // Skip if metrics were updated less than 1 hour ago
        if (post.metrics_updated_at) {
          const lastUpdate = new Date(post.metrics_updated_at).getTime();
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          if (lastUpdate > oneHourAgo) {
            continue;
          }
        }

        // Get platform credentials to fetch metrics
        const { data: platformCreds } = await supabase
          .from("social_platforms")
          .select("access_token_encrypted, platform_account_type")
          .eq("workspace_id", post.workspace_id)
          .eq("platform", post.platform)
          .eq("is_active", true)
          .single();

        if (!platformCreds?.access_token_encrypted) {
          logger.info(`No credentials for ${post.platform} in workspace ${post.workspace_id}`);
          errorCount++;
          continue;
        }

        const accessToken = decryptToken(platformCreds.access_token_encrypted);

        // Fetch metrics from platform
        const metrics = await fetchPlatformMetrics(
          post.platform, 
          post.platform_post_id,
          accessToken,
          platformCreds.platform_account_type
        );

        // Calculate delta if we have previous metrics
        const previousMetrics = post.metrics || {};
        const delta = {
          reach: metrics.reach - (previousMetrics.reach || 0),
          likes: metrics.likes - (previousMetrics.likes || 0),
          comments: metrics.comments - (previousMetrics.comments || 0),
        };

        // Update post with new metrics
        await supabase
          .from("social_posts")
          .update({
            metrics: {
              ...metrics,
              previous_snapshot: previousMetrics,
              delta,
            },
            metrics_updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);

        // Emit metrics updated event (using correct column names)
        await supabase.from("domain_events").insert({
          workspace_id: post.workspace_id,
          event_type: "social_metrics.synced",
          aggregate_type: "social_post",
          aggregate_id: post.id,
          payload: {
            platform: post.platform,
            metrics,
            delta,
          },
        });

        syncedCount++;
      } catch (postError) {
        const errorMsg = postError instanceof Error ? postError.message : 'Unknown error';
        logger.error(`Error syncing metrics for post ${post.id}`, { error: errorMsg });
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Completed: ${syncedCount} synced, ${errorCount} errors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        synced: syncedCount,
        errors: errorCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("Sync error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
