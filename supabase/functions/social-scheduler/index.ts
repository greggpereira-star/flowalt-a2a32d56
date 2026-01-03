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
  card_id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  media_urls: unknown[];
  content_type: string;
  scheduled_at: string;
  retry_count: number;
  max_retries: number;
  error_code: string | null;
}

interface PublishResult {
  success: boolean;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  error_code?: string;
  retryable?: boolean;
}

// Classify errors as retryable or not
function classifyError(errorCode: string): boolean {
  const nonRetryable = ['400', '401', '403', '404', 'INVALID_TOKEN', 'ACCOUNT_SUSPENDED', 'CONTENT_POLICY'];
  const retryable = ['429', '500', '502', '503', '504', 'RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR'];
  
  if (nonRetryable.includes(errorCode)) return false;
  if (retryable.includes(errorCode)) return true;
  
  return true;
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

interface PlatformCredentials {
  access_token_encrypted: string;
  platform_account_type: string;
  account_id: string;
}

// REAL publisher - publishes to actual platform APIs
async function publishToplatform(post: SocialPost, credentials: PlatformCredentials): Promise<PublishResult> {
  const accessToken = decryptToken(credentials.access_token_encrypted);
  const assetType = credentials.platform_account_type;
  const assetId = credentials.account_id;

  try {
    switch (post.platform) {
      case 'facebook':
        if (assetType === 'facebook_page') {
          // Publish to Facebook Page feed
          const fbParams = new URLSearchParams();
          fbParams.set('message', post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : ''));
          fbParams.set('access_token', accessToken);

          // If there's a link/URL in media, add it
          const linkMedia = post.media_urls?.find((m: any) => m.type === 'link');
          if (linkMedia && typeof linkMedia === 'object' && 'url' in linkMedia) {
            fbParams.set('link', (linkMedia as { url: string }).url);
          }

          const fbResponse = await fetch(
            `https://graph.facebook.com/v18.0/${assetId}/feed`,
            { method: 'POST', body: fbParams }
          );

          if (!fbResponse.ok) {
            const error = await fbResponse.json();
            return {
              success: false,
              error_code: error.error?.code?.toString() || 'FB_API_ERROR',
              error_message: error.error?.message || 'Facebook publishing failed',
              retryable: error.error?.code === 190 ? false : true,
            };
          }

          const fbResult = await fbResponse.json();
          return {
            success: true,
            platform_post_id: fbResult.id,
            platform_url: `https://facebook.com/${fbResult.id}`,
          };
        }
        break;

      case 'instagram':
        if (assetType === 'instagram_business') {
          // Instagram requires a two-step process for images
          // Step 1: Create media container
          const imageMedia = post.media_urls?.find((m: any) => m.type === 'image' || typeof m === 'string');
          const imageUrl = typeof imageMedia === 'string' ? imageMedia : (imageMedia as any)?.url;

          if (!imageUrl) {
            return {
              success: false,
              error_code: 'NO_IMAGE',
              error_message: 'Instagram posts require an image',
              retryable: false,
            };
          }

          const containerParams = new URLSearchParams();
          containerParams.set('image_url', imageUrl);
          containerParams.set('caption', post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : ''));
          containerParams.set('access_token', accessToken);

          const containerResponse = await fetch(
            `https://graph.facebook.com/v18.0/${assetId}/media`,
            { method: 'POST', body: containerParams }
          );

          if (!containerResponse.ok) {
            const error = await containerResponse.json();
            return {
              success: false,
              error_code: error.error?.code?.toString() || 'IG_CONTAINER_ERROR',
              error_message: error.error?.message || 'Failed to create Instagram media container',
              retryable: true,
            };
          }

          const containerResult = await containerResponse.json();
          const creationId = containerResult.id;

          // Wait for container to be ready (poll status)
          await new Promise(resolve => setTimeout(resolve, 5000));

          // Step 2: Publish the container
          const publishParams = new URLSearchParams();
          publishParams.set('creation_id', creationId);
          publishParams.set('access_token', accessToken);

          const publishResponse = await fetch(
            `https://graph.facebook.com/v18.0/${assetId}/media_publish`,
            { method: 'POST', body: publishParams }
          );

          if (!publishResponse.ok) {
            const error = await publishResponse.json();
            return {
              success: false,
              error_code: error.error?.code?.toString() || 'IG_PUBLISH_ERROR',
              error_message: error.error?.message || 'Failed to publish Instagram media',
              retryable: true,
            };
          }

          const publishResult = await publishResponse.json();
          return {
            success: true,
            platform_post_id: publishResult.id,
            platform_url: `https://instagram.com/p/${publishResult.id}`,
          };
        }
        break;

      case 'youtube':
        // YouTube publishing requires video upload which is complex
        // Return informative error for now
        return {
          success: false,
          error_code: 'NOT_IMPLEMENTED',
          error_message: 'YouTube video publishing requires additional implementation',
          retryable: false,
        };

      case 'linkedin':
        // LinkedIn UGC Post (text-only for now)
        const linkedInPayload = {
          author: `urn:li:person:${assetId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : ''),
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        };

        const linkedInResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(linkedInPayload),
        });

        if (!linkedInResponse.ok) {
          const error = await linkedInResponse.json();
          return {
            success: false,
            error_code: 'LINKEDIN_ERROR',
            error_message: error.message || 'LinkedIn publishing failed',
            retryable: linkedInResponse.status >= 500,
          };
        }

        const linkedInResult = await linkedInResponse.json();
        return {
          success: true,
          platform_post_id: linkedInResult.id,
          platform_url: `https://linkedin.com/feed/update/${linkedInResult.id}`,
        };

      case 'tiktok':
        return {
          success: false,
          error_code: 'NOT_IMPLEMENTED',
          error_message: 'TikTok video publishing requires additional implementation',
          retryable: false,
        };

      case 'twitter':
        const twitterPayload = {
          text: post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : ''),
        };

        const twitterResponse = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(twitterPayload),
        });

        if (!twitterResponse.ok) {
          const error = await twitterResponse.json();
          return {
            success: false,
            error_code: 'TWITTER_ERROR',
            error_message: error.detail || error.title || 'Twitter publishing failed',
            retryable: twitterResponse.status >= 500 || twitterResponse.status === 429,
          };
        }

        const twitterResult = await twitterResponse.json();
        return {
          success: true,
          platform_post_id: twitterResult.data?.id,
          platform_url: `https://twitter.com/i/web/status/${twitterResult.data?.id}`,
        };

      default:
        return {
          success: false,
          error_code: 'UNSUPPORTED_PLATFORM',
          error_message: `Platform ${post.platform} is not yet supported for publishing`,
          retryable: false,
        };
    }

    return {
      success: false,
      error_code: 'INVALID_ASSET_TYPE',
      error_message: `Asset type ${assetType} not supported for ${post.platform}`,
      retryable: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error_code: 'NETWORK_ERROR',
      error_message: errorMessage,
      retryable: true,
    };
  }
}

