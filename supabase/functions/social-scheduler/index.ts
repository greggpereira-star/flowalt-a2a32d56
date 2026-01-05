import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EdgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Graph API version - MUST match Meta App configuration
const GRAPH_VERSION = '24.0';

interface SocialPost {
  id: string;
  workspace_id: string;
  card_id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  media_urls: unknown[];
  content_type: string; // feed, story, reels, carousel, video
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

interface PlatformCredentials {
  access_token_encrypted: string;
  page_access_token_encrypted?: string;
  asset_token_encrypted?: string;  // Page token saved during asset selection - preferred for publishing
  platform_account_type: string;
  account_id: string;
  linked_page_id?: string;
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

// Helper to get media URL from various formats
function getMediaUrl(media: unknown, type: 'image' | 'video'): string | null {
  if (typeof media === 'string') return media;
  if (media && typeof media === 'object') {
    const m = media as Record<string, unknown>;
    if (m.type === type || !m.type) {
      return (m.url as string) || null;
    }
  }
  return null;
}

// Poll for container status (IG requires this)
async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  maxAttempts = 10,
  delayMs = 3000
): Promise<{ ready: boolean; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    
    if (!response.ok) {
      return { ready: false, error: 'Failed to check container status' };
    }
    
    const data = await response.json();
    
    if (data.status_code === 'FINISHED') {
      return { ready: true };
    } else if (data.status_code === 'ERROR') {
      return { ready: false, error: data.status || 'Container processing failed' };
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return { ready: false, error: 'Container processing timeout' };
}

// ============================================
// FACEBOOK PUBLISHING FUNCTIONS
// ============================================

async function publishFacebookFeed(
  pageId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const params = new URLSearchParams();
  const caption = post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');
  params.set('message', caption);
  params.set('access_token', accessToken);

  // Check for photo
  const imageMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'image'));
  const imageUrl = imageMedia ? getMediaUrl(imageMedia, 'image') : null;

  // Check for link
  const linkMedia = post.media_urls?.find((m: unknown) => {
    if (m && typeof m === 'object' && 'type' in m) {
      return (m as Record<string, unknown>).type === 'link';
    }
    return false;
  });

  if (imageUrl) {
    // Photo post
    params.set('url', imageUrl);
    const response = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/photos`,
      { method: 'POST', body: params }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error_code: error.error?.code?.toString() || 'FB_PHOTO_ERROR',
        error_message: error.error?.message || 'Failed to publish photo',
        retryable: error.error?.code !== 190,
      };
    }

    const result = await response.json();
    return {
      success: true,
      platform_post_id: result.post_id || result.id,
      platform_url: `https://facebook.com/${result.post_id || result.id}`,
    };
  }

  // Text/link post
  if (linkMedia && typeof linkMedia === 'object' && 'url' in linkMedia) {
    params.set('link', (linkMedia as { url: string }).url);
  }

  const response = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/feed`,
    { method: 'POST', body: params }
  );

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'FB_FEED_ERROR',
      error_message: error.error?.message || 'Failed to publish to feed',
      retryable: error.error?.code !== 190,
    };
  }

  const result = await response.json();
  return {
    success: true,
    platform_post_id: result.id,
    platform_url: `https://facebook.com/${result.id}`,
  };
}

