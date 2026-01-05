/**
 * Social Media Hooks
 * Central exports for all social media related hooks
 */

export * from './useSocialPosts';
export * from './useSocialPlatforms';
export * from './useSocialMetrics';
export * from './useSocialHashtags';
export * from './useSocialMediaTemplates';
export * from './useSocialMediaTracking';
export * from './usePlatformAssets';

// Re-export platform state types
export type { PlatformState } from '@/lib/social/platform-state';
export { computePlatformState, getPlatformStateConfig, isStateActionable, isStateAttentionRequired } from '@/lib/social/platform-state';
