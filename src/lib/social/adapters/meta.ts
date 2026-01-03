/**
 * Meta (Instagram & Facebook) Platform Adapter
 * Implements the Graph API for Instagram Business and Facebook Pages
 */

import type {
  SocialPlatformAdapter,
  SocialPlatform,
  PlatformCapabilities,
  SocialPostPayload,
  PublishResult,
  TokenResponse,
  PlatformCredentials,
  PostMetrics,
  AccountMetrics,
  MediaItem,
} from './types';
import { SocialPlatformError, SocialErrorCode } from './types';

const META_GRAPH_API_VERSION = 'v18.0';
const META_GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

const INSTAGRAM_CAPABILITIES: PlatformCapabilities = {
  maxMediaPerPost: 10,
  maxCaptionLength: 2200,
  maxHashtags: 30,
  supportedContentTypes: ['feed', 'story', 'reels', 'carousel'],
  supportsScheduling: false, // Scheduling is done via our system
  supportsCarousel: true,
  supportsStories: true,
  supportsReels: true,
  supportsFirstComment: false, // We handle this separately
  supportsLocation: true,
  supportedMetrics: ['reach', 'impressions', 'likes', 'comments', 'shares', 'saves'],
};

const FACEBOOK_CAPABILITIES: PlatformCapabilities = {
  maxMediaPerPost: 10,
  maxCaptionLength: 63206,
  maxHashtags: 30,
  supportedContentTypes: ['feed', 'story', 'video'],
  supportsScheduling: true,
  supportsCarousel: true,
  supportsStories: true,
  supportsReels: false,
  supportsFirstComment: false,
  supportsLocation: true,
  supportedMetrics: ['reach', 'impressions', 'likes', 'comments', 'shares'],
};

/**
 * Instagram Business Account Adapter
 */
export class InstagramAdapter implements SocialPlatformAdapter {
  platform: SocialPlatform = 'instagram';
  capabilities = INSTAGRAM_CAPABILITIES;

  getAuthUrl(redirectUri: string, scopes?: string[]): string {
    const defaultScopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
    ];
    
    const params = new URLSearchParams({
      client_id: '', // Will be set from env
      redirect_uri: redirectUri,
      scope: (scopes || defaultScopes).join(','),
      response_type: 'code',
    });

    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
    // This would be implemented in an edge function with the app secret
    throw new SocialPlatformError(
      'Token exchange must be done server-side',
      SocialErrorCode.PLATFORM_ERROR,
      'instagram',
      false
    );
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${process.env.META_APP_ID}&` +
      `client_secret=${process.env.META_APP_SECRET}&` +
      `fb_exchange_token=${refreshToken}`
    );

    if (!response.ok) {
      throw new SocialPlatformError(
        'Failed to refresh token',
        SocialErrorCode.TOKEN_EXPIRED,
        'instagram',
        false
      );
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in || 5184000, // 60 days default
      token_type: 'bearer',
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    await fetch(`${META_GRAPH_API_BASE}/me/permissions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async publishPost(post: SocialPostPayload, credentials: PlatformCredentials): Promise<PublishResult> {
    try {
      const igAccountId = credentials.instagram_account_id;
      if (!igAccountId) {
        throw new SocialPlatformError(
          'Instagram account ID not found',
          SocialErrorCode.INVALID_TOKEN,
          'instagram',
          false
        );
      }

      // Build caption with hashtags
      const fullCaption = this.buildCaption(post.caption, post.hashtags);

      // Handle different content types
      if (post.content_type === 'carousel' && post.media.length > 1) {
        return await this.publishCarousel(igAccountId, post, fullCaption, credentials);
      } else if (post.content_type === 'reels' || post.media[0]?.type === 'video') {
        return await this.publishVideo(igAccountId, post, fullCaption, credentials);
      } else {
        return await this.publishSingleMedia(igAccountId, post, fullCaption, credentials);
      }
    } catch (error) {
      if (error instanceof SocialPlatformError) throw error;
      
      return {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_code: SocialErrorCode.PLATFORM_ERROR,
      };
    }
  }