async function publishFacebookCarousel(
  pageId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const imageUrls = post.media_urls
    ?.map((m: unknown) => getMediaUrl(m, 'image'))
    .filter((url): url is string => !!url);

  if (!imageUrls || imageUrls.length < 2) {
    return {
      success: false,
      error_code: 'CAROUSEL_MIN_IMAGES',
      error_message: 'Carousel requires at least 2 images',
      retryable: false,
    };
  }

  // Step 1: Upload each photo with published=false
  const photoIds: string[] = [];
  
  for (const imageUrl of imageUrls) {
    const params = new URLSearchParams();
    params.set('url', imageUrl);
    params.set('published', 'false');
    params.set('access_token', accessToken);

    const response = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/photos`,
      { method: 'POST', body: params }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error_code: 'FB_CAROUSEL_UPLOAD_ERROR',
        error_message: error.error?.message || 'Failed to upload carousel image',
        retryable: true,
      };
    }

    const result = await response.json();
    photoIds.push(result.id);
  }

  // Step 2: Create carousel post with attached_media
  const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
  const caption = post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');

  const response = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: caption,
        attached_media: attachedMedia,
        access_token: accessToken,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      error_code: 'FB_CAROUSEL_POST_ERROR',
      error_message: error.error?.message || 'Failed to create carousel post',
      retryable: true,
    };
  }

  const result = await response.json();
  return {
    success: true,
    platform_post_id: result.id,
    platform_url: `https://facebook.com/${result.id}`,
  };
}

async function publishFacebookReel(
  pageId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const videoMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'video'));
  const videoUrl = videoMedia ? getMediaUrl(videoMedia, 'video') : null;

  if (!videoUrl) {
    return {
      success: false,
      error_code: 'NO_VIDEO',
      error_message: 'Facebook Reels require a video',
      retryable: false,
    };
  }

  const caption = post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');

  // Step 1: Start upload session
  const startResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'start',
        access_token: accessToken,
      }),
    }
  );

  if (!startResponse.ok) {
    const error = await startResponse.json();
    return {
      success: false,
      error_code: 'FB_REEL_START_ERROR',
      error_message: error.error?.message || 'Failed to start Reel upload',
      retryable: true,
    };
  }

  const startResult = await startResponse.json();
  const videoId = startResult.video_id;

  // Step 2: Upload video via URL (simplified - for URL-based uploads)
  // For resumable uploads, you'd use rupload.facebook.com with binary data
  const uploadResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${videoId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: videoUrl,
        access_token: accessToken,
      }),
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    return {
      success: false,
      error_code: 'FB_REEL_UPLOAD_ERROR',
      error_message: error.error?.message || 'Failed to upload Reel video',
      retryable: true,
    };
  }

  // Step 3: Finish and publish
  const finishResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: caption,
        access_token: accessToken,
      }),
    }
  );

  if (!finishResponse.ok) {
    const error = await finishResponse.json();
    return {
      success: false,
      error_code: 'FB_REEL_FINISH_ERROR',
      error_message: error.error?.message || 'Failed to publish Reel',
      retryable: true,
    };
  }

  const finishResult = await finishResponse.json();
  return {
    success: true,
    platform_post_id: finishResult.video_id || videoId,
    platform_url: `https://facebook.com/reel/${finishResult.video_id || videoId}`,
  };
}

