import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSocialMetrics, useTopPosts, formatMetricNumber } from '@/hooks/useSocialMetrics';
import { useClients } from '@/hooks/useClients';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { useIndividualAssets, useConnectedAccountsWithMetrics } from '@/hooks/useAccountMetrics';
import { EntitlementGate } from '@/components/billing/EntitlementGate';
import { EmptyPlatformState } from './EmptyPlatformState';
import { AccountMetricsCard } from './AccountMetricsCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Eye,
  Users,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
  Instagram,
  Facebook,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
};

const CONTENT_TYPE_COLORS = [
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
];

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: number;
  format?: 'number' | 'percent' | 'decimal';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, trend, format = 'number' }) => {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    if (format === 'percent') return `${val.toFixed(1)}%`;
    if (format === 'decimal') return val.toFixed(2);
    return formatMetricNumber(val);
  };

  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? 'text-green-600' : trend && trend < 0 ? 'text-red-600' : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{formatValue(value)}</p>
          </div>
          <div className={cn("p-3 rounded-full bg-primary/10", "text-primary")}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={cn("flex items-center gap-1 mt-2 text-sm", trendColor)}>
            <TrendIcon className="h-4 w-4" />
            <span>{Math.abs(trend).toFixed(1)}%</span>
            <span className="text-muted-foreground">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

type DateRange = '7d' | '30d' | '90d';