  private async publishSingleMedia(
    igAccountId: string,
    post: SocialPostPayload,
    caption: string,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    // Step 1: Create media container
    const containerResponse = await fetch(
      `${META_GRAPH_API_BASE}/${igAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          image_url: post.media[0]?.url,
          caption,
          ...(post.location?.id && { location_id: post.location.id }),
        }),
      }
    );

    const containerData = await containerResponse.json();
    if (containerData.error) {
      throw new SocialPlatformError(
        containerData.error.message,
        this.mapErrorCode(containerData.error.code),
        'instagram',
        this.isRetryable(containerData.error.code)
      );
    }

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `${META_GRAPH_API_BASE}/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          creation_id: containerData.id,
        }),
      }
    );

    const publishData = await publishResponse.json();
    if (publishData.error) {
      throw new SocialPlatformError(
        publishData.error.message,
        this.mapErrorCode(publishData.error.code),
        'instagram',
        this.isRetryable(publishData.error.code)
      );
    }

    return {
      success: true,
      platform_post_id: publishData.id,
      platform_url: `https://www.instagram.com/p/${publishData.id}/`,
    };
  }

  private async publishCarousel(
    igAccountId: string,
    post: SocialPostPayload,
    caption: string,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    // Step 1: Create container for each media item
    const childContainerIds: string[] = [];

    for (const media of post.media) {
      const isVideo = media.type === 'video';
      const containerResponse = await fetch(
        `${META_GRAPH_API_BASE}/${igAccountId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.access_token}`,
          },
          body: JSON.stringify({
            [isVideo ? 'video_url' : 'image_url']: media.url,
            is_carousel_item: true,
            ...(isVideo && { media_type: 'VIDEO' }),
          }),
        }
      );

      const containerData = await containerResponse.json();
      if (containerData.error) {
        throw new SocialPlatformError(
          containerData.error.message,
          this.mapErrorCode(containerData.error.code),
          'instagram',
          false
        );
      }
      childContainerIds.push(containerData.id);
    }

    // Step 2: Create carousel container
    const carouselResponse = await fetch(
      `${META_GRAPH_API_BASE}/${igAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childContainerIds,
          caption,
        }),
      }
    );

    const carouselData = await carouselResponse.json();
    if (carouselData.error) {
      throw new SocialPlatformError(
        carouselData.error.message,
        this.mapErrorCode(carouselData.error.code),
        'instagram',
        false
      );
    }

    // Step 3: Publish carousel
    const publishResponse = await fetch(
      `${META_GRAPH_API_BASE}/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          creation_id: carouselData.id,
        }),
      }
    );

    const publishData = await publishResponse.json();
    return {
      success: true,
      platform_post_id: publishData.id,
      platform_url: `https://www.instagram.com/p/${publishData.id}/`,
    };
  }

  private async publishVideo(
    igAccountId: string,
    post: SocialPostPayload,
    caption: string,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    const isReels = post.content_type === 'reels';

    // Step 1: Create video container
    const containerResponse = await fetch(
      `${META_GRAPH_API_BASE}/${igAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          video_url: post.media[0]?.url,
          caption,
          media_type: isReels ? 'REELS' : 'VIDEO',
          ...(post.media[0]?.thumbnail_url && { thumb_offset: 0 }),
        }),
      }
    );

    const containerData = await containerResponse.json();
    if (containerData.error) {
      throw new SocialPlatformError(
        containerData.error.message,
        this.mapErrorCode(containerData.error.code),
        'instagram',
        false
      );
    }

    // Step 2: Wait for video processing (poll status)
    await this.waitForMediaProcessing(containerData.id, credentials.access_token);

    // Step 3: Publish
    const publishResponse = await fetch(
      `${META_GRAPH_API_BASE}/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          creation_id: containerData.id,
        }),
      }
    );

    const publishData = await publishResponse.json();
    return {
      success: true,
      platform_post_id: publishData.id,
      platform_url: `https://www.instagram.com/reel/${publishData.id}/`,
    };
  }

  private async waitForMediaProcessing(containerId: string, accessToken: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `${META_GRAPH_API_BASE}/${containerId}?fields=status_code`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const data = await response.json();
      
      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR') {
        throw new SocialPlatformError(
          'Video processing failed',
          SocialErrorCode.PLATFORM_ERROR,
          'instagram',
          false
        );
      }

      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new SocialPlatformError(
      'Video processing timeout',
      SocialErrorCode.PLATFORM_ERROR,
      'instagram',
      true
    );
  }

  async deletePost(platformPostId: string, credentials: PlatformCredentials): Promise<void> {
    // Instagram API doesn't support post deletion via API
    throw new SocialPlatformError(
      'Instagram does not support post deletion via API',
      SocialErrorCode.PLATFORM_ERROR,
      'instagram',
      false
    );
  }

  async fetchPostMetrics(platformPostId: string, credentials: PlatformCredentials): Promise<PostMetrics> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${platformPostId}/insights?` +
      `metric=reach,impressions,likes,comments,shares,saved&` +
      `access_token=${credentials.access_token}`
    );

    const data = await response.json();
    
    if (data.error) {
      throw new SocialPlatformError(
        data.error.message,
        this.mapErrorCode(data.error.code),
        'instagram',
        false
      );
    }

    const metrics: Record<string, number> = {};
    for (const insight of data.data || []) {
      metrics[insight.name] = insight.values?.[0]?.value || 0;
    }

    const totalEngagement = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0) + (metrics.saved || 0);
    const engagementRate = metrics.reach > 0 ? (totalEngagement / metrics.reach) * 100 : 0;

    return {
      reach: metrics.reach || 0,
      impressions: metrics.impressions || 0,
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      shares: metrics.shares || 0,
      saves: metrics.saved || 0,
      engagement_rate: Math.round(engagementRate * 100) / 100,
    };
  }

  async fetchAccountMetrics(credentials: PlatformCredentials): Promise<AccountMetrics> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${credentials.instagram_account_id}?` +
      `fields=followers_count,follows_count,media_count&` +
      `access_token=${credentials.access_token}`
    );

    const data = await response.json();

    return {
      followers_count: data.followers_count || 0,
      following_count: data.follows_count || 0,
      posts_count: data.media_count || 0,
      engagement_rate: 0, // Would need historical data
      reach_growth: 0,
      followers_growth: 0,
    };
  }

  validatePost(post: SocialPostPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (post.caption.length > this.capabilities.maxCaptionLength) {
      errors.push(`Legenda muito longa (máx ${this.capabilities.maxCaptionLength} caracteres)`);
    }

    if (post.hashtags.length > this.capabilities.maxHashtags) {
      errors.push(`Muitas hashtags (máx ${this.capabilities.maxHashtags})`);
    }

    if (post.media.length > this.capabilities.maxMediaPerPost) {
      errors.push(`Muitas mídias (máx ${this.capabilities.maxMediaPerPost})`);
    }

    if (post.media.length === 0) {
      errors.push('Instagram requer pelo menos uma mídia');
    }

    return { valid: errors.length === 0, errors };
  }

  private buildCaption(caption: string, hashtags: string[]): string {
    if (hashtags.length === 0) return caption;
    const hashtagString = hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
    return `${caption}\n\n${hashtagString}`;
  }

  private mapErrorCode(metaErrorCode: number): SocialErrorCode {
    const errorMap: Record<number, SocialErrorCode> = {
      190: SocialErrorCode.INVALID_TOKEN,
      4: SocialErrorCode.RATE_LIMIT_EXCEEDED,
      17: SocialErrorCode.RATE_LIMIT_EXCEEDED,
      100: SocialErrorCode.PLATFORM_ERROR,
      200: SocialErrorCode.INSUFFICIENT_PERMISSIONS,
    };
    return errorMap[metaErrorCode] || SocialErrorCode.UNKNOWN_ERROR;
  }

  private isRetryable(metaErrorCode: number): boolean {
    // Rate limit errors are retryable
    return [4, 17, 341].includes(metaErrorCode);
  }
}

