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
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Heart,
  AlertCircle,
} from 'lucide-react';
import { useClientWorkflowMetrics, ClientWorkflowMetric } from '@/hooks/useClientWorkflowMetrics';

const getHealthColor = (score: number) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
};

const getHealthBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
};

export const ClientMetricsPanel: React.FC = () => {
  const { data: metrics, isLoading } = useClientWorkflowMetrics();

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

  if (!metrics || metrics.clientMetrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum cliente com cards</p>
          <p className="text-muted-foreground">
            Associe cards aos clientes para ver métricas de performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  const healthChartData = metrics.clientMetrics.slice(0, 10).map(client => ({
    name: client.clientName.length > 15 ? client.clientName.slice(0, 15) + '...' : client.clientName,
    fullName: client.clientName,
    score: client.healthScore,
    color: client.clientColor || 'hsl(var(--primary))',
  }));

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Clientes Ativos</span>
            </div>
            <p className="text-2xl font-bold">{metrics.activeClients}</p>
            <p className="text-xs text-muted-foreground">de {metrics.totalClients} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Heart className={cn("h-4 w-4", getHealthColor(metrics.avgHealthScore))} />
              <span className="text-sm text-muted-foreground">Health Médio</span>
            </div>
            <p className={cn("text-2xl font-bold", getHealthColor(metrics.avgHealthScore))}>
              {metrics.avgHealthScore}%
            </p>
            <p className="text-xs text-muted-foreground">score geral</p>
          </CardContent>
        </Card>

        <Card className={metrics.totalOverdue > 0 ? 'border-orange-500/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={cn(
                "h-4 w-4",
                metrics.totalOverdue > 0 ? "text-orange-500" : "text-muted-foreground"
              )} />
              <span className="text-sm text-muted-foreground">Atrasados</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              metrics.totalOverdue > 0 && "text-orange-500"
            )}>{metrics.totalOverdue}</p>
            <p className="text-xs text-muted-foreground">cards em atraso</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              {metrics.avgHoursVariance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-muted-foreground">Horas</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              metrics.avgHoursVariance >= 0 ? "text-green-600" : "text-red-500"
            )}>
              {metrics.avgHoursVariance >= 0 ? '+' : ''}{metrics.avgHoursVariance}%
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.avgHoursVariance >= 0 ? 'abaixo do orçado' : 'acima do orçado'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Health Score Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Health Score por Cliente
            </CardTitle>
            <CardDescription>
              Top 10 clientes ordenados por score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthChartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]}
                    className="text-xs fill-muted-foreground" 
                  />
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
                          <p className="text-sm font-medium">{data.fullName}</p>
                          <p className="text-xs">Health: {data.score}%</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {healthChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.score >= 80 ? 'hsl(142, 76%, 36%)' :
                          entry.score >= 60 ? 'hsl(45, 93%, 47%)' :
                          entry.score >= 40 ? 'hsl(25, 95%, 53%)' :
                          'hsl(0, 84%, 60%)'
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Clientes em Risco
            </CardTitle>
            <CardDescription>
              Clientes com health score abaixo de 60%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {metrics.clientMetrics.filter(c => c.healthScore < 60).length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>Todos os clientes estão saudáveis!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.clientMetrics
                    .filter(c => c.healthScore < 60)
                    .map(client => (
                      <div
                        key={client.clientId}
                        className="p-3 rounded-lg border border-destructive/50 bg-destructive/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: client.clientColor || 'hsl(var(--primary))' }}
                            />
                            <span className="font-medium">{client.clientName}</span>
                          </div>
                          <Badge variant="destructive">{client.healthScore}%</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          {client.overdueCards > 0 && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-orange-500" />
                              {client.overdueCards} atrasados
                            </div>
                          )}
                          {client.hoursVariancePercent < 0 && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-red-500" />
                              {Math.abs(client.hoursVariancePercent)}% acima
                            </div>
                          )}
                          {client.onTimeDeliveryRate < 70 && (
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-yellow-500" />
                              {client.onTimeDeliveryRate}% on-time
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Client Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Detalhes por Cliente
          </CardTitle>
          <CardDescription>
            Performance completa de cada cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {metrics.clientMetrics.map(client => (
                <ClientMetricRow key={client.clientId} client={client} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

const ClientMetricRow: React.FC<{ client: ClientWorkflowMetric }> = ({ client }) => {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-colors",
        client.healthScore < 40 && "border-red-500/50 bg-red-500/5",
        client.healthScore >= 40 && client.healthScore < 60 && "border-orange-500/50 bg-orange-500/5",
        client.healthScore >= 60 && client.healthScore < 80 && "border-yellow-500/50 bg-yellow-500/5"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: client.clientColor || 'hsl(var(--primary))' }}
          />
          <span className="font-medium">{client.clientName}</span>
          <Badge variant={getHealthBadgeVariant(client.healthScore)}>
            {client.healthScore}% health
          </Badge>
          {client.clientStatus !== 'active' && (
            <Badge variant="outline">{client.clientStatus}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="text-sm text-muted-foreground">
                  {client.totalCards} cards
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p>Backlog: {client.backlogCards}</p>
                  <p>Em progresso: {client.inProgressCards}</p>
                  <p>Entregues: {client.deliveredCards}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        {/* Progress */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Progresso</p>
          <div className="flex items-center gap-2">
            <Progress 
              value={client.deliveryRate} 
              className="h-2 flex-1"
            />
            <span className="text-xs">{client.deliveryRate}%</span>
          </div>
        </div>

        {/* On-time */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">On-time</p>
          <div className="flex items-center gap-1">
            {client.onTimeDeliveryRate >= 80 ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-orange-500" />
            )}
            <span className={cn(
              client.onTimeDeliveryRate < 70 && "text-orange-500"
            )}>{client.onTimeDeliveryRate}%</span>
          </div>
        </div>

        {/* Hours variance */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Horas</p>
          <div className="flex items-center gap-1">
            {client.hoursVariancePercent >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span className={cn(
              client.hoursVariancePercent >= 0 ? "text-green-600" : "text-red-500"
            )}>
              {client.hoursVariancePercent >= 0 ? '+' : ''}{client.hoursVariancePercent}%
            </span>
          </div>
        </div>

        {/* Lead time */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Lead Time</p>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{client.avgLeadTimeDays}d</span>
          </div>
        </div>

        {/* Overdue */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Atrasados</p>
          <div className="flex items-center gap-1">
            {client.overdueCards > 0 ? (
              <AlertTriangle className="h-3 w-3 text-orange-500" />
            ) : (
              <CheckCircle className="h-3 w-3 text-green-500" />
            )}
            <span className={cn(
              client.overdueCards > 0 && "text-orange-500"
            )}>{client.overdueCards}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
