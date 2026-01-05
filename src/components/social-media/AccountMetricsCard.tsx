import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConnectedAccountsWithMetrics, formatLastUpdated, AccountMetricsData } from '@/hooks/useAccountMetrics';
import { formatMetricNumber } from '@/hooks/useSocialMetrics';
import { Users, ImageIcon, Clock, Instagram, Facebook, Eye, MousePointer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountMetricsCardProps {
  assetId: string | null;
  platformConnectionId: string | null;
}

const ASSET_TYPE_CONFIG: Record<string, { label: string; icon: typeof Instagram; color: string }> = {
  instagram_business: { label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
  facebook_page: { label: 'Facebook Page', icon: Facebook, color: 'bg-blue-600' },
};

export function AccountMetricsCard({ assetId, platformConnectionId }: AccountMetricsCardProps) {
  const { data: accounts } = useConnectedAccountsWithMetrics();

  // Find the specific asset by assetId
  const assetData = React.useMemo(() => {
    if (!assetId || !accounts) return null;

    for (const account of accounts) {
      if (!account.account_metrics) continue;
      
      for (const [key, metrics] of Object.entries(account.account_metrics)) {
        const m = metrics as AccountMetricsData;
        if (m.asset_id === assetId) {
          const [assetType] = key.split(':');
          return {
            metrics: m,
            assetType: (m as any).asset_type || assetType || key,
            lastUpdated: account.account_metrics_updated_at,
          };
        }
      }
    }
    return null;
  }, [assetId, accounts]);

  if (!assetId || !assetData) {
    return null;
  }

  const { metrics, assetType, lastUpdated } = assetData;
  const config = ASSET_TYPE_CONFIG[assetType] || { 
    label: assetType, 
    icon: Users, 
    color: 'bg-gray-500' 
  };
  const Icon = config.icon;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg text-white", config.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{metrics.asset_name}</CardTitle>
              <CardDescription>{config.label}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {formatLastUpdated(lastUpdated ?? null)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMetricNumber(metrics.followers || 0)}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-primary/10">
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMetricNumber(metrics.posts_count || 0)}</p>
              <p className="text-xs text-muted-foreground">Publicações</p>
            </div>
          </div>
        </div>

        {/* Additional Metrics for Facebook Pages */}
        {assetType === 'facebook_page' && (metrics.page_reach || metrics.page_impressions || metrics.website_clicks) && (
          <div className="grid grid-cols-3 gap-3">
            {metrics.page_reach !== undefined && (
              <div className="p-3 rounded-lg border text-center">
                <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_reach)}</p>
                <p className="text-xs text-muted-foreground">Alcance</p>
              </div>
            )}
            {metrics.page_impressions !== undefined && (
              <div className="p-3 rounded-lg border text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_impressions)}</p>
                <p className="text-xs text-muted-foreground">Impressões</p>
              </div>
            )}
            {metrics.website_clicks !== undefined && (
              <div className="p-3 rounded-lg border text-center">
                <MousePointer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.website_clicks)}</p>
                <p className="text-xs text-muted-foreground">Cliques</p>
              </div>
            )}
          </div>
        )}

        {/* Additional Metrics for Instagram */}
        {assetType === 'instagram_business' && (metrics.profile_views || metrics.website_clicks) && (
          <div className="grid grid-cols-2 gap-3">
            {metrics.profile_views !== undefined && (
              <div className="p-3 rounded-lg border text-center">
                <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.profile_views)}</p>
                <p className="text-xs text-muted-foreground">Visitas ao Perfil</p>
              </div>
            )}
            {metrics.website_clicks !== undefined && (
              <div className="p-3 rounded-lg border text-center">
                <MousePointer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.website_clicks)}</p>
                <p className="text-xs text-muted-foreground">Cliques no Site</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
