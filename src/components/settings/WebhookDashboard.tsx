import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: number;
}

interface DeliveryWithSubscription {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  retry_count: number;
  created_at: string;
  delivered_at: string | null;
  next_retry_at: string | null;
  subscription?: {
    name: string;
    url: string;
    is_active: boolean;
  };
}

export function WebhookDashboard() {
  const { currentWorkspace } = useWorkspace();

  // Fetch all deliveries for the workspace
  const { data: allDeliveries, isLoading, refetch } = useQuery({
    queryKey: ['webhook_deliveries_all', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: subscriptions } = await supabase
        .from('webhook_subscriptions')
        .select('id, name, url, is_active')
        .eq('workspace_id', currentWorkspace.id);

      if (!subscriptions?.length) return [];

      const subscriptionIds = subscriptions.map(s => s.id);
      const subscriptionMap = new Map(subscriptions.map(s => [s.id, s]));

      const { data: deliveries, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .in('subscription_id', subscriptionIds)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      return (deliveries || []).map(d => ({
        ...d,
        subscription: subscriptionMap.get(d.subscription_id),
      })) as DeliveryWithSubscription[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate stats
  const stats = useMemo<DeliveryStats>(() => {
    if (!allDeliveries?.length) {
      return { total: 0, successful: 0, failed: 0, pending: 0, successRate: 0 };
    }

    const total = allDeliveries.length;
    const successful = allDeliveries.filter(d => d.response_status !== null && d.response_status >= 200 && d.response_status < 300).length;
    const failed = allDeliveries.filter(d => d.response_status !== null && d.response_status >= 400).length;
    const pending = allDeliveries.filter(d => d.response_status === null).length;
    const successRate = total > 0 ? Math.round((successful / (successful + failed)) * 100) || 0 : 0;

    return { total, successful, failed, pending, successRate };
  }, [allDeliveries]);

  // Recent deliveries (last 24h)
  const recentDeliveries = useMemo(() => {
    if (!allDeliveries) return [];
    const yesterday = subDays(new Date(), 1);
    return allDeliveries.filter(d => new Date(d.created_at) >= yesterday);
  }, [allDeliveries]);

  // Failed deliveries that can be retried
  const failedDeliveries = useMemo(() => {
    if (!allDeliveries) return [];
    return allDeliveries.filter(d => 
      d.response_status === null || d.response_status >= 400
    ).slice(0, 50);
  }, [allDeliveries]);

  // Group by event type
  const eventTypeCounts = useMemo(() => {
    if (!allDeliveries) return [];
    const counts = new Map<string, number>();
    allDeliveries.forEach(d => {
      counts.set(d.event_type, (counts.get(d.event_type) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [allDeliveries]);

  const getStatusBadge = (status: number | null) => {
    if (status === null) {
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
    if (status >= 200 && status < 300) {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> {status}</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-32 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Entregas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sucesso</p>
                <p className="text-2xl font-bold text-green-600">{stats.successful}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="recent">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="recent" className="gap-2">
              <Clock className="h-4 w-4" />
              Recentes ({recentDeliveries.length})
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Falhas ({failedDeliveries.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Por Evento
            </TabsTrigger>
          </TabsList>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Entregas Recentes (24h)</CardTitle>
              <CardDescription>
                Últimas entregas de webhook realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentDeliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma entrega nas últimas 24 horas
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {recentDeliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getStatusBadge(delivery.response_status)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {delivery.event_type}
                              </Badge>
                              <span className="text-sm text-muted-foreground truncate">
                                {delivery.subscription?.name || 'Webhook'}
                              </span>
                            </div>
                            {delivery.retry_count > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {delivery.retry_count} tentativa(s)
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {formatDistanceToNow(new Date(delivery.created_at), { 
                            addSuffix: true,
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Entregas com Falha
              </CardTitle>
              <CardDescription>
                Webhooks que falharam ou estão pendentes de entrega
              </CardDescription>
            </CardHeader>
            <CardContent>
              {failedDeliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma falha registrada
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {failedDeliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(delivery.response_status)}
                            <Badge variant="outline" className="text-xs">
                              {delivery.event_type}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(delivery.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Destino:</span>{' '}
                          <span className="font-mono text-xs">{delivery.subscription?.url}</span>
                        </div>
                        {delivery.retry_count > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Tentativas: {delivery.retry_count} | 
                            {delivery.next_retry_at && (
                              <> Próxima tentativa: {format(new Date(delivery.next_retry_at), "dd/MM HH:mm", { locale: ptBR })}</>
                            )}
                          </p>
                        )}
                        {delivery.response_body && (
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                            {delivery.response_body.substring(0, 200)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Evento</CardTitle>
              <CardDescription>
                Quantidade de webhooks disparados por tipo de evento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventTypeCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado disponível
                </p>
              ) : (
                <div className="space-y-3">
                  {eventTypeCounts.map(([eventType, count]) => {
                    const percentage = Math.round((count / stats.total) * 100);
                    return (
                      <div key={eventType} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{eventType}</span>
                          <span className="text-muted-foreground">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
