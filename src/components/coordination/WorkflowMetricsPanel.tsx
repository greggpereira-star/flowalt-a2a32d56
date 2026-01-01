import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  Layers,
  Timer,
} from 'lucide-react';
import { useWorkflowMetrics } from '@/hooks/useWorkflowMetrics';

export const WorkflowMetricsPanel: React.FC = () => {
  const { data: metrics, isLoading } = useWorkflowMetrics();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Workflow não configurado</p>
          <p className="text-muted-foreground">
            Configure um workflow padrão para ver as métricas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = metrics.stageMetrics.map(stage => ({
    name: stage.stageName,
    count: stage.currentCount,
    avgDays: stage.avgTimeInStageDays,
    color: stage.stageColor,
  }));

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">WIP Total</span>
            </div>
            <p className="text-2xl font-bold">{metrics.wipTotal}</p>
            <p className="text-xs text-muted-foreground">cards em progresso</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Throughput</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{metrics.throughputPerWeek}</p>
            <p className="text-xs text-muted-foreground">entregues esta semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Cycle Time</span>
            </div>
            <p className="text-2xl font-bold">{metrics.avgCycleTimeDays}</p>
            <p className="text-xs text-muted-foreground">dias em média</p>
          </CardContent>
        </Card>

        <Card className={metrics.blockedCount > 0 ? 'border-orange-500/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={cn(
                "h-4 w-4",
                metrics.blockedCount > 0 ? "text-orange-500" : "text-muted-foreground"
              )} />
              <span className="text-sm text-muted-foreground">Bloqueados</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              metrics.blockedCount > 0 && "text-orange-500"
            )}>{metrics.blockedCount}</p>
            <p className="text-xs text-muted-foreground">aguardando dependência</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Time / Cycle Time Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Lead Time vs Cycle Time
            </CardTitle>
            <CardDescription>
              Lead: criação → entrega | Cycle: produção → entrega
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Lead Time Médio</p>
                <p className="text-3xl font-bold">{metrics.avgLeadTimeDays} <span className="text-sm font-normal">dias</span></p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Cycle Time Médio</p>
                <p className="text-3xl font-bold">{metrics.avgCycleTimeDays} <span className="text-sm font-normal">dias</span></p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Tempo de espera (Lead - Cycle): <strong>{Math.max(0, metrics.avgLeadTimeDays - metrics.avgCycleTimeDays)} dias</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stage Distribution Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Etapa</CardTitle>
            <CardDescription>Cards em cada etapa do workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    className="text-xs fill-muted-foreground"
                    width={75}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{data.name}</p>
                          <p className="text-xs">{data.count} cards</p>
                          <p className="text-xs text-muted-foreground">Média: {data.avgDays} dias</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Métricas por Etapa
          </CardTitle>
          <CardDescription>
            Tempo médio, SLA e WIP por etapa do workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {metrics.stageMetrics.map(stage => (
                <div
                  key={stage.stageId}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    stage.isOverWip && "border-red-500/50 bg-red-500/5",
                    stage.breachedSLA > 0 && !stage.isOverWip && "border-orange-500/50 bg-orange-500/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.stageColor }}
                      />
                      <span className="font-medium">{stage.stageName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {stage.currentCount} cards
                      </Badge>
                      {stage.isOverWip && (
                        <Badge variant="destructive" className="text-xs">
                          WIP Excedido
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{stage.avgTimeInStageDays}d</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Tempo médio na etapa
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {stage.wipLimit && (
                        <span className="text-muted-foreground">
                          WIP: {stage.currentCount}/{stage.wipLimit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SLA Progress */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">SLA Compliance</span>
                        <span className={cn(
                          stage.slaCompliancePercent < 80 && "text-orange-500",
                          stage.slaCompliancePercent < 50 && "text-red-500"
                        )}>
                          {stage.slaCompliancePercent}%
                        </span>
                      </div>
                      <Progress 
                        value={stage.slaCompliancePercent} 
                        className="h-1.5"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        {stage.withinSLA}
                      </div>
                      {stage.breachedSLA > 0 && (
                        <div className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="h-3 w-3" />
                          {stage.breachedSLA}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
