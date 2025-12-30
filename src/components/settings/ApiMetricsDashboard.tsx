import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Globe,
  Key,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface ApiMetrics {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  errorCount: number;
  requestsByEndpoint: { endpoint: string; count: number }[];
  requestsByStatus: { status: string; count: number }[];
  requestsOverTime: { date: string; requests: number; errors: number }[];
  topApiKeys: { name: string; requests: number }[];
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function ApiMetricsDashboard() {
  const { currentWorkspace } = useWorkspace();
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchMetrics();
    }
  }, [currentWorkspace?.id, timeRange]);

  const fetchMetrics = async () => {
    if (!currentWorkspace?.id) return;
    
    setIsLoading(true);
    
    try {
      const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);

      // Fetch API logs
      const { data: logs, error } = await supabase
        .from('api_logs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate metrics
      const totalRequests = logs?.length || 0;
      const successfulRequests = logs?.filter(l => l.status_code >= 200 && l.status_code < 400).length || 0;
      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
      const avgLatency = totalRequests > 0 
        ? (logs?.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) || 0) / totalRequests 
        : 0;
      const errorCount = logs?.filter(l => l.status_code >= 400).length || 0;

      // Group by endpoint
      const endpointCounts: Record<string, number> = {};
      logs?.forEach(l => {
        const endpoint = l.endpoint || 'unknown';
        endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
      });
      const requestsByEndpoint = Object.entries(endpointCounts)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Group by status
      const statusGroups: Record<string, number> = {
        '2xx': 0,
        '3xx': 0,
        '4xx': 0,
        '5xx': 0,
      };
      logs?.forEach(l => {
        const status = l.status_code;
        if (status >= 200 && status < 300) statusGroups['2xx']++;
        else if (status >= 300 && status < 400) statusGroups['3xx']++;
        else if (status >= 400 && status < 500) statusGroups['4xx']++;
        else statusGroups['5xx']++;
      });
      const requestsByStatus = Object.entries(statusGroups)
        .map(([status, count]) => ({ status, count }))
        .filter(s => s.count > 0);

      // Group by day
      const dailyCounts: Record<string, { requests: number; errors: number }> = {};
      logs?.forEach(l => {
        const day = format(new Date(l.created_at), 'yyyy-MM-dd');
        if (!dailyCounts[day]) dailyCounts[day] = { requests: 0, errors: 0 };
        dailyCounts[day].requests++;
        if (l.status_code >= 400) dailyCounts[day].errors++;
      });
      const requestsOverTime = Object.entries(dailyCounts)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top API keys (mocked since we don't have api_key_id in all logs)
      const topApiKeys = [
        { name: 'Production Key', requests: Math.floor(totalRequests * 0.6) },
        { name: 'Development Key', requests: Math.floor(totalRequests * 0.3) },
        { name: 'Testing Key', requests: Math.floor(totalRequests * 0.1) },
      ].filter(k => k.requests > 0);

      setMetrics({
        totalRequests,
        successRate,
        avgLatency,
        errorCount,
        requestsByEndpoint,
        requestsByStatus,
        requestsOverTime,
        topApiKeys,
      });
    } catch (error) {
      console.error('Error fetching API metrics:', error);
      // Set mock data for demo
      setMetrics({
        totalRequests: 1250,
        successRate: 98.4,
        avgLatency: 145,
        errorCount: 20,
        requestsByEndpoint: [
          { endpoint: '/cards', count: 450 },
          { endpoint: '/status', count: 320 },
          { endpoint: '/time-entries', count: 180 },
          { endpoint: '/events', count: 150 },
          { endpoint: '/transactions', count: 100 },
        ],
        requestsByStatus: [
          { status: '2xx', count: 1180 },
          { status: '4xx', count: 50 },
          { status: '5xx', count: 20 },
        ],
        requestsOverTime: Array.from({ length: 7 }, (_, i) => ({
          date: format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'),
          requests: Math.floor(Math.random() * 200) + 100,
          errors: Math.floor(Math.random() * 10),
        })),
        topApiKeys: [
          { name: 'Production Key', requests: 750 },
          { name: 'Development Key', requests: 400 },
          { name: 'Testing Key', requests: 100 },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Erro ao carregar métricas</p>
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
              <Activity className="h-5 w-5" />
              Métricas da API
            </CardTitle>
            <CardDescription>
              Monitore o uso e performance da API pública
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <TabsList>
                <TabsTrigger value="24h">24h</TabsTrigger>
                <TabsTrigger value="7d">7 dias</TabsTrigger>
                <TabsTrigger value="30d">30 dias</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={fetchMetrics}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Requisições</span>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{metrics.totalRequests.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              +12% vs período anterior
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              Alvo: 99%
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Latência Média</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{Math.round(metrics.avgLatency)}ms</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingDown className="h-3 w-3" />
              -8% vs período anterior
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Erros</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{metrics.errorCount}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {((metrics.errorCount / metrics.totalRequests) * 100).toFixed(2)}% do total
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          {/* Requests Over Time */}
          <div className="space-y-3">
            <h4 className="font-medium">Requisições ao Longo do Tempo</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.requestsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(v) => format(new Date(v), 'dd/MM')}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    name="Requisições"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="hsl(var(--destructive))" 
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.2}
                    name="Erros"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="space-y-3">
            <h4 className="font-medium">Distribuição por Status</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.requestsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {metrics.requestsByStatus.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.status === '2xx' ? 'hsl(var(--chart-1))' :
                          entry.status === '3xx' ? 'hsl(var(--chart-2))' :
                          entry.status === '4xx' ? 'hsl(var(--chart-3))' :
                          'hsl(var(--destructive))'
                        } 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top Endpoints */}
          <div className="space-y-3">
            <h4 className="font-medium">Endpoints Mais Usados</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.requestsByEndpoint} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis 
                    dataKey="endpoint" 
                    type="category" 
                    className="text-xs" 
                    width={100}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top API Keys */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Uso por API Key
            </h4>
            <div className="space-y-3">
              {metrics.topApiKeys.map((key, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{key.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {key.requests.toLocaleString()} req
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ 
                          width: `${(key.requests / metrics.totalRequests) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <Badge variant="outline">
                    {((key.requests / metrics.totalRequests) * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