/**
 * Facebook Page Adapter
 */
export class FacebookAdapter implements SocialPlatformAdapter {
  platform: SocialPlatform = 'facebook';
  capabilities = FACEBOOK_CAPABILITIES;

  getAuthUrl(redirectUri: string, scopes?: string[]): string {
    const defaultScopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_read_user_content',
    ];
    
    const params = new URLSearchParams({
      client_id: '', // Will be set from env
      redirect_uri: redirectUri,
      scope: (scopes || defaultScopes).join(','),
      response_type: 'code',
    });

    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse> {
    throw new SocialPlatformError(
      'Token exchange must be done server-side',
      SocialErrorCode.PLATFORM_ERROR,
      'facebook',
      false
    );
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Similar to Instagram
    const response = await fetch(
      `${META_GRAPH_API_BASE}/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `fb_exchange_token=${refreshToken}`
    );

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in || 5184000,
      token_type: 'bearer',
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    await fetch(`${META_GRAPH_API_BASE}/me/permissions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async publishPost(post: SocialPostPayload, credentials: PlatformCredentials): Promise<PublishResult> {
    try {
      const pageId = credentials.page_id || credentials.account_id;
      const fullCaption = this.buildCaption(post.caption, post.hashtags);

      // Determine endpoint based on content
      const hasMedia = post.media.length > 0;
      const hasVideo = post.media.some(m => m.type === 'video');

      if (hasVideo) {
        return await this.publishVideo(pageId, post, fullCaption, credentials);
      } else if (hasMedia) {
        return await this.publishWithPhotos(pageId, post, fullCaption, credentials);
      } else {
        return await this.publishTextOnly(pageId, fullCaption, credentials);
      }
    } catch (error) {
      if (error instanceof SocialPlatformError) throw error;
      
      return {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_code: SocialErrorCode.PLATFORM_ERROR,
      };
    }
  }

  private async publishTextOnly(
    pageId: string,
    message: string,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({ message }),
      }
    );

    const data = await response.json();
    if (data.error) {
      throw new SocialPlatformError(
        data.error.message,
        SocialErrorCode.PLATFORM_ERROR,
        'facebook',
        false
      );
    }

    return {
      success: true,
      platform_post_id: data.id,
      platform_url: `https://www.facebook.com/${data.id}`,
    };
  }

