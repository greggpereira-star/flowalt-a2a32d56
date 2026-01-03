import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EdgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SocialPost {
  id: string;
  workspace_id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  media_urls: any[];
  content_type: string;
  scheduled_at: string;
  retry_count: number;
  max_retries: number;
}

interface PublishResult {
  success: boolean;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  error_code?: string;
}

// Mock publisher - will be replaced with real API integrations
async function publishToplatform(post: SocialPost, credentials: any): Promise<PublishResult> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // For now, simulate successful publishing 90% of the time
  const success = Math.random() > 0.1;
  
  if (success) {
    const mockPostId = `${post.platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      platform_post_id: mockPostId,
      platform_url: `https://${post.platform}.com/p/${mockPostId}`,
    };
  } else {
    return {
      success: false,
      error_message: "Simulated API error - rate limit exceeded",
      error_code: "RATE_LIMIT",
    };
  }
}

serve(async (req) => {
  const logger = new EdgeLogger("social-scheduler");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info("Starting scheduled posts processing");

    // Find posts that are scheduled and due for publishing
    const now = new Date().toISOString();
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from("social_posts")
      .select(`
        id,
        workspace_id,
        platform,
        caption,
        hashtags,
        media_urls,
        content_type,
        scheduled_at,
        retry_count,
        max_retries
      `)
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`);
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      logger.info("No scheduled posts to process");
      return new Response(
        JSON.stringify({ processed: 0, success: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info(`Found ${scheduledPosts.length} posts to process`);

    let successCount = 0;
    let failedCount = 0;

    for (const post of scheduledPosts) {
      try {
        // Update status to publishing
        await supabase
          .from("social_posts")
          .update({ status: "publishing" })
          .eq("id", post.id);

        // Get platform credentials for this workspace
        const { data: platformCreds } = await supabase
          .from("social_platforms")
          .select("*")
          .eq("workspace_id", post.workspace_id)
          .eq("platform", post.platform)
          .eq("is_active", true)
          .single();

        if (!platformCreds) {
          // No credentials - mark as failed
          await supabase
            .from("social_posts")
            .update({
              status: "failed",
              error_message: "No active platform connection found",
              error_code: "NO_CREDENTIALS",
            })
            .eq("id", post.id);

          // Emit domain event
          await supabase.from("domain_events").insert({
            workspace_id: post.workspace_id,
            event_type: "social_post.failed",
            entity_type: "social_post",
            entity_id: post.id,
            payload: {
              reason: "no_credentials",
              platform: post.platform,
            },
          });

          failedCount++;
          continue;
        }

        // Attempt to publish
        const result = await publishToplatform(post, platformCreds);

        if (result.success) {
          // Success - update post
          await supabase
            .from("social_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              platform_post_id: result.platform_post_id,
              platform_url: result.platform_url,
              error_message: null,
              error_code: null,
            })
            .eq("id", post.id);

          // Emit success event
          await supabase.from("domain_events").insert({
            workspace_id: post.workspace_id,
            event_type: "social_post.published",
            entity_type: "social_post",
            entity_id: post.id,
            payload: {
              platform: post.platform,
              platform_post_id: result.platform_post_id,
              platform_url: result.platform_url,
            },
          });

          successCount++;
          logger.info(`Published post ${post.id} to ${post.platform}`);
        } else {
          // Failed - check retry logic
          const newRetryCount = (post.retry_count || 0) + 1;
          const maxRetries = post.max_retries || 3;

          if (newRetryCount < maxRetries) {
            // Schedule retry (exponential backoff: 5min, 15min, 45min)
            const retryDelay = Math.pow(3, newRetryCount) * 5 * 60 * 1000;
            const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

            await supabase
              .from("social_posts")
              .update({
                status: "scheduled",
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
                error_message: result.error_message,
                error_code: result.error_code,
              })
              .eq("id", post.id);

            logger.info(`Scheduled retry ${newRetryCount}/${maxRetries} for post ${post.id}`);
          } else {
            // Max retries exceeded
            await supabase
              .from("social_posts")
              .update({
                status: "failed",
                retry_count: newRetryCount,
                error_message: result.error_message,
                error_code: result.error_code,
              })
              .eq("id", post.id);

            // Emit failure event
            await supabase.from("domain_events").insert({
              workspace_id: post.workspace_id,
              event_type: "social_post.failed",
              entity_type: "social_post",
              entity_id: post.id,
              payload: {
                reason: "max_retries_exceeded",
                platform: post.platform,
                error_message: result.error_message,
                retry_count: newRetryCount,
              },
            });

            failedCount++;
            logger.error(`Post ${post.id} failed after ${newRetryCount} retries`);
          }
        }
      } catch (postError) {
        const errorMsg = postError instanceof Error ? postError.message : 'Unknown error';
        logger.error(`Error processing post ${post.id}`, { error: errorMsg });
        failedCount++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Completed: ${successCount} success, ${failedCount} failed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        processed: scheduledPosts.length,
        success: successCount,
        failed: failedCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("Scheduler error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
