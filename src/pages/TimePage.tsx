import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Clock,
  Play,
  Square,
  Calendar,
  TrendingUp,
  Users,
  Timer,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePageTracking } from '@/hooks/usePageTracking';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

const TimePage: React.FC = () => {
  usePageTracking('time_tracking');
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-time');

  // Fetch all time entries for current user
  const { data: myTimeEntries, isLoading: myTimeLoading } = useQuery({
    queryKey: ['my-time-entries', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          card:cards(id, title, status)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  // Fetch running timers in workspace
  const { data: runningTimers, isLoading: timersLoading } = useQuery({
    queryKey: ['running-timers', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          card:cards(id, title)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_running', true);

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', userIds);

      return data.map(entry => ({
        ...entry,
        profile: profiles?.find(p => p.id === entry.user_id) || null,
      }));
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch team time entries for this week
  const { data: teamTimeEntries, isLoading: teamTimeLoading } = useQuery({
    queryKey: ['team-time-entries', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const weekStart = startOfWeek(new Date(), { locale: ptBR });

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', weekStart.toISOString())
        .eq('is_running', false);

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', userIds);

      return data.map(entry => ({
        ...entry,
        profile: profiles?.find(p => p.id === entry.user_id) || null,
      }));
    },
    enabled: !!currentWorkspace?.id,
  });

  // Calculate weekly hours
  const weeklyData = useMemo(() => {
    if (!myTimeEntries) return [];

    const weekStart = startOfWeek(new Date(), { locale: ptBR });
    const weekEnd = endOfWeek(new Date(), { locale: ptBR });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return weekDays.map((day) => {
      const dayEntries = myTimeEntries.filter((e) =>
        isSameDay(new Date(e.started_at), day)
      );
      const totalSeconds = dayEntries.reduce((acc, e) => acc + (e.duration_seconds || 0), 0);
      return {
        day: format(day, 'EEE', { locale: ptBR }),
        fullDay: format(day, "dd 'de' MMM", { locale: ptBR }),
        hours: Math.round((totalSeconds / 3600) * 10) / 10,
        entries: dayEntries.length,
      };
    });
  }, [myTimeEntries]);

  // Calculate team leaderboard
  const teamLeaderboard = useMemo(() => {
    if (!teamTimeEntries) return [];

    const userTotals: Record<string, { name: string; avatar: string; hours: number }> = {};

    teamTimeEntries.forEach((entry) => {
      const userId = entry.user_id;
      const profile = entry.profile as { full_name: string; avatar_url: string; email: string } | null;
      if (!userTotals[userId]) {
        userTotals[userId] = {
          name: profile?.full_name || profile?.email || 'Usuário',
          avatar: profile?.avatar_url || '',
          hours: 0,
        };
      }
      userTotals[userId].hours += (entry.duration_seconds || 0) / 3600;
    });

    return Object.values(userTotals)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);
  }, [teamTimeEntries]);

  const totalWeeklyHours = weeklyData.reduce((acc, d) => acc + d.hours, 0);
  const totalEntries = myTimeEntries?.length || 0;
  const myRunningTimer = runningTimers?.find((t) => t.user_id === user?.id);

  const isLoading = myTimeLoading || timersLoading || teamTimeLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Tempo
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie o tempo dedicado às atividades
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Esta Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalWeeklyHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">{weeklyData.filter(d => d.entries > 0).length} dias trabalhados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalEntries}</p>
              <p className="text-xs text-muted-foreground">Total de entradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Timer className="h-4 w-4 text-green-500" />
                Timers Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{runningTimers?.length || 0}</p>
              <p className="text-xs text-muted-foreground">No workspace</p>
            </CardContent>
          </Card>

          <Card className={myRunningTimer ? 'border-green-500/50 bg-green-500/5' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {myRunningTimer ? (
                  <Play className="h-4 w-4 text-green-500 animate-pulse" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
                Meu Timer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myRunningTimer ? (
                <>
                  <p className="text-2xl font-bold text-green-600">
                    {formatDuration(differenceInSeconds(new Date(), new Date(myRunningTimer.started_at)))}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {(myRunningTimer.card as { title: string })?.title || 'Sem card'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-muted-foreground">--:--</p>
                  <p className="text-xs text-muted-foreground">Nenhum timer ativo</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="my-time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Meu Tempo
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Ativos
              {(runningTimers?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {runningTimers?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-time" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Weekly Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Horas por Dia</CardTitle>
                  <CardDescription>Tempo registrado nesta semana</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData}>
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
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border rounded-lg p-2 shadow-lg">
                                <p className="text-sm font-medium">{data.fullDay}</p>
                                <p className="text-sm text-muted-foreground">
                                  {data.hours}h • {data.entries} registros
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

              {/* Recent Entries */}
              <Card>
                <CardHeader>
                  <CardTitle>Últimos Registros</CardTitle>
                  <CardDescription>Suas entradas de tempo recentes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {myTimeEntries && myTimeEntries.length > 0 ? (
                      <div className="space-y-2">
                        {myTimeEntries.slice(0, 10).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                {(entry.card as { title: string } | null)?.title || 'Card removido'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.started_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                            <Badge variant={entry.is_running ? 'default' : 'secondary'}>
                              {entry.is_running ? 'Rodando' : formatDuration(entry.duration_seconds || 0)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Clock className="h-8 w-8" />}
                        title="Nenhum tempo registrado"
                        description="Comece a registrar tempo em um card para ver seu histórico aqui."
                        tip="Acesse um card e clique em 'Iniciar Timer' para começar."
                      />
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-green-500" />
                  Timers Ativos no Workspace
                </CardTitle>
                <CardDescription>
                  Quem está trabalhando agora
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runningTimers && runningTimers.length > 0 ? (
                  <div className="space-y-3">
                    {runningTimers.map((timer) => {
                      const profile = timer.profile as { full_name: string; avatar_url: string; email: string } | null;
                      const card = timer.card as { id: string; title: string } | null;
                      const duration = differenceInSeconds(new Date(), new Date(timer.started_at));
                      
                      return (
                        <div
                          key={timer.id}
                          className="flex items-center gap-4 p-4 rounded-lg border bg-green-500/5 border-green-500/20"
                        >
                          <Avatar>
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback>
                              {profile?.full_name?.[0] || profile?.email?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">
                              {profile?.full_name || profile?.email || 'Usuário'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {card?.title || 'Card desconhecido'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              {formatDuration(duration)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Desde {format(new Date(timer.started_at), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Timer className="h-8 w-8" />}
                    title="Nenhum timer ativo"
                    description="Não há ninguém trabalhando com timer ativo no momento."
                    tip="Timers aparecem aqui quando alguém inicia em um card."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Ranking da Semana
                </CardTitle>
                <CardDescription>
                  Horas registradas pela equipe nesta semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teamLeaderboard.length > 0 ? (
                  <div className="space-y-3">
                    {teamLeaderboard.map((member, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                      >
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {index + 1}º
                        </span>
                        <Avatar>
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>{member.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{member.name}</p>
                        </div>
                        <Badge variant="secondary" className="text-base">
                          {member.hours.toFixed(1)}h
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Users className="h-8 w-8" />}
                    title="Sem dados da equipe"
                    description="Nenhum tempo foi registrado pela equipe nesta semana."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default TimePage;
