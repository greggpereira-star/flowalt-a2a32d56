/**
 * Social Media Platform Adapter Types
 * Generic interface for multi-platform social media integration
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

export type ContentType = 'feed' | 'story' | 'reels' | 'carousel' | 'video' | 'short' | 'article';

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
  alt_text?: string;
}

export interface SocialPostPayload {
  id: string;
  caption: string;
  hashtags: string[];
  media: MediaItem[];
  content_type: ContentType;
  first_comment?: string;
  scheduled_at?: string;
  location?: {
    id: string;
    name: string;
  };
}

export interface PublishResult {
  success: boolean;
  platform_post_id?: string;
  platform_url?: string;
  error_message?: string;
  error_code?: string;
  raw_response?: unknown;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string[];
}

export interface PlatformCredentials {
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  account_id: string;
  page_id?: string; // For Facebook Pages
  instagram_account_id?: string; // For Instagram Business
}

export interface PostMetrics {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views?: number;
  clicks?: number;
  profile_visits?: number;
  engagement_rate: number;
  video_views?: number;
  video_watch_time_ms?: number;
}

export interface AccountMetrics {
  followers_count: number;
  following_count: number;
  posts_count: number;
  engagement_rate: number;
  reach_growth: number;
  followers_growth: number;
}

export interface PlatformCapabilities {
  maxMediaPerPost: number;
  maxCaptionLength: number;
  maxHashtags: number;
  supportedContentTypes: ContentType[];
  supportsScheduling: boolean;
  supportsCarousel: boolean;
  supportsStories: boolean;
  supportsReels: boolean;
  supportsFirstComment: boolean;
  supportsLocation: boolean;
  supportedMetrics: string[];
}

/**
 * Generic Social Platform Adapter Interface
 * All platform-specific adapters must implement this interface
 */
export interface SocialPlatformAdapter {
  platform: SocialPlatform;
  capabilities: PlatformCapabilities;

  // OAuth
  getAuthUrl(redirectUri: string, scopes?: string[]): string;
  exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  revokeToken(accessToken: string): Promise<void>;

  // Publishing
  publishPost(post: SocialPostPayload, credentials: PlatformCredentials): Promise<PublishResult>;
  deletePost(platformPostId: string, credentials: PlatformCredentials): Promise<void>;
  
  // For platforms that support it
  schedulePost?(post: SocialPostPayload, credentials: PlatformCredentials): Promise<PublishResult>;
  updatePost?(platformPostId: string, updates: Partial<SocialPostPayload>, credentials: PlatformCredentials): Promise<PublishResult>;

  // Metrics
  fetchPostMetrics(platformPostId: string, credentials: PlatformCredentials): Promise<PostMetrics>;
  fetchAccountMetrics(credentials: PlatformCredentials): Promise<AccountMetrics>;

  // Media Upload (for platforms requiring pre-upload)
  uploadMedia?(media: MediaItem, credentials: PlatformCredentials): Promise<{ media_id: string }>;
  
  // Validation
  validatePost(post: SocialPostPayload): { valid: boolean; errors: string[] };
}

/**
 * Platform-specific error codes
 */
export enum SocialErrorCode {
  // Auth errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED',
  
  // Content errors
  CAPTION_TOO_LONG = 'CAPTION_TOO_LONG',
  TOO_MANY_HASHTAGS = 'TOO_MANY_HASHTAGS',
  INVALID_MEDIA_FORMAT = 'INVALID_MEDIA_FORMAT',
  MEDIA_TOO_LARGE = 'MEDIA_TOO_LARGE',
  TOO_MANY_MEDIA = 'TOO_MANY_MEDIA',
  
  // Platform errors
  PLATFORM_ERROR = 'PLATFORM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class SocialPlatformError extends Error {
  code: SocialErrorCode;
  platform: SocialPlatform;
  retryable: boolean;
  rawError?: unknown;

  constructor(
    message: string,
    code: SocialErrorCode,
    platform: SocialPlatform,
    retryable = false,
    rawError?: unknown
  ) {
    super(message);
    this.name = 'SocialPlatformError';
    this.code = code;
    this.platform = platform;
    this.retryable = retryable;
    this.rawError = rawError;
  }
}
