/**
 * Social Media Publishing Service
 * Orchestrates multi-platform post publishing using platform adapters
 */

import { supabase } from '@/integrations/supabase/client';
import { getAdapter, isPlatformSupported } from '../adapters';
import type { 
  SocialPlatform, 
  SocialPostPayload, 
  PlatformCredentials,
  PublishResult,
  ContentType
} from '../adapters/types';

interface PublishToAccountParams {
  postId: string;
  platform: SocialPlatform;
}

interface PublishingResult {
  platform: SocialPlatform;
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  errorMessage?: string;
}

/**
 * Get post data and convert to adapter payload format
 */
async function getPostPayload(postId: string): Promise<SocialPostPayload | null> {
  const { data: post, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error || !post) {
    console.error('Failed to fetch post:', error);
    return null;
  }

  // Parse media_urls from JSON
  const mediaUrls = (post.media_urls as any[]) || [];

  // Convert database format to adapter format
  return {
    id: post.id,
    caption: post.caption || '',
    hashtags: (post.hashtags as string[]) || [],
    media: mediaUrls.map((m: any) => ({
      type: m.type as 'image' | 'video',
      url: m.url,
    })),
    content_type: (post.content_type as ContentType) || 'feed',
    first_comment: post.first_comment || undefined,
    scheduled_at: post.scheduled_at || undefined,
  };
}

/**
 * Get platform credentials for publishing
 * Note: In a real implementation, tokens would be securely stored and retrieved
 */
async function getPlatformCredentials(
  workspaceId: string, 
  platform: SocialPlatform
): Promise<PlatformCredentials | null> {
  const { data: platformData, error } = await supabase
    .from('social_platforms')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', platform)
    .eq('is_active', true)
    .single();

  if (error || !platformData) {
    console.error('Failed to fetch platform:', error);
    return null;
  }

  // Note: In production, access_token would be decrypted from secure storage
  return {
    access_token: '', // Would be retrieved from secure storage
    account_id: platformData.account_id,
  };
}

/**
 * Update the post status after publishing attempt
 */
async function updatePostStatus(
  postId: string,
  result: PublishResult
): Promise<void> {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (result.success) {
    updateData.status = 'published';
    updateData.published_at = new Date().toISOString();
    updateData.platform_post_id = result.platform_post_id;
    updateData.platform_url = result.platform_url;
    updateData.error_message = null;
    updateData.error_code = null;
  } else {
    updateData.status = 'failed';
    updateData.error_message = result.error_message;
    updateData.error_code = result.error_code;
  }

  await supabase
    .from('social_posts')
    .update(updateData)
    .eq('id', postId);
}

/**
 * Publish a post to a specific platform
 */
export async function publishToAccount({
  postId,
  platform,
}: PublishToAccountParams): Promise<PublishingResult> {
  const result: PublishingResult = {
    platform,
    success: false,
  };

  // Check if platform is supported
  if (!isPlatformSupported(platform)) {
    result.errorMessage = `Platform ${platform} is not supported`;
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
    return result;
  }

  // Get the adapter
  const adapter = getAdapter(platform);
  if (!adapter) {
    result.errorMessage = `No adapter found for platform ${platform}`;
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
    return result;
  }

  // Get post payload
  const payload = await getPostPayload(postId);
  if (!payload) {
    result.errorMessage = 'Failed to fetch post data';
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
    return result;
  }

  // Validate post against platform requirements
  const validation = adapter.validatePost(payload);
  if (!validation.valid) {
    result.errorMessage = validation.errors.join(', ');
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
    return result;
  }

  // Get post workspace to fetch credentials
  const { data: postData } = await supabase
    .from('social_posts')
    .select('workspace_id')
    .eq('id', postId)
    .single();

  if (!postData) {
    result.errorMessage = 'Failed to fetch post workspace';
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
    return result;
  }

  // Get platform credentials
  const credentials = await getPlatformCredentials(postData.workspace_id, platform);
  if (!credentials) {
    result.errorMessage = 'Failed to fetch platform credentials';
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
    return result;
  }

  // Publish the post
  try {
    const publishResult = await adapter.publishPost(payload, credentials);
    
    result.success = publishResult.success;
    result.platformPostId = publishResult.platform_post_id;
    result.platformUrl = publishResult.platform_url;
    result.errorMessage = publishResult.error_message;

    await updatePostStatus(postId, publishResult);
  } catch (error: any) {
    result.errorMessage = error.message || 'Unknown error during publishing';
    await updatePostStatus(postId, { success: false, error_message: result.errorMessage });
  }

  return result;
}

/**
 * Schedule a post for future publishing
 */
export async function schedulePost(postId: string, scheduledAt: Date): Promise<boolean> {
  const { error } = await supabase
    .from('social_posts')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) {
    console.error('Failed to schedule post:', error);
    return false;
  }

  return true;
}

/**
 * Cancel a scheduled post
 */
export async function cancelScheduledPost(postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('social_posts')
    .update({
      status: 'draft',
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) {
    console.error('Failed to cancel scheduled post:', error);
    return false;
  }

  return true;
}

/**
 * Delete a post from a platform
 */
export async function deleteFromPlatform(
  postId: string,
  platform: SocialPlatform,
  platformPostId: string
): Promise<boolean> {
  const adapter = getAdapter(platform);
  if (!adapter) {
    console.error(`No adapter for platform ${platform}`);
    return false;
  }

  // Get post workspace
  const { data: postData } = await supabase
    .from('social_posts')
    .select('workspace_id')
    .eq('id', postId)
    .single();

  if (!postData) {
    console.error('Failed to fetch post');
    return false;
  }

  const credentials = await getPlatformCredentials(postData.workspace_id, platform);
  if (!credentials) {
    console.error('Failed to get credentials');
    return false;
  }

  try {
    await adapter.deletePost(platformPostId, credentials);
    
    // Update the post status
    await supabase
      .from('social_posts')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    return true;
  } catch (error) {
    console.error('Failed to delete from platform:', error);
    return false;
  }
}
