import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePageTracking } from '@/hooks/usePageTracking';

const STATUS_COLORS: Record<string, string> = {
  backlog: 'hsl(var(--muted-foreground))',
  briefing: 'hsl(220, 80%, 60%)',
  todo: 'hsl(var(--primary))',
  in_progress: 'hsl(45, 93%, 47%)',
  review: 'hsl(280, 80%, 60%)',
  approved: 'hsl(142, 76%, 36%)',
  delivered: 'hsl(142, 76%, 36%)',
  archived: 'hsl(var(--muted-foreground))',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  briefing: 'Briefing',
  todo: 'A Fazer',
  in_progress: 'Em Progresso',
  review: 'Revisão',
  approved: 'Aprovado',
  delivered: 'Entregue',
};

const Dashboard: React.FC = () => {
  usePageTracking('dashboard');
  const { currentWorkspace } = useWorkspace();

  // Fetch cards for the workspace
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['dashboard-cards', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived');

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch time entries for the workspace
  const { data: timeEntries, isLoading: timeLoading } = useQuery({
    queryKey: ['dashboard-time', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', startOfWeek(new Date(), { locale: ptBR }).toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Calculate metrics
  const totalCards = cards?.length || 0;
  const completedCards = cards?.filter((c) => c.status === 'delivered').length || 0;
  const inProgressCards = cards?.filter((c) => c.status === 'in_progress').length || 0;
  const overdueCards = cards?.filter((c) => {
    if (!c.due_date || c.status === 'delivered') return false;
    return new Date(c.due_date) < new Date();
  }).length || 0;

  // Status distribution for pie chart
  const statusDistribution = Object.entries(
    cards?.reduce((acc, card) => {
      acc[card.status] = (acc[card.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {}
  ).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || 'hsl(var(--muted-foreground))',
  }));

  // Weekly hours data
  const weekStart = startOfWeek(new Date(), { locale: ptBR });
  const weekEnd = endOfWeek(new Date(), { locale: ptBR });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weeklyHours = weekDays.map((day) => {
    const dayEntries = timeEntries?.filter((e) =>
      isSameDay(new Date(e.started_at), day)
    );
    const totalSeconds = dayEntries?.reduce((acc, e) => acc + e.duration_seconds, 0) || 0;
    return {
      day: format(day, 'EEE', { locale: ptBR }),
      hours: Math.round((totalSeconds / 3600) * 10) / 10,
    };
  });

  const totalWeeklyHours = weeklyHours.reduce((acc, d) => acc + d.hours, 0);

  const isLoading = cardsLoading || timeLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do workspace {currentWorkspace?.name}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dashboard-stats">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Cards</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCards}</div>
              <p className="text-xs text-muted-foreground">
                {completedCards} entregues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
              <Clock className="h-4 w-4 text-status-inProgress" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressCards}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((inProgressCards / Math.max(totalCards, 1)) * 100)}% do total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overdueCards}</div>
              <p className="text-xs text-muted-foreground">
                Precisam de atenção
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Horas Semana</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWeeklyHours.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">
                Esta semana
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Weekly Hours Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Horas por Dia</CardTitle>
              <CardDescription>Tempo registrado nesta semana</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyHours}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="day"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-popover border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">
                              {payload[0].payload.day}: {payload[0].value}h
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="hours"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>Cards agrupados por status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center">
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg p-2 shadow-lg">
                              <p className="text-sm font-medium">
                                {data.name}: {data.value}
                              </p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
                <div className="space-y-2">
                  {statusDistribution.map((status) => (
                    <div key={status.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-xs">{status.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {status.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Cards */}
        {overdueCards > 0 && cards && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Cards Atrasados
              </CardTitle>
              <CardDescription>Estes cards precisam de atenção imediata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cards
                  .filter((c) => {
                    if (!c.due_date || c.status === 'delivered') return false;
                    return new Date(c.due_date) < new Date();
                  })
                  .slice(0, 5)
                  .map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div>
                        <p className="font-medium">{card.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Prazo: {format(new Date(card.due_date!), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {STATUS_LABELS[card.status]}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
