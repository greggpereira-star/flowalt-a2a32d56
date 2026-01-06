/**
 * Hook for fetching account-level metrics from connected social platforms
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useMemo, useEffect } from 'react';
import { usePlatformAssets } from './usePlatformAssets';

export interface AccountMetricsData {
  followers: number;
  following?: number;
  posts_count: number;
  profile_views?: number;
  website_clicks?: number;
  page_reach?: number;
  page_impressions?: number;
  page_engagements?: number;
  asset_id: string;
  asset_name: string;
}

export interface ConnectedAccount {
  id: string;
  platform: string;
  account_name: string;
  account_metrics: Record<string, AccountMetricsData> | null;
  account_metrics_updated_at: string | null;
  platform_account_type?: string;
}

// Individual asset for dropdown selection
export interface AssetOption {
  id: string; // asset_id from social_platform_assets
  asset_external_id: string; // external asset_id (e.g. Instagram Business ID)
  platform_connection_id: string;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube';
  asset_type: string; // instagram_business, facebook_page, etc.
  name: string;
  followers: number;
}

/**
 * Get all connected accounts with their metrics
 */
export const useConnectedAccountsWithMetrics = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['connected-accounts-metrics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('social_platforms')
        .select(`
          id,
          platform,
          account_name,
          account_metrics,
          account_metrics_updated_at,
          platform_account_type
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true)
        .eq('connection_status', 'connected');

      if (error) throw error;
      return (data || []) as unknown as ConnectedAccount[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

/**
 * Get individual assets for dropdown - shows each Instagram, Facebook Page individually
 * Now uses usePlatformAssets for more reliable and up-to-date data
 */
export const useIndividualAssets = () => {
  const { data: platformAssets, isLoading: assetsLoading } = usePlatformAssets();
  const { data: accounts, isLoading: accountsLoading } = useConnectedAccountsWithMetrics();
  const queryClient = useQueryClient();

  // Merge asset data with metrics from accounts
  const assets = useMemo(() => {
    if (!platformAssets) return [];

    const result: AssetOption[] = [];
    const seen = new Set<string>();

    for (const asset of platformAssets) {
      // Skip duplicates
      if (seen.has(asset.id)) continue;
      seen.add(asset.id);

      // Find matching metrics from accounts
      const account = accounts?.find(a => a.id === asset.platform_connection_id);
      let followers = 0;

      if (account?.account_metrics) {
        // Look for metrics matching this asset
        for (const [, metrics] of Object.entries(account.account_metrics)) {
          const m = metrics as AccountMetricsData;
          if (m.asset_id === asset.asset_id) {
            followers = m.followers || 0;
            break;
          }
        }
      }

      // Fallback to asset_meta followers
      if (followers === 0 && asset.asset_meta?.followers_count) {
        followers = asset.asset_meta.followers_count;
      }

      result.push({
        id: asset.id,
        asset_external_id: asset.asset_id,
        platform_connection_id: asset.platform_connection_id,
        platform: asset.platform_id as AssetOption['platform'],
        asset_type: asset.asset_type,
        name: asset.asset_name,
        followers,
      });
    }

    return result;
  }, [platformAssets, accounts]);

  // Auto-refresh when assets change
  useEffect(() => {
    if (platformAssets && platformAssets.length > 0) {
      // Invalidate connected accounts metrics to ensure data sync
      queryClient.invalidateQueries({ queryKey: ['connected-accounts-metrics'] });
    }
  }, [platformAssets?.length, queryClient]);

  return { assets, isLoading: assetsLoading || accountsLoading };
};

/**
 * Get metrics for a specific platform connection
 */
export const useAccountMetrics = (platformConnectionId: string | null) => {
  const { data: accounts } = useConnectedAccountsWithMetrics();

  const selectedAccount = platformConnectionId 
    ? accounts?.find(a => a.id === platformConnectionId)
    : null;

  // Flatten all asset metrics into an array
  // Support both new format (asset_type:asset_id) and legacy format (asset_type)
  // Deduplicate by asset_id to avoid showing same asset twice
  const assetsMetrics = (() => {
    if (!selectedAccount?.account_metrics) return [];
    
    const seen = new Set<string>();
    const results: Array<AccountMetricsData & { assetType: string }> = [];
    
    for (const [key, metrics] of Object.entries(selectedAccount.account_metrics)) {
      const m = metrics as AccountMetricsData;
      const assetId = m.asset_id;
      
      // Skip if we've already processed this asset_id
      if (seen.has(assetId)) continue;
      seen.add(assetId);
      
      // Extract asset type from key or from metrics
      const [assetType] = key.split(':');
      results.push({
        assetType: (m as any).asset_type || assetType || key,
        ...m,
      });
    }
    
    return results;
  })();

  // Calculate totals across all assets
  const totalFollowers = assetsMetrics.reduce((sum, m) => sum + (m.followers || 0), 0);
  const totalPosts = assetsMetrics.reduce((sum, m) => sum + (m.posts_count || 0), 0);

  return {
    account: selectedAccount,
    assetsMetrics,
    totalFollowers,
    totalPosts,
    lastUpdated: selectedAccount?.account_metrics_updated_at,
  };
};

/**
 * Format last updated timestamp
 */
export const formatLastUpdated = (timestamp: string | null): string => {
  if (!timestamp) return 'Nunca sincronizado';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 60) return `Atualizado há ${diffMins}min`;
  if (diffHours < 24) return `Atualizado há ${diffHours}h`;
  return `Atualizado em ${date.toLocaleDateString('pt-BR')}`;
};
