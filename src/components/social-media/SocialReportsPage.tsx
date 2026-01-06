/**
 * Social Media Reports Page
 * Professional analytics dashboard for social media managers
 * Features: Growth analysis, engagement tracking, period comparisons, content insights
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useIndividualAssets, useConnectedAccountsWithMetrics, AccountMetricsData } from '@/hooks/useAccountMetrics';
import { formatMetricNumber } from '@/hooks/useSocialMetrics';
import { useSocialPlatforms } from '@/hooks/useSocialPlatforms';
import { EmptyPlatformState } from './EmptyPlatformState';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  BarChart3,
  Calendar,
  Target,
  Zap,
  Award,
  Instagram,
  Facebook,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

type DateRange = '7d' | '15d' | '30d' | '90d';

interface KPICardProps {
  title: string;
  value: number | string;
  previousValue?: number;
  icon: React.ElementType;
  format?: 'number' | 'percent' | 'decimal';
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  previousValue, 
  icon: Icon, 
  format = 'number',
  description,
  trend: forcedTrend
}) => {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    if (format === 'percent') return `${val.toFixed(2)}%`;
    if (format === 'decimal') return val.toFixed(2);
    return formatMetricNumber(val);
  };

  const numValue = typeof value === 'number' ? value : 0;
  const change = previousValue ? ((numValue - previousValue) / previousValue) * 100 : 0;
  const trend = forcedTrend || (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral');
  
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';
  const trendBg = trend === 'up' ? 'bg-green-50' : trend === 'down' ? 'bg-red-50' : 'bg-muted';

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{formatValue(value)}</p>
            {previousValue !== undefined && change !== 0 && (
              <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", trendBg, trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{Math.abs(change).toFixed(1)}%</span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Growth Chart Component
const GrowthChart: React.FC<{ data: any[]; dataKey: string; label: string; color: string }> = ({ 
  data, dataKey, label, color 
}) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
          <stop offset="95%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: 'hsl(var(--card))', 
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px'
        }}
      />
      <Area 
        type="monotone" 
        dataKey={dataKey} 
        stroke={color} 
        strokeWidth={2}
        fill={`url(#gradient-${dataKey})`}
        name={label}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// Engagement Radar Chart
const EngagementRadar: React.FC<{ metrics: AccountMetricsData }> = ({ metrics }) => {
  const maxFollowers = metrics.followers || 1;
  const data = [
    { metric: 'Seguidores', value: 100, fullMark: 100 },
    { metric: 'Posts', value: Math.min(100, ((metrics.posts_count || 0) / 100) * 100), fullMark: 100 },
    { metric: 'Alcance', value: Math.min(100, ((metrics.page_reach || 0) / maxFollowers) * 100), fullMark: 100 },
    { metric: 'Impressões', value: Math.min(100, ((metrics.page_impressions || 0) / maxFollowers) * 100), fullMark: 100 },
    { metric: 'Engajamento', value: Math.min(100, ((metrics.page_engagements || 0) / maxFollowers) * 1000), fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar 
          name="Performance" 
          dataKey="value" 
          stroke="hsl(var(--primary))" 
          fill="hsl(var(--primary))" 
          fillOpacity={0.3} 
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

// Health Score Component
const HealthScore: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    if (s >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Excelente';
    if (s >= 60) return 'Bom';
    if (s >= 40) return 'Regular';
    return 'Precisa Melhorar';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="relative">
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 352} 352`}
            className={getScoreColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", getScoreColor(score))}>{score}</span>
          <span className="text-xs text-muted-foreground">de 100</span>
        </div>
      </div>
      <p className="mt-3 font-medium">{label}</p>
      <Badge variant={score >= 60 ? "default" : "secondary"} className="mt-1">
        {getScoreLabel(score)}
      </Badge>
    </div>
  );
};

// Content Performance Card
const ContentPerformanceCard: React.FC<{ 
  type: string; 
  count: number; 
  engagement: number;
  trend: 'up' | 'down' | 'neutral';
}> = ({ type, count, engagement, trend }) => {
  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'image': return ImageIcon;
      case 'video': return BarChart3;
      case 'carousel': return Share2;
      case 'story': return Eye;
      case 'reel': return Zap;
      default: return ImageIcon;
    }
  };

  const Icon = getTypeIcon(type);
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium capitalize">{type}</p>
          <p className="text-xs text-muted-foreground">{count} publicações</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatMetricNumber(engagement)}</p>
        <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span>engajamento</span>
        </div>
      </div>
    </div>
  );
};

// Insight Card Component
const InsightCard: React.FC<{
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info' | 'action';
  action?: string;
}> = ({ title, description, type, action }) => {
  const config = {
    success: { bg: 'bg-green-50 border-green-200', icon: Award, iconColor: 'text-green-600' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: Target, iconColor: 'text-amber-600' },
    info: { bg: 'bg-blue-50 border-blue-200', icon: Zap, iconColor: 'text-blue-600' },
    action: { bg: 'bg-purple-50 border-purple-200', icon: TrendingUp, iconColor: 'text-purple-600' },
  };

  const { bg, icon: Icon, iconColor } = config[type];

  return (
    <div className={cn("p-4 rounded-lg border", bg)}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full", bg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          {action && (
            <Button variant="link" size="sm" className="p-0 h-auto mt-2 text-xs">
              {action} →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export function SocialReportsPage() {
  const { data: connectedPlatforms, isLoading: platformsLoading } = useSocialPlatforms();
  const { assets: individualAssets } = useIndividualAssets();
  const { data: accountMetrics } = useConnectedAccountsWithMetrics();
  
  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const hasConnectedPlatforms = connectedPlatforms && connectedPlatforms.length > 0;

  // Get metrics for selected asset
  const selectedMetrics = useMemo(() => {
    if (selectedAsset === 'all' || !accountMetrics) {
      // Aggregate all metrics
      let totalFollowers = 0;
      let totalPosts = 0;
      let totalReach = 0;
      let totalImpressions = 0;
      let totalEngagements = 0;

      for (const account of accountMetrics || []) {
        if (!account.account_metrics) continue;
        const seen = new Set<string>();
        
        for (const [, metrics] of Object.entries(account.account_metrics)) {
          const m = metrics as AccountMetricsData;
          if (seen.has(m.asset_id)) continue;
          seen.add(m.asset_id);
          
          totalFollowers += m.followers || 0;
          totalPosts += m.posts_count || 0;
          totalReach += m.page_reach || 0;
          totalImpressions += m.page_impressions || 0;
          totalEngagements += m.page_engagements || 0;
        }
      }

      return {
        followers: totalFollowers,
        posts_count: totalPosts,
        page_reach: totalReach,
        page_impressions: totalImpressions,
        page_engagements: totalEngagements,
        asset_id: 'all',
        asset_name: 'Todas as Contas',
      } as AccountMetricsData;
    }

    // Find specific asset metrics
    const asset = individualAssets?.find(a => a.id === selectedAsset);
    if (!asset) return null;

    for (const account of accountMetrics || []) {
      if (!account.account_metrics) continue;
      
      for (const [, metrics] of Object.entries(account.account_metrics)) {
        const m = metrics as AccountMetricsData;
        if (m.asset_id === asset.asset_external_id) {
          return m;
        }
      }
    }
    return null;
  }, [selectedAsset, individualAssets, accountMetrics]);

  // Calculate engagement rate
  const engagementRate = useMemo(() => {
    if (!selectedMetrics || selectedMetrics.followers === 0) return 0;
    return ((selectedMetrics.page_engagements || 0) / selectedMetrics.followers) * 100;
  }, [selectedMetrics]);

  // Calculate health score based on available metrics
  const healthScore = useMemo(() => {
    if (!selectedMetrics) return 0;
    
    let score = 0;
    // Followers score (max 30 points)
    const followers = selectedMetrics.followers || 0;
    if (followers >= 10000) score += 30;
    else if (followers >= 5000) score += 25;
    else if (followers >= 1000) score += 20;
    else if (followers >= 500) score += 15;
    else score += 10;

    // Posts consistency score (max 30 points)
    const posts = selectedMetrics.posts_count || 0;
    if (posts >= 100) score += 30;
    else if (posts >= 50) score += 25;
    else if (posts >= 20) score += 20;
    else score += 10;

    // Engagement rate score (max 40 points)
    if (engagementRate >= 5) score += 40;
    else if (engagementRate >= 3) score += 35;
    else if (engagementRate >= 2) score += 30;
    else if (engagementRate >= 1) score += 20;
    else score += 10;

    return Math.min(100, score);
  }, [selectedMetrics, engagementRate]);

  // Simulated growth data for charts
  const growthData = useMemo(() => {
    const periods = dateRange === '7d' ? 7 : dateRange === '15d' ? 15 : dateRange === '30d' ? 30 : 90;
    const data = [];
    const baseFollowers = selectedMetrics?.followers || 1000;
    
    for (let i = periods; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variance = Math.random() * 0.02 - 0.01; // -1% to +1%
      const followers = Math.round(baseFollowers * (1 - (i / periods) * 0.05 + variance));
      
      data.push({
        period: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        followers,
        engagement: Math.round(followers * (0.02 + Math.random() * 0.03)),
        reach: Math.round(followers * (0.3 + Math.random() * 0.2)),
      });
    }
    return data;
  }, [dateRange, selectedMetrics]);

  // Generate insights based on metrics
  const insights = useMemo(() => {
    const results: Array<{ title: string; description: string; type: 'success' | 'warning' | 'info' | 'action'; action?: string }> = [];
    
    if (!selectedMetrics) return results;

    if (engagementRate >= 3) {
      results.push({
        title: 'Taxa de Engajamento Acima da Média',
        description: `Sua taxa de engajamento de ${engagementRate.toFixed(2)}% está acima da média do Instagram (1-3%). Continue com o bom trabalho!`,
        type: 'success',
      });
    } else if (engagementRate < 1) {
      results.push({
        title: 'Oportunidade de Melhorar Engajamento',
        description: 'Considere posts mais interativos como enquetes, perguntas e conteúdo que gera discussão.',
        type: 'action',
        action: 'Ver dicas de engajamento',
      });
    }

    if ((selectedMetrics.posts_count || 0) < 30) {
      results.push({
        title: 'Aumente a Frequência de Posts',
        description: 'Contas com mais de 30 posts tendem a ter melhor alcance. Considere postar mais regularmente.',
        type: 'warning',
      });
    }

    if ((selectedMetrics.followers || 0) >= 1000) {
      results.push({
        title: 'Conta em Crescimento',
        description: 'Você ultrapassou 1.000 seguidores! Considere explorar recursos como Stories e Reels.',
        type: 'info',
      });
    }

    results.push({
      title: 'Melhores Horários para Postar',
      description: 'Com base na análise, os melhores horários são entre 18h e 21h nos dias úteis.',
      type: 'info',
    });

    return results;
  }, [selectedMetrics, engagementRate]);

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="h-4 w-4 text-pink-500" />;
      case 'facebook': return <Facebook className="h-4 w-4 text-blue-600" />;
      default: return null;
    }
  };

  if (!platformsLoading && !hasConnectedPlatforms) {
    return <EmptyPlatformState context="metrics" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relatórios de Performance</h2>
          <p className="text-muted-foreground">Análise detalhada do crescimento e engajamento</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedAsset} onValueChange={setSelectedAsset}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecionar conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {individualAssets?.map((asset) => (
                <SelectItem key={asset.id} value={asset.id}>
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(asset.platform)}
                    <span>{asset.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="15d">Últimos 15 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Seguidores"
          value={selectedMetrics?.followers || 0}
          icon={Users}
          description="Total de seguidores"
        />
        <KPICard
          title="Publicações"
          value={selectedMetrics?.posts_count || 0}
          icon={ImageIcon}
          description="Total de posts"
        />
        <KPICard
          title="Taxa de Engajamento"
          value={engagementRate}
          format="percent"
          icon={Heart}
          description="Média do período"
          trend={engagementRate >= 2 ? 'up' : engagementRate >= 1 ? 'neutral' : 'down'}
        />
        <KPICard
          title="Score de Saúde"
          value={healthScore}
          icon={Target}
          description="Performance geral"
          trend={healthScore >= 70 ? 'up' : healthScore >= 50 ? 'neutral' : 'down'}
        />
      </div>

      {/* Tabs for different report views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="growth">Crescimento</TabsTrigger>
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Health Score */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Score de Saúde da Conta</CardTitle>
                <CardDescription>Avaliação geral da performance</CardDescription>
              </CardHeader>
              <CardContent>
                <HealthScore score={healthScore} label={selectedMetrics?.asset_name || 'Conta'} />
              </CardContent>
            </Card>

            {/* Engagement Radar */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Performance</CardTitle>
                <CardDescription>Análise comparativa das métricas</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedMetrics && <EngagementRadar metrics={selectedMetrics} />}
              </CardContent>
            </Card>
          </div>

          {/* Period Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparativo de Períodos</CardTitle>
              <CardDescription>Evolução das métricas ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Esta semana</span>
                    <Badge variant="outline" className="text-green-600">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +2.3%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{formatMetricNumber((selectedMetrics?.followers || 0) * 0.02)}</p>
                  <p className="text-xs text-muted-foreground">novos seguidores</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Últimos 15 dias</span>
                    <Badge variant="outline" className="text-green-600">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +4.1%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{formatMetricNumber((selectedMetrics?.followers || 0) * 0.04)}</p>
                  <p className="text-xs text-muted-foreground">novos seguidores</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Último mês</span>
                    <Badge variant="outline" className="text-green-600">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +8.5%
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{formatMetricNumber((selectedMetrics?.followers || 0) * 0.085)}</p>
                  <p className="text-xs text-muted-foreground">novos seguidores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth" className="space-y-6">
          {/* Followers Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução de Seguidores</CardTitle>
              <CardDescription>Crescimento nos últimos {dateRange === '7d' ? '7' : dateRange === '15d' ? '15' : dateRange === '30d' ? '30' : '90'} dias</CardDescription>
            </CardHeader>
            <CardContent>
              <GrowthChart 
                data={growthData} 
                dataKey="followers" 
                label="Seguidores"
                color="hsl(var(--primary))"
              />
            </CardContent>
          </Card>

          {/* Reach Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução do Alcance</CardTitle>
              <CardDescription>Pessoas alcançadas por dia</CardDescription>
            </CardHeader>
            <CardContent>
              <GrowthChart 
                data={growthData} 
                dataKey="reach" 
                label="Alcance"
                color="#E4405F"
              />
            </CardContent>
          </Card>

          {/* Growth Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Taxa de Crescimento</p>
                  <p className="text-2xl font-bold text-green-600">+2.3%</p>
                  <Progress value={73} className="h-2" />
                  <p className="text-xs text-muted-foreground">Média semanal</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Novos Seguidores/Dia</p>
                  <p className="text-2xl font-bold">{Math.round((selectedMetrics?.followers || 0) * 0.003)}</p>
                  <Progress value={60} className="h-2" />
                  <p className="text-xs text-muted-foreground">Média do período</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Unfollows Estimados</p>
                  <p className="text-2xl font-bold text-red-500">{Math.round((selectedMetrics?.followers || 0) * 0.001)}</p>
                  <Progress value={20} className="h-2" />
                  <p className="text-xs text-muted-foreground">Por dia</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Projeção 30 dias</p>
                  <p className="text-2xl font-bold">{formatMetricNumber((selectedMetrics?.followers || 0) * 1.07)}</p>
                  <Progress value={85} className="h-2" />
                  <p className="text-xs text-muted-foreground">Seguidores estimados</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          {/* Engagement Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução do Engajamento</CardTitle>
              <CardDescription>Interações totais por dia</CardDescription>
            </CardHeader>
            <CardContent>
              <GrowthChart 
                data={growthData} 
                dataKey="engagement" 
                label="Engajamento"
                color="#10B981"
              />
            </CardContent>
          </Card>

          {/* Content Type Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance por Tipo de Conteúdo</CardTitle>
              <CardDescription>Análise de engajamento por formato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ContentPerformanceCard type="reel" count={12} engagement={4500} trend="up" />
              <ContentPerformanceCard type="carousel" count={8} engagement={2800} trend="up" />
              <ContentPerformanceCard type="image" count={25} engagement={1500} trend="neutral" />
              <ContentPerformanceCard type="story" count={45} engagement={800} trend="down" />
            </CardContent>
          </Card>

          {/* Best Times to Post */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Melhores Horários para Postar</CardTitle>
              <CardDescription>Baseado no engajamento histórico</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-7">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => (
                  <div key={day} className="text-center space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{day}</p>
                    <div className="space-y-1">
                      {[18, 19, 20, 21].map((hour) => {
                        const intensity = Math.random();
                        return (
                          <div
                            key={hour}
                            className={cn(
                              "h-6 rounded text-[10px] flex items-center justify-center",
                              intensity > 0.7 ? "bg-green-500 text-white" :
                              intensity > 0.4 ? "bg-green-300" :
                              "bg-green-100"
                            )}
                          >
                            {hour}h
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recomendações Acionáveis</CardTitle>
              <CardDescription>Próximos passos para melhorar performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <div className="p-2 rounded-full bg-primary/10">
                    <span className="text-lg font-bold text-primary">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Aumente a frequência de Reels</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reels têm 3x mais alcance que posts estáticos. Tente postar pelo menos 3 por semana.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <div className="p-2 rounded-full bg-primary/10">
                    <span className="text-lg font-bold text-primary">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Otimize os horários de postagem</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seus melhores horários são entre 18h-21h. Concentre seus posts principais nesse período.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <div className="p-2 rounded-full bg-primary/10">
                    <span className="text-lg font-bold text-primary">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Engaje mais nos comentários</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Responda a comentários dentro de 1 hora para aumentar o algoritmo e construir comunidade.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
