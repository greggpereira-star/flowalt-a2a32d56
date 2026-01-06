import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple decryption for tokens (same as social-metrics-sync)
function decryptToken(encrypted: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const decoded = atob(encrypted);
  const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  permalink_url?: string;
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  insights?: { data?: Array<{ name: string; values?: Array<{ value?: number }> }> };
}

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body for optional filters
    let workspaceFilter: string | null = null;
    let assetFilter: string | null = null;
    try {
      const body = await req.json();
      workspaceFilter = body.workspace_id || null;
      assetFilter = body.asset_id || null;
    } catch {
      // No body, process all
    }

    console.log("Starting historical posts import", { workspaceFilter, assetFilter });

    // Fetch active assets (Instagram Business and Facebook Pages)
    let query = supabase
      .from("social_platform_assets")
      .select(`
        id, 
        platform_connection_id, 
        asset_id, 
        asset_type, 
        asset_name,
        social_platforms!inner(
          id, workspace_id, platform, access_token_encrypted
        )
      `)
      .eq("is_active", true)
      .in("asset_type", ["instagram_business", "facebook_page"]);

    if (assetFilter) {
      query = query.eq("asset_id", assetFilter);
    }

    const { data: activeAssets, error: assetsError } = await query.limit(20);

    if (assetsError) {
      throw new Error(`Failed to fetch assets: ${assetsError.message}`);
    }

    if (!activeAssets || activeAssets.length === 0) {
      console.log("No active assets found");
      return new Response(
        JSON.stringify({ posts_imported: 0, message: "No active assets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${activeAssets.length} active assets to process`);

    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const asset of activeAssets) {
      const connection = (asset as unknown as Record<string, unknown>).social_platforms as Record<string, unknown>;
      if (!connection?.access_token_encrypted) {
        console.log(`No token for asset ${asset.asset_id}`);
        continue;
      }

      // Apply workspace filter if provided
      if (workspaceFilter && connection.workspace_id !== workspaceFilter) {
        continue;
      }

      const accessToken = decryptToken(connection.access_token_encrypted as string);
      const workspaceId = connection.workspace_id as string;
      const platformConnectionId = asset.platform_connection_id;

      try {
        if (asset.asset_type === "facebook_page") {
          // ==========================================
          // FACEBOOK: Fetch page posts with metrics
          // ==========================================
          const fields = "id,message,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true),shares";
          const fbResponse = await fetch(
            `https://graph.facebook.com/v24.0/${asset.asset_id}/posts?fields=${fields}&limit=50&access_token=${accessToken}`
          );

          if (!fbResponse.ok) {
            const errorData = await fbResponse.json().catch(() => ({}));
            console.error(`Facebook API error for ${asset.asset_name}:`, errorData.error?.message || fbResponse.status);
            totalErrors++;
            continue;
          }

          const fbData = await fbResponse.json();
          const posts: FacebookPost[] = fbData.data || [];

          console.log(`Fetched ${posts.length} posts from Facebook page ${asset.asset_name}`);

          for (const post of posts) {
            // Check if already imported
            const { data: existing } = await supabase
              .from("social_posts")
              .select("id")
              .eq("platform_post_id", post.id)
              .single();

            if (existing) {
              totalSkipped++;
              continue;
            }

            // Fetch post insights (reach, impressions) if available
            let reach = 0;
            let impressions = 0;
            try {
              const insightsResponse = await fetch(
                `https://graph.facebook.com/v24.0/${post.id}/insights?metric=post_impressions_unique,post_impressions&access_token=${accessToken}`
              );
              if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json();
                for (const item of insightsData.data || []) {
                  if (item.name === "post_impressions_unique") reach = item.values?.[0]?.value || 0;
                  if (item.name === "post_impressions") impressions = item.values?.[0]?.value || 0;
                }
              }
            } catch (e) {
              console.log(`Could not fetch insights for post ${post.id}:`, e);
            }

            // Insert post
            const { error: insertError } = await supabase
              .from("social_posts")
              .insert({
                workspace_id: workspaceId,
                platform_connection_id: platformConnectionId,
                platform: "facebook",
                platform_post_id: post.id,
                content: post.message || "",
                media_urls: post.full_picture ? [post.full_picture] : [],
                content_type: post.full_picture ? "image" : "text",
                status: "published",
                published_at: post.created_time,
                metrics: {
                  likes: post.likes?.summary?.total_count || 0,
                  comments: post.comments?.summary?.total_count || 0,
                  shares: post.shares?.count || 0,
                  reach,
                  impressions,
                  saves: 0,
                  engagement_rate: 0,
                },
                metrics_updated_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error(`Error inserting FB post ${post.id}:`, insertError.message);
              totalErrors++;
            } else {
              totalImported++;
            }
          }

        } else if (asset.asset_type === "instagram_business") {
          // ==========================================
          // INSTAGRAM: Fetch media with metrics
          // ==========================================
          const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
          const igResponse = await fetch(
            `https://graph.facebook.com/v24.0/${asset.asset_id}/media?fields=${fields}&limit=50&access_token=${accessToken}`
          );

          if (!igResponse.ok) {
            const errorData = await igResponse.json().catch(() => ({}));
            console.error(`Instagram API error for ${asset.asset_name}:`, errorData.error?.message || igResponse.status);
            totalErrors++;
            continue;
          }

          const igData = await igResponse.json();
          const media: InstagramMedia[] = igData.data || [];

          console.log(`Fetched ${media.length} media from Instagram ${asset.asset_name}`);

          for (const item of media) {
            // Check if already imported
            const { data: existing } = await supabase
              .from("social_posts")
              .select("id")
              .eq("platform_post_id", item.id)
              .single();

            if (existing) {
              totalSkipped++;
              continue;
            }

            // Fetch media insights (reach, impressions, saved)
            let reach = 0;
            let impressions = 0;
            let saved = 0;
            try {
              const insightsResponse = await fetch(
                `https://graph.facebook.com/v24.0/${item.id}/insights?metric=reach,impressions,saved&access_token=${accessToken}`
              );
              if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json();
                for (const insight of insightsData.data || []) {
                  if (insight.name === "reach") reach = insight.values?.[0]?.value || 0;
                  if (insight.name === "impressions") impressions = insight.values?.[0]?.value || 0;
                  if (insight.name === "saved") saved = insight.values?.[0]?.value || 0;
                }
              }
            } catch (e) {
              console.log(`Could not fetch insights for IG media ${item.id}:`, e);
            }

            // Map media type
            let contentType = "image";
            if (item.media_type === "VIDEO") contentType = "video";
            else if (item.media_type === "CAROUSEL_ALBUM") contentType = "carousel";
            else if (item.media_type === "REELS") contentType = "reel";

            // Insert post
            const { error: insertError } = await supabase
              .from("social_posts")
              .insert({
                workspace_id: workspaceId,
                platform_connection_id: platformConnectionId,
                platform: "instagram",
                platform_post_id: item.id,
                content: item.caption || "",
                media_urls: item.media_url ? [item.media_url] : (item.thumbnail_url ? [item.thumbnail_url] : []),
                content_type: contentType,
                status: "published",
                published_at: item.timestamp,
                metrics: {
                  likes: item.like_count || 0,
                  comments: item.comments_count || 0,
                  shares: 0,
                  reach,
                  impressions,
                  saves: saved,
                  engagement_rate: 0,
                },
                metrics_updated_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error(`Error inserting IG media ${item.id}:`, insertError.message);
              totalErrors++;
            } else {
              totalImported++;
            }
          }
        }
      } catch (assetError) {
        const msg = assetError instanceof Error ? assetError.message : "Unknown error";
        console.error(`Error processing asset ${asset.asset_name}:`, msg);
        totalErrors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Import completed: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        posts_imported: totalImported,
        posts_skipped: totalSkipped,
        errors: totalErrors,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Import error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