async function publishFacebookStory(
  pageId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const imageMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'image'));
  const videoMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'video'));
  
  const imageUrl = imageMedia ? getMediaUrl(imageMedia, 'image') : null;
  const videoUrl = videoMedia ? getMediaUrl(videoMedia, 'video') : null;

  if (videoUrl) {
    // Video Story
    const startResponse = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/video_stories`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_phase: 'start',
          access_token: accessToken,
        }),
      }
    );

    if (!startResponse.ok) {
      const error = await startResponse.json();
      return {
        success: false,
        error_code: 'FB_STORY_VIDEO_START_ERROR',
        error_message: error.error?.message || 'Failed to start Story video upload',
        retryable: true,
      };
    }

    const startResult = await startResponse.json();
    const videoId = startResult.video_id;

    // Upload video
    const uploadResponse = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${videoId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: videoUrl,
          access_token: accessToken,
        }),
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      return {
        success: false,
        error_code: 'FB_STORY_VIDEO_UPLOAD_ERROR',
        error_message: error.error?.message || 'Failed to upload Story video',
        retryable: true,
      };
    }

    // Finish
    const finishResponse = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/video_stories`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_phase: 'finish',
          video_id: videoId,
          access_token: accessToken,
        }),
      }
    );

    if (!finishResponse.ok) {
      const error = await finishResponse.json();
      return {
        success: false,
        error_code: 'FB_STORY_VIDEO_FINISH_ERROR',
        error_message: error.error?.message || 'Failed to publish Story video',
        retryable: true,
      };
    }

    const result = await finishResponse.json();
    return {
      success: true,
      platform_post_id: result.post_id || videoId,
      platform_url: `https://facebook.com/stories/${pageId}`,
    };
  }

  if (imageUrl) {
    // Photo Story - upload photo first
    const photoParams = new URLSearchParams();
    photoParams.set('url', imageUrl);
    photoParams.set('published', 'false');
    photoParams.set('access_token', accessToken);

    const photoResponse = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/photos`,
      { method: 'POST', body: photoParams }
    );

    if (!photoResponse.ok) {
      const error = await photoResponse.json();
      return {
        success: false,
        error_code: 'FB_STORY_PHOTO_UPLOAD_ERROR',
        error_message: error.error?.message || 'Failed to upload Story photo',
        retryable: true,
      };
    }

    const photoResult = await photoResponse.json();
    const photoId = photoResult.id;

    // Publish as story
    const storyResponse = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}/photo_stories`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_id: photoId,
          access_token: accessToken,
        }),
      }
    );

    if (!storyResponse.ok) {
      const error = await storyResponse.json();
      return {
        success: false,
        error_code: 'FB_STORY_PHOTO_PUBLISH_ERROR',
        error_message: error.error?.message || 'Failed to publish Story photo',
        retryable: true,
      };
    }

    const result = await storyResponse.json();
    return {
      success: true,
      platform_post_id: result.post_id || photoId,
      platform_url: `https://facebook.com/stories/${pageId}`,
    };
  }

  return {
    success: false,
    error_code: 'NO_MEDIA',
    error_message: 'Facebook Stories require an image or video',
    retryable: false,
  };
}

// ============================================
// INSTAGRAM PUBLISHING FUNCTIONS
// ============================================

async function publishInstagramFeed(
  igUserId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const imageMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'image'));
  const videoMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'video'));
  
  const imageUrl = imageMedia ? getMediaUrl(imageMedia, 'image') : null;
  const videoUrl = videoMedia ? getMediaUrl(videoMedia, 'video') : null;
  const caption = post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');

  const containerParams = new URLSearchParams();
  containerParams.set('caption', caption);
  containerParams.set('access_token', accessToken);

  if (videoUrl) {
    containerParams.set('video_url', videoUrl);
    containerParams.set('media_type', 'VIDEO');
  } else if (imageUrl) {
    containerParams.set('image_url', imageUrl);
  } else {
    return {
      success: false,
      error_code: 'NO_MEDIA',
      error_message: 'Instagram feed posts require an image or video',
      retryable: false,
    };
  }

  // Step 1: Create container
  const containerResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media`,
    { method: 'POST', body: containerParams }
  );

  if (!containerResponse.ok) {
    const error = await containerResponse.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'IG_CONTAINER_ERROR',
      error_message: error.error?.message || 'Failed to create media container',
      retryable: true,
    };
  }

  const containerResult = await containerResponse.json();
  const creationId = containerResult.id;

  // Step 2: Poll for container ready
  const pollResult = await pollContainerStatus(creationId, accessToken);
  if (!pollResult.ready) {
    return {
      success: false,
      error_code: 'IG_CONTAINER_PROCESSING',
      error_message: pollResult.error || 'Container processing failed',
      retryable: true,
    };
  }

  // Step 3: Publish
  const publishParams = new URLSearchParams();
  publishParams.set('creation_id', creationId);
  publishParams.set('access_token', accessToken);

  const publishResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media_publish`,
    { method: 'POST', body: publishParams }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'IG_PUBLISH_ERROR',
      error_message: error.error?.message || 'Failed to publish',
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