export function MetricsDashboard() {
  const { has } = useEntitlementRegistry();
  const { data: clients } = useClients();
  const { data: connectedPlatforms, isLoading: platformsLoading } = useSocialPlatforms();
  const { assets: individualAssets } = useIndividualAssets();
  const { data: accountMetrics, isLoading: metricsLoading } = useConnectedAccountsWithMetrics();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const syncedAssetsRef = useRef<Set<string>>(new Set());

  const hasConnectedPlatforms = connectedPlatforms && connectedPlatforms.length > 0;

  // Check if selected asset has metrics
  const selectedAssetHasMetrics = React.useMemo(() => {
    if (selectedAsset === 'all') return true;
    
    const asset = individualAssets?.find(a => a.id === selectedAsset);
    if (!asset) return true;
    
    // Check if there are metrics for this asset's connection
    const connection = accountMetrics?.find(c => c.id === asset.platform_connection_id);
    if (!connection?.account_metrics) return false;
    
    // Check if we have data for this specific asset
    const assetMetrics = connection.account_metrics as Record<string, unknown>;
    return Object.keys(assetMetrics).length > 0;
  }, [selectedAsset, individualAssets, accountMetrics]);

  // Auto-sync when selecting an asset that has no metrics
  const syncAssetMetrics = useCallback(async (assetId: string) => {
    if (syncedAssetsRef.current.has(assetId)) return;
    
    syncedAssetsRef.current.add(assetId);
    setIsSyncing(true);
    
    try {
      await supabase.functions.invoke('social-metrics-sync', { 
        body: { asset_id: assetId, force: true } 
      });
      
      await queryClient.invalidateQueries({ queryKey: ['connected-accounts-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-assets'] });
    } catch (error) {
      console.error('Auto-sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  // Trigger auto-sync when asset is selected without metrics
  useEffect(() => {
    if (selectedAsset !== 'all' && !selectedAssetHasMetrics && !isSyncing) {
      syncAssetMetrics(selectedAsset);
    }
  }, [selectedAsset, selectedAssetHasMetrics, isSyncing, syncAssetMetrics]);

  // Calculate metrics based on selected asset or aggregate all
  const selectedAccountMetrics = React.useMemo(() => {
    if (!accountMetrics || accountMetrics.length === 0) {
      return { 
        totalFollowers: 0, totalReach: 0, totalImpressions: 0, totalEngagements: 0, 
        postsCount: 0, likesCount: 0, commentsCount: 0, sharesCount: 0,
        accountsEngaged: 0, follows: 0, unfollows: 0
      };
    }

    // If a specific asset is selected, find its metrics
    if (selectedAsset !== 'all') {
      const asset = individualAssets?.find(a => a.id === selectedAsset);
      if (asset) {
        for (const account of accountMetrics) {
          if (!account.account_metrics) continue;
          
          for (const [, metrics] of Object.entries(account.account_metrics)) {
            const m = metrics as unknown as { 
              asset_id?: string;
              followers?: number; 
              page_reach?: number; 
              page_impressions?: number; 
              page_engagements?: number;
              posts_count?: number;
              likes_count?: number;
              comments_count?: number;
              shares_count?: number;
              accounts_engaged?: number;
              follows?: number;
              unfollows?: number;
            };
            if (m.asset_id === asset.asset_external_id) {
              return {
                totalFollowers: m.followers || 0,
                totalReach: m.page_reach || 0,
                totalImpressions: m.page_impressions || 0,
                totalEngagements: m.page_engagements || 0,
                postsCount: m.posts_count || 0,
                likesCount: m.likes_count || 0,
                commentsCount: m.comments_count || 0,
                sharesCount: m.shares_count || 0,
                accountsEngaged: m.accounts_engaged || 0,
                follows: m.follows || 0,
                unfollows: m.unfollows || 0,
              };
            }
          }
        }
      }
    }

    // Aggregate all metrics
    let totalFollowers = 0, totalReach = 0, totalImpressions = 0, totalEngagements = 0;
    let postsCount = 0, likesCount = 0, commentsCount = 0, sharesCount = 0;
    let accountsEngaged = 0, follows = 0, unfollows = 0;
    const seen = new Set<string>();

    for (const account of accountMetrics) {
      if (!account.account_metrics) continue;
      
      for (const [, metrics] of Object.entries(account.account_metrics)) {
        const m = metrics as unknown as { 
          asset_id?: string;
          followers?: number; 
          page_reach?: number; 
          page_impressions?: number; 
          page_engagements?: number;
          posts_count?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          accounts_engaged?: number;
          follows?: number;
          unfollows?: number;
        };
        
        // Deduplicate by asset_id
        if (m.asset_id && seen.has(m.asset_id)) continue;
        if (m.asset_id) seen.add(m.asset_id);
        
        totalFollowers += m.followers || 0;
        totalReach += m.page_reach || 0;
        totalImpressions += m.page_impressions || 0;
        totalEngagements += m.page_engagements || 0;
        postsCount += m.posts_count || 0;
        likesCount += m.likes_count || 0;
        commentsCount += m.comments_count || 0;
        sharesCount += m.shares_count || 0;
        accountsEngaged += m.accounts_engaged || 0;
        follows += m.follows || 0;
        unfollows += m.unfollows || 0;
      }
    }

    return { 
      totalFollowers, totalReach, totalImpressions, totalEngagements, 
      postsCount, likesCount, commentsCount, sharesCount,
      accountsEngaged, follows, unfollows
    };
  }, [accountMetrics, selectedAsset, individualAssets]);

  // Handle manual sync - optionally filter by selected asset
  const handleSyncMetrics = async () => {
    setIsSyncing(true);
    try {
      // Build request body with optional asset filter
      const body: { asset_id?: string; force?: boolean } = { force: true };
      if (selectedAsset !== 'all') {
        body.asset_id = selectedAsset;
      }
      
      const { data, error } = await supabase.functions.invoke('social-metrics-sync', { body });
      
      if (error) throw error;
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['connected-accounts-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['social-metrics-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['social-top-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-assets'] });
      
      const accountName = selectedAsset !== 'all' 
        ? individualAssets?.find(a => a.id === selectedAsset)?.name 
        : null;
      
      toast({
        title: "Sincronização concluída",
        description: accountName 
          ? `Métricas de ${accountName} atualizadas.`
          : `${data?.accounts_synced || 0} contas sincronizadas.`,
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar as métricas. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate date filters
  const getDateFilters = () => {
    const now = new Date();
    let startDate: string;
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Find the platform_connection_id for the selected asset
    const selectedAssetData = selectedAsset !== 'all' 
      ? individualAssets?.find(a => a.id === selectedAsset)
      : null;
    
    return {
      clientId: selectedClient !== 'all' ? selectedClient : undefined,
      startDate,
      platformConnectionId: selectedAssetData?.platform_connection_id,
      platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
    };
  };

  const filters = getDateFilters();
  const { summary, platformMetrics, contentTypeMetrics, isLoading, posts } = useSocialMetrics(filters);
  const { data: topPosts } = useTopPosts(5, filters);

  // Check if we have real data
  const hasPostData = posts && posts.length > 0;
  const hasAccountData = selectedAccountMetrics.totalFollowers > 0;

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="h-4 w-4 mr-2 text-pink-500" />;
      case 'facebook': return <Facebook className="h-4 w-4 mr-2 text-blue-600" />;
      default: return null;
    }
  };

  const hasBasicMetrics = has('social_metrics_basic');

  if (!hasBasicMetrics) {
    return (
      <EntitlementGate entitlementKey="social_metrics_basic">
        <div />
      </EntitlementGate>
    );
  }

  // Show empty state if no platforms connected
  if (!platformsLoading && !hasConnectedPlatforms) {
    return <EmptyPlatformState context="metrics" />;
  }

  // Transform platform metrics for chart - use account data if no post data
  const platformBreakdown = hasPostData 
    ? platformMetrics.map(pm => ({
        platform: pm.platform,
        engagement: pm.likes + pm.comments + pm.shares,
      }))
    : individualAssets?.reduce((acc, asset) => {
        const existing = acc.find(a => a.platform === asset.platform);
        if (existing) {
          existing.engagement += asset.followers;
        } else {
          acc.push({ platform: asset.platform, engagement: asset.followers });
        }
        return acc;
      }, [] as { platform: string; engagement: number }[]) || [];

  // Transform content type metrics for chart
  const contentTypeBreakdown = contentTypeMetrics.map(ct => ({
    type: ct.contentType,
    count: ct.posts,
  }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Asset Selector - Shows each Instagram/Facebook individually */}
        <Select value={selectedAsset} onValueChange={setSelectedAsset}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecionar conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {individualAssets?.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                <div className="flex items-center">
                  {getPlatformIcon(asset.platform)}
                  <span>{asset.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh Button - subtle, for force update */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSyncMetrics}
          disabled={isSyncing}
          className="ml-auto"
          title="Atualizar métricas"
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
        </Button>
      </div>

      {/* Loading indicator when syncing */}
      {isSyncing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Sincronizando métricas...</span>
        </div>
      )}

      {/* Account Metrics Card - Shows when specific asset is selected */}
      {selectedAsset !== 'all' && (() => {
        const assetData = individualAssets?.find(a => a.id === selectedAsset);
        return assetData ? (
          <AccountMetricsCard 
            assetId={selectedAsset} 
            platformConnectionId={assetData.platform_connection_id} 
          />
        ) : null;
      })()}

      {/* KPI Cards - Show account metrics if no post data */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title={selectedAsset !== 'all' ? "Seguidores" : "Seguidores Totais"}
          value={hasAccountData ? selectedAccountMetrics.totalFollowers : summary.totalReach}
          icon={Users}
        />
        <MetricCard
          title="Publicações"
          value={selectedAccountMetrics.postsCount || 0}
          icon={Eye}
        />
        <MetricCard
          title="Alcance (28 dias)"
          value={selectedAccountMetrics.totalReach}
          icon={Eye}
        />
        <MetricCard
          title="Views (28 dias)"
          value={selectedAccountMetrics.totalImpressions}
          icon={Eye}
        />
        <MetricCard
          title="Taxa de Engajamento"
          value={selectedAccountMetrics.totalFollowers > 0 
            ? (selectedAccountMetrics.totalEngagements / selectedAccountMetrics.totalFollowers) * 100 
            : 0}
          icon={TrendingUp}
          format="percent"
        />
      </div>

      {/* Engagement Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <MetricCard
          title="Curtidas"
          value={selectedAccountMetrics.likesCount}
          icon={Heart}
        />
        <MetricCard
          title="Comentários"
          value={selectedAccountMetrics.commentsCount}
          icon={MessageCircle}
        />
        <MetricCard
          title="Compartilhamentos"
          value={selectedAccountMetrics.sharesCount}
          icon={Share2}
        />
        <MetricCard
          title="Contas Engajadas"
          value={selectedAccountMetrics.accountsEngaged}
          icon={Users}
        />
        <MetricCard
          title="Novos Seguidores"
          value={selectedAccountMetrics.follows}
          icon={UserPlus}
          trend={selectedAccountMetrics.follows > selectedAccountMetrics.unfollows ? 1 : -1}
        />
        <MetricCard
          title="Crescimento Líquido"
          value={selectedAccountMetrics.follows - selectedAccountMetrics.unfollows}
          icon={TrendingUp}
          trend={selectedAccountMetrics.follows - selectedAccountMetrics.unfollows}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {hasPostData ? 'Performance por Plataforma' : 'Seguidores por Plataforma'}
            </CardTitle>
            <CardDescription>
              {hasPostData ? 'Engajamento total por rede social' : 'Distribuição de seguidores'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {platformBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="platform" type="category" width={80} />
                    <Tooltip
                      formatter={(value: number) => value.toLocaleString('pt-BR')}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar
                      dataKey="engagement"
                      radius={[0, 4, 4, 0]}
                      fill="hsl(var(--primary))"
                    >
                      {platformBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PLATFORM_COLORS[entry.platform] || 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tipo de Conteúdo</CardTitle>
            <CardDescription>Distribuição por formato</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {contentTypeBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={contentTypeBreakdown}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {contentTypeBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CONTENT_TYPE_COLORS[index % CONTENT_TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Minus className="h-8 w-8" />
                  <p>Publique posts para ver esta distribuição</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Posts do Período</CardTitle>
          <CardDescription>Posts com maior engajamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(!topPosts || topPosts.length === 0) && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Minus className="h-8 w-8" />
                <p>Nenhum post publicado no período selecionado</p>
              </div>
            )}
            {topPosts?.slice(0, 5).map((post, index) => (
              <div
                key={post.id}
                className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {post.caption?.substring(0, 60) || 'Sem legenda'}...
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {post.platform}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {formatMetricNumber(post.metrics?.reach || 0)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    {formatMetricNumber(post.metrics?.likes || 0)}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    {formatMetricNumber(post.metrics?.comments || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