serve(async (req) => {
  const logger = new EdgeLogger("social-scheduler");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const jobId = crypto.randomUUID();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info(`Starting scheduled posts processing - Job ${jobId}`);

    // Find posts that are scheduled and due for publishing
    // Using FOR UPDATE SKIP LOCKED pattern via a database function would be ideal
    // For now, we use optimistic locking with processing_started_at
    const now = new Date().toISOString();
    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min timeout
    
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from("social_posts")
      .select(`
        id,
        workspace_id,
        card_id,
        platform,
        caption,
        hashtags,
        media_urls,
        content_type,
        scheduled_at,
        retry_count,
        max_retries,
        error_code
      `)
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .or(`processing_started_at.is.null,processing_started_at.lt.${lockTimeout}`)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`);
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      logger.info("No scheduled posts to process");
      return new Response(
        JSON.stringify({ processed: 0, success: 0, failed: 0, job_id: jobId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info(`Found ${scheduledPosts.length} posts to process`);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const post of scheduledPosts as SocialPost[]) {
      const postStartTime = Date.now();
      
      try {
        // Try to acquire lock by setting processing_started_at
        const { data: lockData, error: lockError } = await supabase
          .from("social_posts")
          .update({ 
            processing_started_at: new Date().toISOString(),
            job_id: jobId 
          })
          .eq("id", post.id)
          .eq("status", "scheduled")
          .or(`processing_started_at.is.null,processing_started_at.lt.${lockTimeout}`)
          .select("id")
          .single();

        if (lockError || !lockData) {
          logger.info(`Skipping post ${post.id} - already being processed`);
          skippedCount++;
          continue;
        }

        // Update status to publishing
        await supabase
          .from("social_posts")
          .update({ status: "publishing" })
          .eq("id", post.id);

        // Create job record
        const { data: jobRecord } = await supabase
          .from("social_jobs")
          .insert({
            workspace_id: post.workspace_id,
            post_id: post.id,
            action: "publish",
            status: "processing",
            started_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        // Get platform credentials for this workspace
        const { data: platformCreds } = await supabase
          .from("social_platforms")
          .select("*")
          .eq("workspace_id", post.workspace_id)
          .eq("platform", post.platform)
          .eq("is_active", true)
          .single();

        if (!platformCreds) {
          const errorResult = {
            status: "error",
            error_message: "Nenhuma conexão ativa encontrada para esta plataforma",
            error_code: "NO_CREDENTIALS",
            last_error_code: "NO_CREDENTIALS",
            last_error_message: "No active platform connection found",
            processing_completed_at: new Date().toISOString(),
          };

          await supabase
            .from("social_posts")
            .update(errorResult)
            .eq("id", post.id);

          // Update job record
          if (jobRecord?.id) {
            await supabase
              .from("social_jobs")
              .update({
                status: "failed",
                error_code: "NO_CREDENTIALS",
                error_message: "No active platform connection",
                latency_ms: Date.now() - postStartTime,
                completed_at: new Date().toISOString(),
              })
              .eq("id", jobRecord.id);
          }

          // Emit domain event
          await supabase.from("domain_events").insert({
            workspace_id: post.workspace_id,
            event_type: "social_post.failed",
            entity_type: "social_post",
            entity_id: post.id,
            payload: {
              reason: "no_credentials",
              platform: post.platform,
              card_id: post.card_id,
              job_id: jobId,
            },
          });

          failedCount++;
          continue;
        }

        // Attempt to publish
        const result = await publishToplatform(post, platformCreds as unknown as PlatformCredentials);

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
              last_error_code: null,
              last_error_message: null,
              processing_completed_at: new Date().toISOString(),
            })
            .eq("id", post.id);

          // Update job record
          if (jobRecord?.id) {
            await supabase
              .from("social_jobs")
              .update({
                status: "completed",
                result: { platform_post_id: result.platform_post_id, platform_url: result.platform_url },
                latency_ms: Date.now() - postStartTime,
                completed_at: new Date().toISOString(),
              })
              .eq("id", jobRecord.id);
          }

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
              card_id: post.card_id,
              job_id: jobId,
              latency_ms: Date.now() - postStartTime,
            },
          });

          successCount++;
          logger.info(`Published post ${post.id} to ${post.platform}`);
        } else {
          // Failed - check if retryable
          const isRetryable = result.retryable !== false && classifyError(result.error_code || 'UNKNOWN');
          const newRetryCount = (post.retry_count || 0) + 1;
          const maxRetries = post.max_retries || 5;

          if (isRetryable && newRetryCount < maxRetries) {
            // Schedule retry with exponential backoff (5min, 15min, 45min, 2h15m, 6h45m)
            // Capped at 6 hours
            const retryDelay = Math.min(Math.pow(3, newRetryCount) * 5 * 60 * 1000, 6 * 60 * 60 * 1000);
            const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

            await supabase
              .from("social_posts")
              .update({
                status: "scheduled",
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
                error_message: result.error_message,
                error_code: result.error_code,
                last_error_code: result.error_code,
                last_error_message: result.error_message,
                processing_started_at: null,
                processing_completed_at: null,
              })
              .eq("id", post.id);

            // Update job record
            if (jobRecord?.id) {
              await supabase
                .from("social_jobs")
                .update({
                  status: "failed",
                  error_code: result.error_code,
                  error_message: result.error_message,
                  result: { retry_scheduled: true, next_retry_at: nextRetryAt, attempt: newRetryCount },
                  latency_ms: Date.now() - postStartTime,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", jobRecord.id);
            }

            logger.info(`Scheduled retry ${newRetryCount}/${maxRetries} for post ${post.id}`);
          } else {
            // Max retries exceeded or non-retryable error
            await supabase
              .from("social_posts")
              .update({
                status: "failed",
                retry_count: newRetryCount,
                error_message: result.error_message,
                error_code: result.error_code,
                last_error_code: result.error_code,
                last_error_message: result.error_message,
                processing_completed_at: new Date().toISOString(),
              })
              .eq("id", post.id);

            // Update job record
            if (jobRecord?.id) {
              await supabase
                .from("social_jobs")
                .update({
                  status: "failed",
                  error_code: result.error_code,
                  error_message: result.error_message,
                  result: { 
                    retry_scheduled: false, 
                    reason: isRetryable ? 'max_retries_exceeded' : 'non_retryable_error',
                    attempts: newRetryCount 
                  },
                  latency_ms: Date.now() - postStartTime,
                  completed_at: new Date().toISOString(),
                })
                .eq("id", jobRecord.id);
            }

            // Emit failure event
            await supabase.from("domain_events").insert({
              workspace_id: post.workspace_id,
              event_type: "social_post.failed",
              entity_type: "social_post",
              entity_id: post.id,
              payload: {
                reason: isRetryable ? "max_retries_exceeded" : "non_retryable_error",
                platform: post.platform,
                error_code: result.error_code,
                error_message: result.error_message,
                retry_count: newRetryCount,
                card_id: post.card_id,
                job_id: jobId,
              },
            });

            failedCount++;
            logger.error(`Post ${post.id} failed after ${newRetryCount} attempts: ${result.error_message}`);
          }
        }
      } catch (postError) {
        const errorMsg = postError instanceof Error ? postError.message : 'Unknown error';
        logger.error(`Error processing post ${post.id}`, { error: errorMsg });
        
        // Reset processing state so it can be retried
        await supabase
          .from("social_posts")
          .update({
            status: "scheduled",
            processing_started_at: null,
            last_error_message: errorMsg,
          })
          .eq("id", post.id);
        
        failedCount++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Job ${jobId} completed: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped in ${duration}ms`);

    return new Response(
      JSON.stringify({
        job_id: jobId,
        processed: scheduledPosts.length - skippedCount,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Scheduler job ${jobId} error`, { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage, job_id: jobId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
