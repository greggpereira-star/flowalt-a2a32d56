import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  Key
} from 'lucide-react';
import { format, formatDistanceToNow, subDays, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ApiLog {
  id: string;
  workspace_id: string;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number | null;
  request_size: number | null;
  response_size: number | null;
  user_agent: string | null;
  ip_address: string | null;
  correlation_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface ApiStats {
  total: number;
  successful: number;
  failed: number;
  avgResponseTime: number;
  requestsPerHour: number;
}

export function ApiLogsPanel() {
  const { currentWorkspace } = useWorkspace();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  const getTimeRangeStart = () => {
    switch (timeRange) {
      case '1h': return subHours(new Date(), 1);
      case '24h': return subDays(new Date(), 1);
      case '7d': return subDays(new Date(), 7);
    }
  };

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['api-logs', currentWorkspace?.id, timeRange],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('api_logs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', getTimeRangeStart().toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as ApiLog[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });

  // Calculate stats
  const stats = useMemo<ApiStats>(() => {
    if (!logs?.length) {
      return { total: 0, successful: 0, failed: 0, avgResponseTime: 0, requestsPerHour: 0 };
    }

    const total = logs.length;
    const successful = logs.filter(l => l.status_code >= 200 && l.status_code < 300).length;
    const failed = logs.filter(l => l.status_code >= 400).length;
    
    const responseTimes = logs.filter(l => l.response_time_ms).map(l => l.response_time_ms!);
    const avgResponseTime = responseTimes.length 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
    const requestsPerHour = Math.round(total / hours * 10) / 10;

    return { total, successful, failed, avgResponseTime, requestsPerHour };
  }, [logs, timeRange]);

  // Group by endpoint
  const endpointStats = useMemo(() => {
    if (!logs) return [];
    const counts = new Map<string, { count: number; errors: number; avgTime: number }>();
    
    logs.forEach(log => {
      const key = `${log.method} ${log.endpoint}`;
      const existing = counts.get(key) || { count: 0, errors: 0, avgTime: 0 };
      counts.set(key, {
        count: existing.count + 1,
        errors: existing.errors + (log.status_code >= 400 ? 1 : 0),
        avgTime: existing.avgTime + (log.response_time_ms || 0),
      });
    });

    return Array.from(counts.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        errors: data.errors,
        avgTime: Math.round(data.avgTime / data.count),
        errorRate: Math.round((data.errors / data.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [logs]);

  // Hourly distribution
  const hourlyData = useMemo(() => {
    if (!logs) return [];
    const hourly = new Map<string, { hour: string; requests: number; errors: number }>();
    
    logs.forEach(log => {
      const hour = format(new Date(log.created_at), 'HH:00');
      const existing = hourly.get(hour) || { hour, requests: 0, errors: 0 };
      hourly.set(hour, {
        hour,
        requests: existing.requests + 1,
        errors: existing.errors + (log.status_code >= 400 ? 1 : 0),
      });
    });

    return Array.from(hourly.values()).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [logs]);

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> {status}</Badge>;
    }
    if (status >= 400 && status < 500) {
      return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> {status}</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {status}</Badge>;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-500/20 text-green-600',
      POST: 'bg-blue-500/20 text-blue-600',
      PUT: 'bg-yellow-500/20 text-yellow-600',
      PATCH: 'bg-orange-500/20 text-orange-600',
      DELETE: 'bg-red-500/20 text-red-600',
    };
    return <Badge variant="outline" className={colors[method] || ''}>{method}</Badge>;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Logs de Consumo da API</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Última hora</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sucesso</p>
                <p className="text-xl font-bold text-green-600">{stats.successful}</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Erros</p>
                <p className="text-xl font-bold text-destructive">{stats.failed}</p>
              </div>
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tempo médio</p>
                <p className="text-xl font-bold">{stats.avgResponseTime}ms</p>
              </div>
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Req/hora</p>
                <p className="text-xl font-bold">{stats.requestsPerHour}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requisições</TabsTrigger>
          <TabsTrigger value="endpoints">Por Endpoint</TabsTrigger>
          <TabsTrigger value="chart">Distribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Requisições Recentes</CardTitle>
              <CardDescription>Últimas chamadas à API</CardDescription>
            </CardHeader>
            <CardContent>
              {logs && logs.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {logs.slice(0, 50).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getMethodBadge(log.method)}
                          <div>
                            <code className="text-sm">{log.endpoint}</code>
                            {log.error_message && (
                              <p className="text-xs text-destructive">{log.error_message}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {log.response_time_ms && (
                            <span className="text-xs text-muted-foreground">
                              {log.response_time_ms}ms
                            </span>
                          )}
                          {getStatusBadge(log.status_code)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma requisição registrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <CardTitle>Endpoints Mais Acessados</CardTitle>
              <CardDescription>Distribuição de chamadas por endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              {endpointStats.length > 0 ? (
                <div className="space-y-3">
                  {endpointStats.map((ep, idx) => (
                    <div key={ep.endpoint} className="flex items-center gap-3 p-3 border rounded-lg">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <code className="text-sm truncate block">{ep.endpoint}</code>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{ep.count} req</span>
                          <span>{ep.avgTime}ms avg</span>
                          {ep.errors > 0 && (
                            <span className="text-destructive">{ep.errorRate}% erros</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(ep.count / endpointStats[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Hora</CardTitle>
              <CardDescription>Requisições e erros ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        dataKey="requests" 
                        name="Requisições"
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="errors" 
                        name="Erros"
                        fill="hsl(var(--destructive))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