async function publishInstagramReel(
  igUserId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const videoMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'video'));
  const videoUrl = videoMedia ? getMediaUrl(videoMedia, 'video') : null;

  if (!videoUrl) {
    return {
      success: false,
      error_code: 'NO_VIDEO',
      error_message: 'Instagram Reels require a video',
      retryable: false,
    };
  }

  const caption = post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');

  // Get cover image if available
  const coverMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'image'));
  const coverUrl = coverMedia ? getMediaUrl(coverMedia, 'image') : null;

  // Create Reel container
  const containerBody: Record<string, string> = {
    video_url: videoUrl,
    caption: caption,
    media_type: 'REELS',
    access_token: accessToken,
  };

  if (coverUrl) {
    containerBody.cover_url = coverUrl;
  }

  const containerResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    }
  );

  if (!containerResponse.ok) {
    const error = await containerResponse.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'IG_REEL_CONTAINER_ERROR',
      error_message: error.error?.message || 'Failed to create Reel container',
      retryable: true,
    };
  }

  const containerResult = await containerResponse.json();
  const creationId = containerResult.id;

  // Poll for processing (Reels take longer)
  const pollResult = await pollContainerStatus(creationId, accessToken, 20, 5000);
  if (!pollResult.ready) {
    return {
      success: false,
      error_code: 'IG_REEL_PROCESSING',
      error_message: pollResult.error || 'Reel processing failed',
      retryable: true,
    };
  }

  // Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'IG_REEL_PUBLISH_ERROR',
      error_message: error.error?.message || 'Failed to publish Reel',
      retryable: true,
    };
  }

  const publishResult = await publishResponse.json();
  return {
    success: true,
    platform_post_id: publishResult.id,
    platform_url: `https://instagram.com/reel/${publishResult.id}`,
  };
}

async function publishInstagramStory(
  igUserId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const imageMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'image'));
  const videoMedia = post.media_urls?.find((m: unknown) => getMediaUrl(m, 'video'));
  
  const imageUrl = imageMedia ? getMediaUrl(imageMedia, 'image') : null;
  const videoUrl = videoMedia ? getMediaUrl(videoMedia, 'video') : null;

  const containerBody: Record<string, string> = {
    media_type: 'STORIES',
    access_token: accessToken,
  };

  if (videoUrl) {
    containerBody.video_url = videoUrl;
  } else if (imageUrl) {
    containerBody.image_url = imageUrl;
  } else {
    return {
      success: false,
      error_code: 'NO_MEDIA',
      error_message: 'Instagram Stories require an image or video',
      retryable: false,
    };
  }

  // Create Story container
  const containerResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    }
  );

  if (!containerResponse.ok) {
    const error = await containerResponse.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'IG_STORY_CONTAINER_ERROR',
      error_message: error.error?.message || 'Failed to create Story container',
      retryable: true,
    };
  }

  const containerResult = await containerResponse.json();
  const creationId = containerResult.id;

  // Poll for processing
  const pollResult = await pollContainerStatus(creationId, accessToken);
  if (!pollResult.ready) {
    return {
      success: false,
      error_code: 'IG_STORY_PROCESSING',
      error_message: pollResult.error || 'Story processing failed',
      retryable: true,
    };
  }

  // Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    return {
      success: false,
      error_code: error.error?.code?.toString() || 'IG_STORY_PUBLISH_ERROR',
      error_message: error.error?.message || 'Failed to publish Story',
      retryable: true,
    };
  }

  const publishResult = await publishResponse.json();
  return {
    success: true,
    platform_post_id: publishResult.id,
    platform_url: `https://instagram.com/stories/${igUserId}`,
  };
}

