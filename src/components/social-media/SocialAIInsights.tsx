import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  BarChart3,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  CheckCircle2,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useIndividualAssets, AssetOption } from '@/hooks/useAccountMetrics';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AIInsightsResponse {
  executive_summary?: string;
  growth_analysis?: {
    status: 'growing' | 'stable' | 'declining';
    rate: string;
    interpretation: string;
  };
  engagement_analysis?: {
    status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
    rate: string;
    benchmark_comparison?: string;
    interpretation: string;
  };
  reach_analysis?: {
    reach_rate: string;
    interpretation: string;
  };
  content_insights?: Array<{
    insight: string;
    data_point: string;
    recommendation: string;
  }>;
  opportunities?: Array<{
    title: string;
    description: string;
    potential_impact: 'high' | 'medium' | 'low';
    action_items: string[];
  }>;
  warnings?: Array<{
    title: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }>;
  next_steps?: string[];
  metrics_summary?: Record<string, any>;
}

export function SocialAIInsights() {
  const { currentWorkspace } = useWorkspace();
  const { assets, isLoading: assetsLoading } = useIndividualAssets();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const selectedAsset = assets.find(a => a.asset_external_id === selectedAssetId);

  const generateInsights = async () => {
    if (!currentWorkspace?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await supabase.functions.invoke('social-ai-insights', {
        body: {
          workspace_id: currentWorkspace.id,
          asset_id: selectedAssetId !== 'all' ? selectedAssetId : undefined,
          analysis_type: 'full',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao gerar insights');
      }

      const data = response.data;
      
      if (data.insights) {
        setInsights(data.insights);
        setLastGenerated(new Date());
        toast.success('Insights gerados com sucesso!');
      } else if (data.message) {
        setError(data.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast.error('Erro ao gerar insights', { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate on mount if we have assets
  useEffect(() => {
    if (assets.length > 0 && !insights && !isLoading) {
      generateInsights();
    }
  }, [assets.length]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'growing':
      case 'excellent':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'declining':
      case 'critical':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      case 'good':
        return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
      default:
        return <Minus className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'growing':
      case 'excellent':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'declining':
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'good':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const getImpactColor = (impact?: string) => {
    switch (impact) {
      case 'high':
        return 'bg-green-500';
      case 'medium':
        return 'bg-amber-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-amber-500 bg-amber-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  if (assetsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Conecte uma conta de rede social para gerar insights com IA
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Insights com IA
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Análise profunda baseada em dados reais por nossa IA especialista
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {assets.map((asset) => (
                <SelectItem key={asset.id} value={asset.asset_external_id}>
                  {asset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={generateInsights} 
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            {isLoading ? 'Analisando...' : 'Gerar Insights'}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-medium">Analisando métricas...</p>
                <p className="text-sm text-muted-foreground">
                  Nossa IA está processando seus dados para gerar insights acionáveis
                </p>
              </div>
              <Progress value={33} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights Content */}
      {insights && !isLoading && (
        <div className="grid gap-6">
          {/* Executive Summary */}
          {insights.executive_summary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Resumo Executivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">
                  {insights.executive_summary}
                </p>
                {lastGenerated && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Gerado em {lastGenerated.toLocaleString('pt-BR')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Key Metrics Analysis */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Growth Analysis */}
            {insights.growth_analysis && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Crescimento
                    </CardTitle>
                    {getStatusIcon(insights.growth_analysis.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "inline-flex items-center px-2 py-1 rounded-md text-sm font-medium mb-2 border",
                    getStatusColor(insights.growth_analysis.status)
                  )}>
                    {insights.growth_analysis.rate}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {insights.growth_analysis.interpretation}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Engagement Analysis */}
            {insights.engagement_analysis && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Engajamento
                    </CardTitle>
                    {getStatusIcon(insights.engagement_analysis.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "inline-flex items-center px-2 py-1 rounded-md text-sm font-medium mb-2 border",
                    getStatusColor(insights.engagement_analysis.status)
                  )}>
                    {insights.engagement_analysis.rate}
                  </div>
                  {insights.engagement_analysis.benchmark_comparison && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {insights.engagement_analysis.benchmark_comparison}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {insights.engagement_analysis.interpretation}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Reach Analysis */}
            {insights.reach_analysis && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Alcance
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium mb-2 border bg-blue-100 text-blue-700 border-blue-200">
                    {insights.reach_analysis.reach_rate}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {insights.reach_analysis.interpretation}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Warnings */}
          {insights.warnings && insights.warnings.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.warnings.map((warning, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-4 rounded-lg border-l-4",
                      getSeverityColor(warning.severity)
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{warning.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {warning.severity === 'high' ? 'Alta' : warning.severity === 'medium' ? 'Média' : 'Baixa'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {warning.description}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      💡 {warning.recommendation}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Content Insights */}
          {insights.content_insights && insights.content_insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  Insights de Conteúdo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {insights.content_insights.map((insight, idx) => (
                    <div key={idx} className="p-4 rounded-lg border bg-muted/30">
                      <h4 className="font-medium mb-2">{insight.insight}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        📊 {insight.data_point}
                      </p>
                      <p className="text-sm text-primary font-medium">
                        → {insight.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Opportunities */}
          {insights.opportunities && insights.opportunities.length > 0 && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <Target className="h-5 w-5" />
                  Oportunidades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insights.opportunities.map((opp, idx) => (
                  <div key={idx} className="p-4 rounded-lg border bg-green-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{opp.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Impacto:</span>
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          getImpactColor(opp.potential_impact)
                        )} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {opp.description}
                    </p>
                    {opp.action_items && opp.action_items.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-green-700">Ações:</p>
                        {opp.action_items.map((action, actionIdx) => (
                          <div key={actionIdx} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="h-3 w-3 mt-1 text-green-600 shrink-0" />
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {insights.next_steps && insights.next_steps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Próximos Passos
                </CardTitle>
                <CardDescription>
                  Ações prioritárias recomendadas pela IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.next_steps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                        {idx + 1}
                      </div>
                      <span className="text-sm">{step}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
