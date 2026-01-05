/**
 * Hook for fetching account-level metrics from connected social platforms
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

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
 * Get metrics for a specific platform connection
 */
export const useAccountMetrics = (platformConnectionId: string | null) => {
  const { data: accounts } = useConnectedAccountsWithMetrics();

  const selectedAccount = platformConnectionId 
    ? accounts?.find(a => a.id === platformConnectionId)
    : null;

  // Flatten all asset metrics into an array
  // Support both new format (asset_type:asset_id) and legacy format (asset_type)
  const assetsMetrics = selectedAccount?.account_metrics 
    ? Object.entries(selectedAccount.account_metrics)
        .filter(([key]) => !key.includes(':') || key.startsWith('instagram_business:') || key.startsWith('facebook_page:'))
        .map(([key, metrics]) => {
          const m = metrics as AccountMetricsData;
          // For new format keys like "facebook_page:123", extract info
          const [assetType] = key.split(':');
          return {
            assetType: (m as any).asset_type || assetType || key,
            ...m,
          };
        })
    : [];

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
