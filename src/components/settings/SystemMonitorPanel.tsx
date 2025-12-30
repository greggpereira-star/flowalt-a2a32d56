import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useSystemMetrics,
  useDashboardSnapshots,
  useAuditLogs,
} from '@/hooks/useSystemMetrics';
import {
  Activity,
  Clock,
  Database,
  History,
  RefreshCw,
  Shield,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SystemMonitorPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useSystemMetrics();
  const { data: snapshots, isLoading: snapshotsLoading, refetch: refetchSnapshots } = useDashboardSnapshots();
  const { data: auditLogs, isLoading: auditLoading, refetch: refetchAudit } = useAuditLogs();

  const handleRefreshSnapshots = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('compute-snapshots');
      if (error) throw error;
      
      await Promise.all([refetchMetrics(), refetchSnapshots()]);
      toast.success('Snapshots atualizados com sucesso');
    } catch (error) {
      console.error('Error refreshing snapshots:', error);
      toast.error('Erro ao atualizar snapshots');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getMetricIcon = (metricType: string) => {
    switch (metricType) {
      case 'api':
        return <Activity className="h-4 w-4" />;
      case 'job':
        return <Clock className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-500/10 text-green-600 border-green-200';
      case 'update':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'delete':
        return 'bg-red-500/10 text-red-600 border-red-200';
      case 'view':
        return 'bg-gray-500/10 text-gray-600 border-gray-200';
      default:
        return '';
    }
  };

  if (metricsLoading && snapshotsLoading && auditLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Monitoramento do Sistema
            </CardTitle>
            <CardDescription>
              Métricas de performance, snapshots e logs de auditoria
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshSnapshots}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar Snapshots
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="snapshots">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="snapshots" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Snapshots
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Métricas
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="snapshots" className="mt-4">
            {snapshots?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum snapshot gerado ainda</p>
                <p className="text-sm mt-1">Clique em "Atualizar Snapshots" para gerar</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {snapshots?.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {snapshot.snapshot_type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(snapshot.snapshot_date), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Atualizado {formatDistanceToNow(new Date(snapshot.computed_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(snapshot.metrics).map(([key, value]) => (
                          <div key={key} className="p-2 rounded bg-muted/50">
                            <p className="text-xs text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm font-medium">
                              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="mt-4">
            {metrics?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma métrica registrada ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Correlation ID</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics?.map((metric) => (
                      <TableRow key={metric.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMetricIcon(metric.metric_type)}
                            <span className="capitalize">{metric.metric_type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {metric.metric_name}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {metric.metric_value.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {metric.correlation_id && (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {metric.correlation_id.substring(0, 8)}...
                            </code>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(metric.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            {auditLogs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum log de auditoria registrado</p>
                <p className="text-sm mt-1">
                  Alterações em dados sensíveis serão registradas aqui
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={getActionBadgeColor(log.action)}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {log.entity_type}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {log.entity_id.substring(0, 8)}...
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Sobre o Monitoramento</p>
              <p>
                Snapshots são pré-computados para melhorar a performance dos dashboards.
                Métricas de sistema ajudam a identificar gargalos.
                Logs de auditoria rastreiam alterações em dados sensíveis.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
