import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Heart, 
  HeartCrack, 
  HeartPulse, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { subDays, subHours } from 'date-fns';

interface WebhookHealth {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  score: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    deliveryRate24h: number;
    deliveryRate7d: number;
    avgResponseTime: number;
    failedCount24h: number;
    successCount24h: number;
    totalCount24h: number;
  };
}

export function WebhookHealthScore() {
  const { currentWorkspace } = useWorkspace();

  const { data: webhookHealth, isLoading } = useQuery({
    queryKey: ['webhook-health', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get all webhooks (using safe view)
      const { data: subscriptions } = await supabase
        .from('webhook_subscriptions_safe')
        .select('id, name, url, is_active')
        .eq('workspace_id', currentWorkspace.id);

      if (!subscriptions?.length) return [];

      const now = new Date();
      const yesterday = subDays(now, 1);
      const lastWeek = subDays(now, 7);

      const healthResults: WebhookHealth[] = [];

      for (const sub of subscriptions) {
        // Get deliveries for this webhook
        const { data: deliveries } = await supabase
          .from('webhook_deliveries')
          .select('response_status, created_at, delivered_at')
          .eq('subscription_id', sub.id)
          .gte('created_at', lastWeek.toISOString())
          .order('created_at', { ascending: false });

        const deliveries24h = (deliveries || []).filter(
          d => new Date(d.created_at) >= yesterday
        );
        const deliveries7d = deliveries || [];

        // Calculate metrics
        const successCount24h = deliveries24h.filter(
          d => d.response_status !== null && d.response_status >= 200 && d.response_status < 300
        ).length;
        const failedCount24h = deliveries24h.filter(
          d => d.response_status === null || d.response_status >= 400
        ).length;
        const totalCount24h = deliveries24h.length;

        const successCount7d = deliveries7d.filter(
          d => d.response_status !== null && d.response_status >= 200 && d.response_status < 300
        ).length;
        const totalCount7d = deliveries7d.length;

        const deliveryRate24h = totalCount24h > 0 
          ? Math.round((successCount24h / totalCount24h) * 100) 
          : 100;
        const deliveryRate7d = totalCount7d > 0 
          ? Math.round((successCount7d / totalCount7d) * 100) 
          : 100;

        // Calculate avg response time from successful deliveries
        const successfulWithTime = deliveries24h.filter(
          d => d.delivered_at && d.response_status !== null && d.response_status >= 200 && d.response_status < 300
        );
        const avgResponseTime = successfulWithTime.length > 0
          ? Math.round(
              successfulWithTime.reduce((acc, d) => {
                const created = new Date(d.created_at).getTime();
                const delivered = new Date(d.delivered_at!).getTime();
                return acc + (delivered - created);
              }, 0) / successfulWithTime.length
            )
          : 0;

        // Calculate health score (0-100)
        let score = 100;
        
        // Penalize based on delivery rate
        if (deliveryRate24h < 100) score -= (100 - deliveryRate24h) * 0.5;
        if (deliveryRate7d < 100) score -= (100 - deliveryRate7d) * 0.3;
        
        // Penalize based on recent failures
        if (failedCount24h > 0) score -= Math.min(failedCount24h * 5, 20);
        
        // Penalize slow response times (>5s)
        if (avgResponseTime > 5000) score -= 10;
        else if (avgResponseTime > 2000) score -= 5;

        // Determine status
        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (score >= 80) status = 'healthy';
        else if (score >= 50) status = 'degraded';
        else status = 'unhealthy';

        healthResults.push({
          id: sub.id,
          name: sub.name,
          url: sub.url,
          isActive: sub.is_active,
          score: Math.max(0, Math.round(score)),
          status,
          metrics: {
            deliveryRate24h,
            deliveryRate7d,
            avgResponseTime,
            failedCount24h,
            successCount24h,
            totalCount24h,
          },
        });
      }

      return healthResults;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Heart className="h-5 w-5 text-green-500 fill-green-500" />;
      case 'degraded':
        return <HeartPulse className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <HeartCrack className="h-5 w-5 text-red-500" />;
      default:
        return <Heart className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30">Saudável</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">Degradado</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Crítico</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const overallScore = useMemo(() => {
    if (!webhookHealth?.length) return 100;
    return Math.round(
      webhookHealth.reduce((acc, w) => acc + w.score, 0) / webhookHealth.length
    );
  }, [webhookHealth]);

  const overallStatus = useMemo(() => {
    if (overallScore >= 80) return 'healthy';
    if (overallScore >= 50) return 'degraded';
    return 'unhealthy';
  }, [overallScore]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(overallStatus)}
              <div>
                <CardTitle>Saúde Geral dos Webhooks</CardTitle>
                <CardDescription>
                  Score baseado em taxa de entrega, falhas recentes e tempo de resposta
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{overallScore}</div>
              <div className="text-sm text-muted-foreground">/ 100</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress 
            value={overallScore} 
            className="h-3"
          />
        </CardContent>
      </Card>

      {/* Individual Webhooks */}
      <div className="space-y-4">
        {webhookHealth?.map((webhook) => (
          <Card key={webhook.id} className={!webhook.isActive ? 'opacity-60' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <Tooltip>
                    <TooltipTrigger>
                      {getStatusIcon(webhook.status)}
                    </TooltipTrigger>
                    <TooltipContent>
                      Score: {webhook.score}/100
                    </TooltipContent>
                  </Tooltip>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{webhook.name}</h4>
                      {getStatusBadge(webhook.status)}
                      {!webhook.isActive && (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono truncate">
                      {webhook.url}
                    </p>
                    
                    {/* Metrics */}
                    <div className="flex items-center gap-6 mt-3 text-sm">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>{webhook.metrics.deliveryRate24h}%</span>
                          <span className="text-muted-foreground text-xs">24h</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Taxa de entrega nas últimas 24h
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1.5">
                          {webhook.metrics.deliveryRate7d >= webhook.metrics.deliveryRate24h ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span>{webhook.metrics.deliveryRate7d}%</span>
                          <span className="text-muted-foreground text-xs">7d</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Taxa de entrega nos últimos 7 dias
                        </TooltipContent>
                      </Tooltip>

                      {webhook.metrics.failedCount24h > 0 && (
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1.5 text-destructive">
                            <XCircle className="h-4 w-4" />
                            <span>{webhook.metrics.failedCount24h} falhas</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Falhas nas últimas 24h
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {webhook.metrics.avgResponseTime > 0 && (
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{webhook.metrics.avgResponseTime}ms</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Tempo médio de resposta
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <span className="text-muted-foreground">
                        {webhook.metrics.totalCount24h} entregas
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="ml-4 text-center">
                  <div className={`text-2xl font-bold ${
                    webhook.score >= 80 ? 'text-green-500' :
                    webhook.score >= 50 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {webhook.score}
                  </div>
                  <Progress 
                    value={webhook.score} 
                    className="h-1.5 w-16 mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!webhookHealth || webhookHealth.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum webhook configurado</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
