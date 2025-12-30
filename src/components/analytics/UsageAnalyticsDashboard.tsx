import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity,
  Calendar,
  Layers,
} from 'lucide-react';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  calendar: 'Agenda',
  coordination: 'Coordenação',
  financial: 'Financeiro',
  partners: 'Sócios',
  gamification: 'Gamificação',
  analytics: 'Análises',
  settings: 'Configurações',
  spaces: 'Espaços',
  cards: 'Cards',
  time_tracking: 'Tempo',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualização',
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  export: 'Exportação',
  import: 'Importação',
  start_timer: 'Iniciar Timer',
  stop_timer: 'Parar Timer',
  complete: 'Conclusão',
  archive: 'Arquivamento',
};

export function UsageAnalyticsDashboard() {
  const { currentWorkspace } = useWorkspace();
  const startDate = subDays(new Date(), 30);
  const endDate = new Date();

  // Fetch usage data
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('module_usage')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Process data for charts
  const moduleUsage = React.useMemo(() => {
    if (!usageData) return [];
    
    const counts: Record<string, number> = {};
    usageData.forEach(u => {
      counts[u.module_name] = (counts[u.module_name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({
        name: MODULE_LABELS[name] || name,
        value,
        key: name,
      }))
      .sort((a, b) => b.value - a.value);
  }, [usageData]);

  const actionDistribution = React.useMemo(() => {
    if (!usageData) return [];
    
    const counts: Record<string, number> = {};
    usageData.forEach(u => {
      counts[u.action] = (counts[u.action] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({
        name: ACTION_LABELS[name] || name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [usageData]);

  const dailyUsage = React.useMemo(() => {
    if (!usageData) return [];
    
    const dailyCounts: Record<string, number> = {};
    
    // Initialize all days
    for (let i = 0; i <= 30; i++) {
      const date = format(subDays(endDate, i), 'yyyy-MM-dd');
      dailyCounts[date] = 0;
    }

    usageData.forEach(u => {
      const date = format(new Date(u.created_at), 'yyyy-MM-dd');
      if (dailyCounts[date] !== undefined) {
        dailyCounts[date]++;
      }
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({
        date,
        label: format(new Date(date), 'dd/MM', { locale: ptBR }),
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [usageData, endDate]);

  const uniqueUsers = React.useMemo(() => {
    if (!usageData) return 0;
    return new Set(usageData.map(u => u.user_id)).size;
  }, [usageData]);

  const totalActions = usageData?.length || 0;
  const avgActionsPerDay = dailyUsage.length > 0 
    ? Math.round(totalActions / dailyUsage.filter(d => d.count > 0).length) 
    : 0;

  if (usageLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ações</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Únicos no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Diária</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgActionsPerDay}</div>
            <p className="text-xs text-muted-foreground">Ações por dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Módulos Usados</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moduleUsage.length}</div>
            <p className="text-xs text-muted-foreground">Diferentes módulos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Module Usage Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Uso por Módulo
            </CardTitle>
            <CardDescription>
              Distribuição de acessos por funcionalidade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Action Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Tipos de Ações
            </CardTitle>
            <CardDescription>
              Distribuição por tipo de ação realizada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={actionDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {actionDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Usage Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Atividade Diária
          </CardTitle>
          <CardDescription>
            Evolução do uso ao longo dos últimos 30 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label" 
                  fontSize={12}
                  interval={Math.floor(dailyUsage.length / 10)}
                />
                <YAxis fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                  }}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  name="Ações"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Modules Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Módulos Mais Populares</CardTitle>
          <CardDescription>
            Ranking dos módulos mais utilizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {moduleUsage.slice(0, 5).map((module, index) => (
              <Badge 
                key={module.key} 
                variant={index === 0 ? 'default' : 'secondary'}
                className="text-sm py-1 px-3"
              >
                #{index + 1} {module.name} ({module.value})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
