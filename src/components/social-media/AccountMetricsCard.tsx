import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAccountMetrics, formatLastUpdated } from '@/hooks/useAccountMetrics';
import { formatMetricNumber } from '@/hooks/useSocialMetrics';
import { Users, ImageIcon, Clock, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountMetricsCardProps {
  platformConnectionId: string | null;
}

const ASSET_TYPE_CONFIG: Record<string, { label: string; icon: typeof Instagram; color: string }> = {
  instagram_business: { label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
  facebook_page: { label: 'Facebook Page', icon: Facebook, color: 'bg-blue-600' },
};

export function AccountMetricsCard({ platformConnectionId }: AccountMetricsCardProps) {
  const { assetsMetrics, totalFollowers, totalPosts, lastUpdated } = useAccountMetrics(platformConnectionId);

  if (!platformConnectionId || assetsMetrics.length === 0) {
    return null;
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Métricas da Conta</CardTitle>
            <CardDescription>Dados do perfil conectado</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {formatLastUpdated(lastUpdated ?? null)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMetricNumber(totalFollowers)}</p>
              <p className="text-xs text-muted-foreground">Seguidores Total</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="p-2 rounded-full bg-primary/10">
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatMetricNumber(totalPosts)}</p>
              <p className="text-xs text-muted-foreground">Publicações Total</p>
            </div>
          </div>
        </div>

        {/* Per Asset Breakdown */}
        {assetsMetrics.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Por Plataforma</p>
            <div className="space-y-2">
              {assetsMetrics.map((asset) => {
                const config = ASSET_TYPE_CONFIG[asset.assetType] || { 
                  label: asset.assetType, 
                  icon: Users, 
                  color: 'bg-gray-500' 
                };
                const Icon = config.icon;
                
                return (
                  <div 
                    key={asset.asset_id} 
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-md text-white", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{asset.asset_name}</p>
                        <p className="text-xs text-muted-foreground">{config.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatMetricNumber(asset.followers)}</p>
                      <p className="text-xs text-muted-foreground">seguidores</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
