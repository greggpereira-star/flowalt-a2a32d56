/**
 * Hook for managing social platform assets (pages, accounts, channels)
 * Assets are the specific destinations for posting (e.g., a Facebook Page, Instagram Business account)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { SocialPlatform } from './useSocialPosts';

export interface PlatformAsset {
  id: string;
  workspace_id: string;
  platform_connection_id: string;
  platform_id: SocialPlatform;
  asset_id: string;
  asset_type: 'facebook_page' | 'instagram_business' | 'linkedin_company' | 'youtube_channel' | 'tiktok_account' | 'twitter_account';
  asset_name: string;
  asset_meta: {
    profile_picture_url?: string;
    followers_count?: number;
    access_token?: string; // Page-specific token for Facebook
  } | null;
  created_at: string;
  updated_at: string;
}

export interface AssetWithConnection extends PlatformAsset {
  connection_account_name: string;
  connection_status: string;
}

/**
 * Get all assets for the current workspace
 */
export const usePlatformAssets = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['platform-assets', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // First, try to get assets from connections that are fully connected
      const { data: connectedAssets, error: connectedError } = await supabase
        .from('social_platform_assets')
        .select(`
          *,
          social_platforms!inner(
            account_name,
            connection_status,
            is_active
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('social_platforms.is_active', true)
        .eq('social_platforms.connection_status', 'connected');

      if (connectedError) throw connectedError;

      // Also check for assets from pending_assets connections (assets were saved but connection not finalized)
      const { data: pendingAssets, error: pendingError } = await supabase
        .from('social_platform_assets')
        .select(`
          *,
          social_platforms!inner(
            account_name,
            connection_status,
            is_active
          )
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('social_platforms.is_active', true)
        .eq('social_platforms.connection_status', 'pending_assets');

      if (pendingError) throw pendingError;

      const allAssets = [...(connectedAssets || []), ...(pendingAssets || [])];
      
      return allAssets.map((asset: any) => ({
        ...asset,
        connection_account_name: asset.social_platforms?.account_name,
        connection_status: asset.social_platforms?.connection_status,
      })) as AssetWithConnection[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

/**
 * Get assets filtered by platform (e.g., only Instagram assets)
 */
export const useAssetsByPlatform = (platform: SocialPlatform | null) => {
  const { data: allAssets, ...rest } = usePlatformAssets();

  const filteredAssets = platform
    ? allAssets?.filter(asset => asset.platform_id === platform)
    : [];

  return {
    ...rest,
    data: filteredAssets,
  };
};

/**
 * Get assets for posting - maps asset types to platforms correctly
 * Facebook Pages can be used for facebook posts
 * Instagram Business accounts can be used for instagram posts
 */
export const usePostableAssets = (platform: SocialPlatform | null) => {
  const { data: allAssets, ...rest } = usePlatformAssets();

  // Filter assets by the platform_id field which indicates the destination platform
  // This handles cases where a facebook_page asset is linked to an instagram connection
  const filteredAssets = platform
    ? allAssets?.filter(asset => asset.platform_id === platform)
    : [];

  return {
    ...rest,
    data: filteredAssets,
  };
};

/**
 * Get a single asset by ID
 */
export const usePlatformAsset = (assetId: string | null) => {
  return useQuery({
    queryKey: ['platform-asset', assetId],
    queryFn: async () => {
      if (!assetId) return null;

      const { data, error } = await supabase
        .from('social_platform_assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (error) throw error;
      return data as PlatformAsset;
    },
    enabled: !!assetId,
  });
};
