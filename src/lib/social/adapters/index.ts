/**
 * Social Media Platform Adapters
 * Central registry for all platform integrations
 */

export * from './types';
export { InstagramAdapter, FacebookAdapter, createMetaAdapter } from './meta';

import type { SocialPlatformAdapter, SocialPlatform } from './types';
import { InstagramAdapter, FacebookAdapter } from './meta';

// Platform adapter registry
const adapters: Partial<Record<SocialPlatform, SocialPlatformAdapter>> = {
  instagram: new InstagramAdapter(),
  facebook: new FacebookAdapter(),
  // Future adapters:
  // linkedin: new LinkedInAdapter(),
  // tiktok: new TikTokAdapter(),
  // youtube: new YouTubeAdapter(),
  // twitter: new TwitterAdapter(),
};

/**
 * Get the adapter for a specific platform
 */
export function getAdapter(platform: SocialPlatform): SocialPlatformAdapter | null {
  return adapters[platform] || null;
}

/**
 * Get all available adapters
 */
export function getAvailableAdapters(): SocialPlatform[] {
  return Object.keys(adapters) as SocialPlatform[];
}

/**
 * Check if a platform is supported
 */
export function isPlatformSupported(platform: SocialPlatform): boolean {
  return platform in adapters;
}
