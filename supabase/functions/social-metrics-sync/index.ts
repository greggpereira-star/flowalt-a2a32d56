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

// Mock metrics fetcher - will be replaced with real API integrations
async function fetchPlatformMetrics(platform: string, platformPostId: string): Promise<MetricsResponse> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Generate realistic-looking mock metrics
  const baseReach = Math.floor(Math.random() * 5000) + 500;
  const impressions = Math.floor(baseReach * (1 + Math.random() * 0.5));
  const likes = Math.floor(baseReach * (0.02 + Math.random() * 0.08));
  const comments = Math.floor(likes * (0.05 + Math.random() * 0.15));
  const shares = Math.floor(likes * (0.02 + Math.random() * 0.08));
  const saves = Math.floor(likes * (0.1 + Math.random() * 0.2));
  
  const totalEngagement = likes + comments + shares + saves;
  const engagementRate = baseReach > 0 ? (totalEngagement / baseReach) * 100 : 0;

  return {
    reach: baseReach,
    impressions,
    likes,
    comments,
    shares,
    saves,
    views: platform === 'tiktok' || platform === 'youtube' ? Math.floor(baseReach * 1.5) : undefined,
    engagement_rate: Math.round(engagementRate * 100) / 100,
    clicks: Math.floor(baseReach * 0.01),
    profile_visits: Math.floor(baseReach * 0.005),
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

        // Fetch metrics from platform
        const metrics = await fetchPlatformMetrics(post.platform, post.platform_post_id);

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

        // Emit metrics updated event
        await supabase.from("domain_events").insert({
          workspace_id: post.workspace_id,
          event_type: "social_metrics.synced",
          entity_type: "social_post",
          entity_id: post.id,
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
