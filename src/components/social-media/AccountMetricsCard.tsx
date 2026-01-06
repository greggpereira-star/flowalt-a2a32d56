import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConnectedAccountsWithMetrics, formatLastUpdated, AccountMetricsData } from '@/hooks/useAccountMetrics';
import { formatMetricNumber } from '@/hooks/useSocialMetrics';
import { Users, ImageIcon, Clock, Instagram, Facebook, Eye, Heart, MessageCircle, Share2, TrendingUp, TrendingDown, UserPlus, UserMinus } from 'lucide-react';
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

        {/* Instagram Business Metrics - Full Display */}
        {assetType === 'instagram_business' && (
          <>
            {/* Reach & Views Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border text-center">
                <Eye className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_reach || 0)}</p>
                <p className="text-xs text-muted-foreground">Alcance (28 dias)</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_impressions || 0)}</p>
                <p className="text-xs text-muted-foreground">Views (28 dias)</p>
              </div>
            </div>

            {/* Engagement Row */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 rounded-lg border text-center">
                <Heart className="h-3 w-3 mx-auto mb-1 text-red-500" />
                <p className="text-sm font-semibold">{formatMetricNumber(metrics.likes_count || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Curtidas</p>
              </div>
              <div className="p-2 rounded-lg border text-center">
                <MessageCircle className="h-3 w-3 mx-auto mb-1 text-blue-500" />
                <p className="text-sm font-semibold">{formatMetricNumber(metrics.comments_count || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Comentários</p>
              </div>
              <div className="p-2 rounded-lg border text-center">
                <Share2 className="h-3 w-3 mx-auto mb-1 text-green-500" />
                <p className="text-sm font-semibold">{formatMetricNumber(metrics.shares_count || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Compartilhamentos</p>
              </div>
              <div className="p-2 rounded-lg border text-center">
                <Users className="h-3 w-3 mx-auto mb-1 text-purple-500" />
                <p className="text-sm font-semibold">{formatMetricNumber(metrics.accounts_engaged || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Engajados</p>
              </div>
            </div>

            {/* Followers Change Row */}
            {(metrics.follows || metrics.unfollows) ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <UserPlus className="h-4 w-4 text-green-600" />
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-green-700 dark:text-green-400">+{formatMetricNumber(metrics.follows || 0)}</p>
                  <p className="text-xs text-green-600">Novos Seguidores</p>
                </div>
                <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <UserMinus className="h-4 w-4 text-red-600" />
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  </div>
                  <p className="text-lg font-semibold text-red-700 dark:text-red-400">-{formatMetricNumber(metrics.unfollows || 0)}</p>
                  <p className="text-xs text-red-600">Unfollows</p>
                </div>
              </div>
            ) : null}

            {/* Engagement Rate */}
            {metrics.followers > 0 && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 text-center">
                <p className="text-xs text-muted-foreground mb-1">Taxa de Engajamento (28 dias)</p>
                <p className="text-xl font-bold text-primary">
                  {(((metrics.page_engagements || 0) / metrics.followers) * 100).toFixed(2)}%
                </p>
              </div>
            )}
          </>
        )}

        {/* Facebook Page Metrics */}
        {assetType === 'facebook_page' && (metrics.page_reach || metrics.page_impressions) && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border text-center">
              <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_reach || 0)}</p>
              <p className="text-xs text-muted-foreground">Alcance</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_impressions || 0)}</p>
              <p className="text-xs text-muted-foreground">Impressões</p>
            </div>
            <div className="p-3 rounded-lg border text-center">
              <Heart className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{formatMetricNumber(metrics.page_engagements || 0)}</p>
              <p className="text-xs text-muted-foreground">Engajamentos</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