async function publishInstagramCarousel(
  igUserId: string,
  accessToken: string,
  post: SocialPost
): Promise<PublishResult> {
  const mediaItems = post.media_urls || [];
  
  if (mediaItems.length < 2) {
    return {
      success: false,
      error_code: 'CAROUSEL_MIN_ITEMS',
      error_message: 'Instagram Carousel requires at least 2 media items',
      retryable: false,
    };
  }

  if (mediaItems.length > 10) {
    return {
      success: false,
      error_code: 'CAROUSEL_MAX_ITEMS',
      error_message: 'Instagram Carousel supports maximum 10 media items',
      retryable: false,
    };
  }

  const caption = post.caption + (post.hashtags?.length ? '\n\n' + post.hashtags.join(' ') : '');
  const childrenIds: string[] = [];

  // Step 1: Create child containers
  for (const media of mediaItems) {
    const imageUrl = getMediaUrl(media, 'image');
    const videoUrl = getMediaUrl(media, 'video');

    const childBody: Record<string, string> = {
      is_carousel_item: 'true',
      access_token: accessToken,
    };

    if (videoUrl) {
      childBody.video_url = videoUrl;
      childBody.media_type = 'VIDEO';
    } else if (imageUrl) {
      childBody.image_url = imageUrl;
    } else {
      continue; // Skip invalid items
    }

    const childResponse = await fetch(
      `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childBody),
      }
    );

    if (!childResponse.ok) {
      const error = await childResponse.json();
      return {
        success: false,
        error_code: 'IG_CAROUSEL_CHILD_ERROR',
        error_message: error.error?.message || 'Failed to create carousel item',
        retryable: true,
      };
    }

    const childResult = await childResponse.json();
    
    // Poll for child processing
    const pollResult = await pollContainerStatus(childResult.id, accessToken);
    if (!pollResult.ready) {
      return {
        success: false,
        error_code: 'IG_CAROUSEL_CHILD_PROCESSING',
        error_message: pollResult.error || 'Carousel item processing failed',
        retryable: true,
      };
    }
    
    childrenIds.push(childResult.id);
  }

  if (childrenIds.length < 2) {
    return {
      success: false,
      error_code: 'CAROUSEL_INVALID_ITEMS',
      error_message: 'Could not process enough valid media items',
      retryable: false,
    };
  }

  // Step 2: Create carousel container
  const carouselResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        caption: caption,
        children: childrenIds,
        access_token: accessToken,
      }),
    }
  );

  if (!carouselResponse.ok) {
    const error = await carouselResponse.json();
    return {
      success: false,
      error_code: 'IG_CAROUSEL_CONTAINER_ERROR',
      error_message: error.error?.message || 'Failed to create carousel container',
      retryable: true,
    };
  }

  const carouselResult = await carouselResponse.json();
  const creationId = carouselResult.id;

  // Step 3: Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v${GRAPH_VERSION}/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    return {
      success: false,
      error_code: 'IG_CAROUSEL_PUBLISH_ERROR',
      error_message: error.error?.message || 'Failed to publish carousel',
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

// ============================================
// MAIN PUBLISHER ROUTER
// ============================================

async function publishToplatform(post: SocialPost, credentials: PlatformCredentials): Promise<PublishResult> {
  // Get appropriate token (page token for Meta assets)
  // Priority: asset_token_encrypted (Page token saved during asset selection) > page_access_token_encrypted > access_token_encrypted
  // Using the Page Access Token is CRITICAL for publishing to Facebook Pages and Instagram Business accounts
  const accessToken = credentials.asset_token_encrypted 
    ? decryptToken(credentials.asset_token_encrypted)
    : credentials.page_access_token_encrypted 
      ? decryptToken(credentials.page_access_token_encrypted)
      : decryptToken(credentials.access_token_encrypted);
  
  const assetType = credentials.platform_account_type;
  const assetId = credentials.account_id;
  const contentType = post.content_type || 'feed';

  try {
    switch (post.platform) {
      case 'facebook':
        if (assetType === 'facebook_page') {
          switch (contentType) {
            case 'story':
              return await publishFacebookStory(assetId, accessToken, post);
            case 'reels':
              return await publishFacebookReel(assetId, accessToken, post);
            case 'carousel':
              return await publishFacebookCarousel(assetId, accessToken, post);
            case 'video':
            case 'feed':
            default:
              return await publishFacebookFeed(assetId, accessToken, post);
          }
        }
        break;

      case 'instagram':
        if (assetType === 'instagram_business') {
          switch (contentType) {
            case 'story':
              return await publishInstagramStory(assetId, accessToken, post);
            case 'reels':
              return await publishInstagramReel(assetId, accessToken, post);
            case 'carousel':
              return await publishInstagramCarousel(assetId, accessToken, post);
            case 'video':
            case 'feed':
            default:
              return await publishInstagramFeed(assetId, accessToken, post);
          }
        }
        break;

      case 'linkedin':
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

      case 'youtube':
        return {
          success: false,
          error_code: 'NOT_IMPLEMENTED',
          error_message: 'YouTube video publishing requires additional implementation',
          retryable: false,
        };

      case 'tiktok':
        return {
          success: false,
          error_code: 'NOT_IMPLEMENTED',
          error_message: 'TikTok video publishing requires additional implementation',
          retryable: false,
        };

      default:
        return {
          success: false,
          error_code: 'UNSUPPORTED_PLATFORM',
          error_message: `Platform ${post.platform} is not yet supported`,
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
    console.error(`Publishing error for ${post.platform}/${contentType}:`, errorMessage);
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
    const now = new Date().toISOString();
    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min timeout
    
    // Query: status = scheduled AND scheduled_at <= now AND (processing_started_at IS NULL OR processing_started_at < lockTimeout)
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
        error_code,
        processing_started_at
      `)
      .eq("status", "scheduled")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`);
    }

    // Filter posts that are not currently being processed (lock not held or expired)
    const availablePosts = (scheduledPosts || []).filter(post => {
      if (!post.processing_started_at) return true;
      return new Date(post.processing_started_at) < new Date(lockTimeout);
    });

    if (availablePosts.length === 0) {
      logger.info("No scheduled posts to process");
      return new Response(
        JSON.stringify({ processed: 0, success: 0, failed: 0, job_id: jobId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info(`Found ${availablePosts.length} posts to process`);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const post of availablePosts as SocialPost[]) {
      const postStartTime = Date.now();
      
      try {
        // Try to acquire lock by setting processing_started_at atomically
        // Use a two-step approach: update then verify
        const lockTimestamp = new Date().toISOString();
        
        const { error: lockError } = await supabase
          .from("social_posts")
          .update({ 
            processing_started_at: lockTimestamp,
            job_id: jobId 
          })
          .eq("id", post.id)
          .eq("status", "scheduled");

        if (lockError) {
          logger.warn(`Failed to acquire lock for post ${post.id}: ${lockError.message}`);
          skippedCount++;
          continue;
        }

        // Verify we got the lock by checking if our job_id is set
        const { data: verifyData, error: verifyError } = await supabase
          .from("social_posts")
          .select("id, job_id, processing_started_at")
          .eq("id", post.id)
          .eq("job_id", jobId)
          .single();

        if (verifyError || !verifyData) {
          logger.info(`Skipping post ${post.id} - lock acquired by another job`);
          skippedCount++;
          continue;
        }

        logger.info(`Lock acquired for post ${post.id}`);

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
          const updatePayload = {
            status: "published",
            published_at: new Date().toISOString(),
            platform_post_id: result.platform_post_id,
            platform_url: result.platform_url,
            error_message: null,
            error_code: null,
            last_error_code: null,
            last_error_message: null,
            processing_completed_at: new Date().toISOString(),
          };
          
          const { error: updateError, count: updateCount } = await supabase
            .from("social_posts")
            .update(updatePayload)
            .eq("id", post.id)
            .select("id");
          
          if (updateError) {
            logger.error(`CRITICAL: Failed to update post ${post.id} to published status: ${updateError.message}`);
            // Try again without the select
            const { error: retryError } = await supabase
              .from("social_posts")
              .update(updatePayload)
              .eq("id", post.id);
            
            if (retryError) {
              logger.error(`CRITICAL: Retry also failed for post ${post.id}: ${retryError.message}`);
            } else {
              logger.info(`Retry succeeded for post ${post.id}`);
            }
          } else {
            logger.info(`Successfully updated post ${post.id} to published status`);
          }

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
