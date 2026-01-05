import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSocialMetrics, useTopPosts, formatMetricNumber } from '@/hooks/useSocialMetrics';
import { useClients } from '@/hooks/useClients';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { useConnectedAccountsWithMetrics } from '@/hooks/useAccountMetrics';
import { EntitlementGate } from '@/components/billing/EntitlementGate';
import { EmptyPlatformState } from './EmptyPlatformState';
import { AccountMetricsCard } from './AccountMetricsCard';
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
  TrendingUp,
  TrendingDown,
  Minus,
  Instagram,
  Facebook,
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
  const { data: connectedAccounts } = useConnectedAccountsWithMetrics();
  
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  const hasConnectedPlatforms = connectedPlatforms && connectedPlatforms.length > 0;

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
    
    return {
      clientId: selectedClient !== 'all' ? selectedClient : undefined,
      startDate,
      platformConnectionId: selectedAccount !== 'all' ? selectedAccount : undefined,
      platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
    };
  };

  const filters = getDateFilters();
  const { summary, platformMetrics, contentTypeMetrics, isLoading } = useSocialMetrics(filters);
  const { data: topPosts } = useTopPosts(5, filters);

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

  // Transform platform metrics for chart
  const platformBreakdown = platformMetrics.map(pm => ({
    platform: pm.platform,
    engagement: pm.likes + pm.comments + pm.shares,
  }));

  // Transform content type metrics for chart
  const contentTypeBreakdown = contentTypeMetrics.map(ct => ({
    type: ct.contentType,
    count: ct.posts,
  }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Account Selector - Primary Filter */}
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecionar conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {connectedAccounts?.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center">
                  {getPlatformIcon(account.platform)}
                  <span>{account.account_name}</span>
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
      </div>

      {/* Account Metrics Card - Shows when specific account is selected */}
      {selectedAccount !== 'all' && (
        <AccountMetricsCard platformConnectionId={selectedAccount} />
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Alcance Total"
          value={summary.totalReach}
          icon={Eye}
        />
        <MetricCard
          title="Impressões"
          value={summary.totalImpressions}
          icon={Users}
        />
        <MetricCard
          title="Curtidas"
          value={summary.totalLikes}
          icon={Heart}
        />
        <MetricCard
          title="Comentários"
          value={summary.totalComments}
          icon={MessageCircle}
        />
        <MetricCard
          title="Taxa de Engajamento"
          value={summary.avgEngagementRate}
          icon={TrendingUp}
          format="percent"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance por Plataforma</CardTitle>
            <CardDescription>Engajamento total por rede social</CardDescription>
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
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
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
              <p className="text-center text-muted-foreground py-8">
                Nenhum post publicado no período selecionado
              </p>
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