  private async publishWithPhotos(
    pageId: string,
    post: SocialPostPayload,
    message: string,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    if (post.media.length === 1) {
      // Single photo
      const response = await fetch(
        `${META_GRAPH_API_BASE}/${pageId}/photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.access_token}`,
          },
          body: JSON.stringify({
            url: post.media[0].url,
            message,
          }),
        }
      );

      const data = await response.json();
      return {
        success: true,
        platform_post_id: data.post_id || data.id,
        platform_url: `https://www.facebook.com/${data.post_id || data.id}`,
      };
    }

    // Multiple photos - upload each unpublished, then create post
    const photoIds: string[] = [];
    
    for (const media of post.media) {
      const response = await fetch(
        `${META_GRAPH_API_BASE}/${pageId}/photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.access_token}`,
          },
          body: JSON.stringify({
            url: media.url,
            published: false,
          }),
        }
      );

      const data = await response.json();
      photoIds.push(data.id);
    }

    // Create post with attached photos
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          message,
          attached_media: attachedMedia,
        }),
      }
    );

    const data = await response.json();
    return {
      success: true,
      platform_post_id: data.id,
      platform_url: `https://www.facebook.com/${data.id}`,
    };
  }

  private async publishVideo(
    pageId: string,
    post: SocialPostPayload,
    message: string,
    credentials: PlatformCredentials
  ): Promise<PublishResult> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${pageId}/videos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          file_url: post.media[0].url,
          description: message,
        }),
      }
    );

    const data = await response.json();
    return {
      success: true,
      platform_post_id: data.id,
      platform_url: `https://www.facebook.com/${data.id}`,
    };
  }

  async deletePost(platformPostId: string, credentials: PlatformCredentials): Promise<void> {
    await fetch(
      `${META_GRAPH_API_BASE}/${platformPostId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${credentials.access_token}` },
      }
    );
  }

  async fetchPostMetrics(platformPostId: string, credentials: PlatformCredentials): Promise<PostMetrics> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${platformPostId}/insights?` +
      `metric=post_impressions,post_impressions_unique,post_reactions_by_type_total,post_clicks&` +
      `access_token=${credentials.access_token}`
    );

    const data = await response.json();
    const metrics: Record<string, number> = {};
    
    for (const insight of data.data || []) {
      metrics[insight.name] = insight.values?.[0]?.value || 0;
    }

    return {
      reach: metrics.post_impressions_unique || 0,
      impressions: metrics.post_impressions || 0,
      likes: 0, // Would need to parse reactions
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: metrics.post_clicks || 0,
      engagement_rate: 0,
    };
  }

  async fetchAccountMetrics(credentials: PlatformCredentials): Promise<AccountMetrics> {
    const response = await fetch(
      `${META_GRAPH_API_BASE}/${credentials.page_id}?` +
      `fields=fan_count,talking_about_count&` +
      `access_token=${credentials.access_token}`
    );

    const data = await response.json();

    return {
      followers_count: data.fan_count || 0,
      following_count: 0,
      posts_count: 0,
      engagement_rate: 0,
      reach_growth: 0,
      followers_growth: 0,
    };
  }

  validatePost(post: SocialPostPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (post.caption.length > this.capabilities.maxCaptionLength) {
      errors.push(`Texto muito longo (máx ${this.capabilities.maxCaptionLength} caracteres)`);
    }

    return { valid: errors.length === 0, errors };
  }

  private buildCaption(caption: string, hashtags: string[]): string {
    if (hashtags.length === 0) return caption;
    const hashtagString = hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
    return `${caption}\n\n${hashtagString}`;
  }
}

// Export factory function
export function createMetaAdapter(platform: 'instagram' | 'facebook'): SocialPlatformAdapter {
  return platform === 'instagram' ? new InstagramAdapter() : new FacebookAdapter();
}
