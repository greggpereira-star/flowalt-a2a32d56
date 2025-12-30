import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  Award,
  Target,
  BarChart3,
  Activity,
  Zap,
} from 'lucide-react';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface MemberStats {
  user_id: string;
  name: string;
  email: string;
  cards_completed: number;
  cards_in_progress: number;
  total_hours: number;
  avg_completion_time: number;
  productivity_score: number;
}

export default function PeopleAnalyticsPage() {
  usePageTracking('people_analytics');
  const { currentWorkspace } = useWorkspace();
  const startDate = subDays(new Date(), 30);

  // Fetch workspace members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, function_title, department, is_active')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch cards for analytics
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['cards-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('cards')
        .select('id, title, status, created_by, completed_at, created_at, estimated_hours, actual_hours')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startDate.toISOString());
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch time entries
  const { data: timeEntries, isLoading: timeLoading } = useQuery({
    queryKey: ['time-entries-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('time_entries')
        .select('id, user_id, duration_seconds, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startDate.toISOString());
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch user levels
  const { data: userLevels } = useQuery({
    queryKey: ['user-levels-analytics', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('user_levels')
        .select('user_id, current_level, total_score')
        .eq('workspace_id', currentWorkspace.id);
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Calculate member stats
  const memberStats = useMemo<MemberStats[]>(() => {
    if (!members || !cards || !timeEntries) return [];

    return members.map((member) => {
      const memberCards = cards.filter(c => c.created_by === member.user_id);
      const completedCards = memberCards.filter(c => c.status === 'delivered' || c.status === 'approved');
      const inProgressCards = memberCards.filter(c => c.status === 'in_progress');
      
      const memberTime = timeEntries
        .filter(t => t.user_id === member.user_id)
        .reduce((acc, t) => acc + ((t.duration_seconds || 0) / 60), 0);

      const userLevel = userLevels?.find(l => l.user_id === member.user_id);
      
      // Calculate avg completion time in hours
      const completedWithTime = completedCards.filter(c => c.completed_at && c.created_at);
      const avgCompletionHours = completedWithTime.length > 0
        ? completedWithTime.reduce((acc, c) => {
            const created = new Date(c.created_at);
            const completed = new Date(c.completed_at!);
            return acc + (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
          }, 0) / completedWithTime.length
        : 0;

      // Productivity score (0-100)
      const productivityScore = Math.min(100, Math.round(
        (completedCards.length * 10) + 
        (memberTime / 60 * 2) + 
        ((userLevel?.current_level || 0) * 5)
      ));

      return {
        user_id: member.user_id,
        name: member.function_title || 'Membro',
        email: member.department || '',
        cards_completed: completedCards.length,
        cards_in_progress: inProgressCards.length,
        total_hours: Math.round(memberTime / 60 * 10) / 10,
        avg_completion_time: Math.round(avgCompletionHours * 10) / 10,
        productivity_score: productivityScore,
      };
    }).sort((a, b) => b.productivity_score - a.productivity_score);
  }, [members, cards, timeEntries, userLevels]);

  // Weekly productivity trend
  const weeklyTrend = useMemo(() => {
    if (!cards) return [];
    
    const days = eachDayOfInterval({
      start: startOfWeek(new Date(), { locale: ptBR }),
      end: endOfWeek(new Date(), { locale: ptBR }),
    });

    return days.map(day => {
      const dayCards = cards.filter(c => {
        const cardDate = parseISO(c.created_at);
        return format(cardDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      
      const completed = dayCards.filter(c => c.status === 'delivered' || c.status === 'approved').length;
      const created = dayCards.length;

      return {
        day: format(day, 'EEE', { locale: ptBR }),
        date: format(day, 'dd/MM'),
        criados: created,
        concluidos: completed,
      };
    });
  }, [cards]);

  // Team distribution by department
  const departmentDistribution = useMemo(() => {
    if (!members) return [];
    
    const deptCounts: Record<string, number> = {};
    members.forEach(m => {
      const dept = m.department || 'Sem departamento';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    return Object.entries(deptCounts).map(([name, value]) => ({ name, value }));
  }, [members]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalCompleted = memberStats.reduce((acc, m) => acc + m.cards_completed, 0);
    const totalHours = memberStats.reduce((acc, m) => acc + m.total_hours, 0);
    const avgProductivity = memberStats.length > 0
      ? Math.round(memberStats.reduce((acc, m) => acc + m.productivity_score, 0) / memberStats.length)
      : 0;
    const topPerformer = memberStats[0];

    return { totalCompleted, totalHours, avgProductivity, topPerformer };
  }, [memberStats]);

  const isLoading = membersLoading || cardsLoading || timeLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Helmet>
        <title>People Analytics - Flowalt</title>
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            People Analytics
          </h1>
          <p className="text-muted-foreground">
            Métricas de produtividade e desempenho da equipe
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{memberStats.length}</div>
              <p className="text-xs text-muted-foreground">no workspace</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cards Concluídos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalCompleted}</div>
              <p className="text-xs text-muted-foreground">últimos 30 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Trabalhadas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalHours}h</div>
              <p className="text-xs text-muted-foreground">registradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produtividade Média</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.avgProductivity}%</div>
              <Progress value={overallStats.avgProductivity} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Tendências
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Distribuição
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4">
            {/* Top Performer */}
            {overallStats.topPerformer && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Award className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Top Performer</CardTitle>
                      <CardDescription>Maior pontuação de produtividade</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {overallStats.topPerformer.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{overallStats.topPerformer.name}</p>
                        <p className="text-sm text-muted-foreground">{overallStats.topPerformer.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {overallStats.topPerformer.productivity_score}%
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {overallStats.topPerformer.cards_completed} cards
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Team Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Ranking da Equipe
                </CardTitle>
                <CardDescription>
                  Classificação por pontuação de produtividade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memberStats.map((member, index) => (
                    <div key={member.user_id} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
                        {index + 1}
                      </div>
                      <Avatar>
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{member.name}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{member.cards_completed} concluídos</span>
                          <span>{member.total_hours}h trabalhadas</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Progress value={member.productivity_score} className="w-20" />
                          <span className="font-medium w-10">{member.productivity_score}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {memberStats.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado de produtividade disponível
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Produtividade Semanal
                </CardTitle>
                <CardDescription>
                  Cards criados vs concluídos esta semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="criados" fill="hsl(var(--muted-foreground))" name="Criados" />
                      <Bar dataKey="concluidos" fill="hsl(var(--primary))" name="Concluídos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Por Departamento</CardTitle>
                  <CardDescription>
                    Distribuição da equipe por área
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={departmentDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {departmentDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas Gerais</CardTitle>
                  <CardDescription>
                    Resumo de métricas da equipe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Média de cards/membro</span>
                    <span className="font-bold">
                      {memberStats.length > 0 
                        ? Math.round(overallStats.totalCompleted / memberStats.length * 10) / 10
                        : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Média de horas/membro</span>
                    <span className="font-bold">
                      {memberStats.length > 0 
                        ? Math.round(overallStats.totalHours / memberStats.length * 10) / 10
                        : 0}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tempo médio de conclusão</span>
                    <span className="font-bold">
                      {memberStats.length > 0 
                        ? Math.round(memberStats.reduce((a, m) => a + m.avg_completion_time, 0) / memberStats.length * 10) / 10
                        : 0}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Membros com alta produtividade</span>
                    <span className="font-bold">
                      {memberStats.filter(m => m.productivity_score >= 70).length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
