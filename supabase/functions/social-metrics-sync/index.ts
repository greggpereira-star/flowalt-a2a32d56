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

interface AccountMetrics {
  followers: number;
  following: number;
  posts_count: number;
  profile_views?: number;
  website_clicks?: number;
  // Page-level insights (Facebook & Instagram)
  page_reach?: number;
  page_impressions?: number;
  page_engagements?: number;
  // New Instagram metrics
  accounts_engaged?: number;
  total_interactions?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  follows?: number;
  unfollows?: number;
}

// Fetch account-level metrics (followers, etc.)
async function fetchAccountMetrics(
  platform: string,
  accountId: string,
  accessToken: string,
  assetType?: string
): Promise<AccountMetrics | null> {
  try {
    switch (platform) {
      case 'instagram': {
        // Instagram Business Account basic metrics
        const fields = 'followers_count,media_count,username';
        const response = await fetch(
          `https://graph.facebook.com/v24.0/${accountId}?fields=${fields}&access_token=${accessToken}`
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Failed to fetch IG account metrics for ${accountId}:`, errorData.error?.message);
          return null;
        }
        
        const data = await response.json();
        console.log(`Fetched IG account metrics:`, JSON.stringify(data));
        
        // Initialize metrics
        let pageReach = 0;
        let pageImpressions = 0;
        let accountsEngaged = 0;
        let totalInteractions = 0;
        let likesCount = 0;
        let commentsCount = 0;
        let sharesCount = 0;
        let follows = 0;
        let unfollows = 0;
        
        // Calculate date range - last 28 days
        const now = Math.floor(Date.now() / 1000);
        const since = now - (28 * 86400);
        
        // NEW API FORMAT: Fetch reach and views with metric_type=total_value
        try {
          const reachUrl = `https://graph.facebook.com/v24.0/${accountId}/insights?metric=reach,views&metric_type=total_value&period=day&since=${since}&until=${now}&access_token=${accessToken}`;
          console.log(`Fetching IG reach/views insights for ${accountId}`);
          
          const reachResponse = await fetch(reachUrl);
          const reachText = await reachResponse.text();
          
          if (reachResponse.ok) {
            const reachData = JSON.parse(reachText);
            console.log(`IG reach/views response:`, JSON.stringify(reachData).substring(0, 500));
            
            for (const item of reachData.data || []) {
              if (item.name === 'reach' && item.total_value?.value) {
                pageReach = item.total_value.value;
              }
              if (item.name === 'views' && item.total_value?.value) {
                pageImpressions = item.total_value.value;
              }
            }
          } else {
            console.error(`IG reach/views error for ${accountId}:`, reachText.substring(0, 300));
          }
        } catch (e) {
          console.error('Error fetching IG reach/views:', e);
        }
        
        // Fetch engagement metrics: accounts_engaged, total_interactions, likes, comments, shares
        try {
          const engagementUrl = `https://graph.facebook.com/v24.0/${accountId}/insights?metric=accounts_engaged,total_interactions,likes,comments,shares&metric_type=total_value&period=day&since=${since}&until=${now}&access_token=${accessToken}`;
          console.log(`Fetching IG engagement insights for ${accountId}`);
          
          const engagementResponse = await fetch(engagementUrl);
          const engagementText = await engagementResponse.text();
          
          if (engagementResponse.ok) {
            const engagementData = JSON.parse(engagementText);
            console.log(`IG engagement response:`, JSON.stringify(engagementData).substring(0, 500));
            
            for (const item of engagementData.data || []) {
              const value = item.total_value?.value || 0;
              if (item.name === 'accounts_engaged') accountsEngaged = value;
              if (item.name === 'total_interactions') totalInteractions = value;
              if (item.name === 'likes') likesCount = value;
              if (item.name === 'comments') commentsCount = value;
              if (item.name === 'shares') sharesCount = value;
            }
          } else {
            console.error(`IG engagement error for ${accountId}:`, engagementText.substring(0, 300));
          }
        } catch (e) {
          console.error('Error fetching IG engagement:', e);
        }
        
        // Fetch follows and unfollows (requires 100+ followers)
        try {
          const followsUrl = `https://graph.facebook.com/v24.0/${accountId}/insights?metric=follows_and_unfollows&metric_type=total_value&breakdown=follow_type&period=day&since=${since}&until=${now}&access_token=${accessToken}`;
          
          const followsResponse = await fetch(followsUrl);
          if (followsResponse.ok) {
            const followsData = await followsResponse.json();
            console.log(`IG follows response:`, JSON.stringify(followsData).substring(0, 500));
            
            for (const item of followsData.data || []) {
              if (item.name === 'follows_and_unfollows' && item.total_value?.breakdowns) {
                for (const breakdown of item.total_value.breakdowns) {
                  for (const result of breakdown.results || []) {
                    const followType = result.dimension_values?.[0];
                    if (followType === 'FOLLOWER') follows = result.value || 0;
                    if (followType === 'NON_FOLLOWER') unfollows = result.value || 0;
                  }
                }
              }
            }
          }
        } catch (e) {
          console.log('Could not fetch IG follows (may need 100+ followers):', e);
        }
        
        const result = {
          followers: data.followers_count || 0,
          following: 0,
          posts_count: data.media_count || 0,
          page_reach: pageReach,
          page_impressions: pageImpressions,
          accounts_engaged: accountsEngaged,
          page_engagements: totalInteractions,
          likes_count: likesCount,
          comments_count: commentsCount,
          shares_count: sharesCount,
          follows,
          unfollows,
        };
        
        console.log(`Final IG metrics for ${accountId}:`, JSON.stringify(result));
        return result;
      }

      case 'facebook': {
        // Facebook Page basic metrics
        const fields = 'followers_count,fan_count';
        const response = await fetch(
          `https://graph.facebook.com/v24.0/${accountId}?fields=${fields}&access_token=${accessToken}`
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Failed to fetch FB page metrics for ${accountId}:`, errorData.error?.message);
          return null;
        }
        
        const data = await response.json();
        console.log(`Fetched FB page metrics:`, JSON.stringify(data));
        
        // Fetch Page insights - reach, impressions, engagements (last 28 days)
        let pageReach = 0;
        let pageImpressions = 0;
        let pageEngagements = 0;
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v24.0/${accountId}/insights?metric=page_impressions_unique,page_impressions,page_post_engagements&period=day&since=${Math.floor(Date.now()/1000) - 28*86400}&until=${Math.floor(Date.now()/1000)}&access_token=${accessToken}`
          );
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json();
            for (const item of insightsData.data || []) {
              const values = item.values || [];
              const sum = values.reduce((acc: number, v: { value?: number }) => acc + (v.value || 0), 0);
              if (item.name === 'page_impressions_unique') pageReach = sum;
              if (item.name === 'page_impressions') pageImpressions = sum;
              if (item.name === 'page_post_engagements') pageEngagements = sum;
            }
          }
        } catch (e) {
          console.log('Could not fetch FB page insights:', e);
        }
        
        return {
          followers: data.followers_count || data.fan_count || 0,
          following: 0,
          posts_count: 0,
          page_reach: pageReach,
          page_impressions: pageImpressions,
          page_engagements: pageEngagements,
        };
      }

      case 'youtube': {
        // YouTube Channel stats
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${accountId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!response.ok) {
          console.error(`Failed to fetch YouTube channel metrics`);
          return null;
        }
        
        const data = await response.json();
        const stats = data.items?.[0]?.statistics;
        
        return {
          followers: parseInt(stats?.subscriberCount || '0'),
          following: 0,
          posts_count: parseInt(stats?.videoCount || '0'),
          profile_views: parseInt(stats?.viewCount || '0'),
        };
      }

      default:
        return null;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching account metrics for ${platform}/${accountId}:`, errorMsg);
    return null;
  }
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

    // Parse request body for optional filters
    let assetIdFilter: string | null = null;
    let forceSync = false;
    
    try {
      const body = await req.json();
      assetIdFilter = body.asset_id || null;
      forceSync = body.force === true;
    } catch {
      // No body or invalid JSON - proceed without filter
    }

    logger.info("Starting metrics synchronization", { assetIdFilter, forceSync });

    // ==========================================
    // PART 1: Sync account-level metrics (followers, etc.)
    // Uses social_platform_assets to get the real IG/FB accounts
    // ==========================================
    let assetsQuery = supabase
      .from("social_platform_assets")
      .select(`
        id, 
        platform_connection_id, 
        asset_id, 
        asset_type, 
        asset_name,
        asset_meta,
        social_platforms!inner(
          id, workspace_id, platform, access_token_encrypted, 
          platform_account_type, account_metrics_updated_at
        )
      `)
      .eq("is_active", true)
      .in("asset_type", ["instagram_business", "facebook_page"]);
    
    // Apply asset filter if provided
    if (assetIdFilter) {
      assetsQuery = assetsQuery.eq("id", assetIdFilter);
    }
    
    const { data: activeAssets } = await assetsQuery.limit(20);

    let accountsSynced = 0;
    // Skip 4-hour check if force sync is requested
    const fourHoursAgo = forceSync ? Date.now() : (Date.now() - 4 * 60 * 60 * 1000);

    // Group assets by connection to batch updates and properly merge metrics
    const assetsByConnection = new Map<string, typeof activeAssets>();
    for (const asset of activeAssets || []) {
      const connectionId = asset.platform_connection_id;
      if (!assetsByConnection.has(connectionId)) {
        assetsByConnection.set(connectionId, []);
      }
      assetsByConnection.get(connectionId)!.push(asset);
    }

    for (const [connectionId, assets] of assetsByConnection) {
      if (!assets || assets.length === 0) continue;
      
      try {
        const firstAsset = assets[0];
        if (!firstAsset) continue;
        
        const connection = (firstAsset as unknown as Record<string, unknown>).social_platforms as Record<string, unknown> | undefined;
        if (!connection?.access_token_encrypted) continue;

        // Skip if metrics were updated less than 4 hours ago
        if (connection.account_metrics_updated_at) {
          const lastUpdate = new Date(connection.account_metrics_updated_at as string).getTime();
          if (lastUpdate > fourHoursAgo) {
            continue;
          }
        }

        const accessToken = decryptToken(connection.access_token_encrypted as string);
        
        // Fetch current metrics from database to ensure we merge correctly
        const { data: currentConnection } = await supabase
          .from("social_platforms")
          .select("account_metrics")
          .eq("id", connection.id)
          .single();
        
        // Start with existing metrics to preserve data
        const mergedMetrics: Record<string, unknown> = (currentConnection?.account_metrics as Record<string, unknown>) || {};
        
        // Process ALL assets for this connection
        for (const asset of assets || []) {
          if (!asset) continue;
          // Determine platform based on asset type
          const platform = asset.asset_type === 'instagram_business' ? 'instagram' : 'facebook';
          
          const accountMetrics = await fetchAccountMetrics(
            platform,
            asset.asset_id,
            accessToken,
            connection.platform_account_type as string
          );

          if (accountMetrics) {
            // Use asset_id as unique key to support multiple assets of same type
            // Format: asset_type:asset_id (e.g., "facebook_page:123456")
            const metricKey = `${asset.asset_type}:${asset.asset_id}`;
            mergedMetrics[metricKey] = {
              ...accountMetrics,
              asset_id: asset.asset_id,
              asset_name: asset.asset_name,
              asset_type: asset.asset_type,
            };
            
            // Also keep backward compatibility with simple asset_type key for single assets
            // This ensures existing UIs that expect "instagram_business" key still work
            if (asset.asset_type === 'instagram_business') {
              mergedMetrics[asset.asset_type] = {
                ...accountMetrics,
                asset_id: asset.asset_id,
                asset_name: asset.asset_name,
              };
            }
            
            accountsSynced++;
            logger.info(`Synced metrics for ${platform}/${asset.asset_name} (${asset.asset_id})`);
          }
        }

        // Update connection with all merged metrics
        await supabase
          .from("social_platforms")
          .update({
            account_metrics: mergedMetrics,
            account_metrics_updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
          
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        logger.error(`Error syncing connection ${connectionId}:`, { error: msg });
      }
    }

    // ==========================================
    // PART 2: Sync post-level metrics
    // ==========================================
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

    if ((!publishedPosts || publishedPosts.length === 0) && accountsSynced === 0) {
      logger.info("No posts or accounts to sync metrics for");
      return new Response(
        JSON.stringify({ posts_synced: 0, accounts_synced: accountsSynced }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info(`Found ${publishedPosts?.length || 0} posts to sync`);

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
    logger.info(`Completed: ${syncedCount} posts synced, ${accountsSynced} accounts synced, ${errorCount} errors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        posts_synced: syncedCount,
        accounts_synced: accountsSynced,
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
