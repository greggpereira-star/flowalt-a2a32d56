import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Clock,
  Timer,
  ArrowRight,
  Calendar,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, differenceInSeconds, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

export const WorkRadar: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  // Fetch overdue/critical cards
  const { data: criticalCards, isLoading: cardsLoading } = useQuery({
    queryKey: ['work-radar-cards', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      const now = new Date().toISOString();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get cards owned by user or where user is member
      const { data: ownedCards } = await supabase
        .from('cards')
        .select('id, title, due_date, status, urgency, space_id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_id', user.id)
        .neq('status', 'archived')
        .neq('status', 'delivered')
        .not('due_date', 'is', null)
        .lte('due_date', tomorrow.toISOString())
        .order('due_date', { ascending: true })
        .limit(10);

      return (ownedCards || []).map(card => {
        const dueDate = new Date(card.due_date!);
        const daysUntil = differenceInDays(dueDate, new Date());
        
        let severity: 'critical' | 'warning' | 'info' = 'info';
        if (daysUntil < 0) severity = 'critical';
        else if (isToday(dueDate)) severity = 'warning';

        return { ...card, severity, daysUntil };
      });
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    refetchInterval: 60000,
  });

  // Fetch running timers
  const { data: runningTimers, isLoading: timersLoading } = useQuery({
    queryKey: ['work-radar-timers', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data } = await supabase
        .from('time_entries')
        .select(`
          id, user_id, started_at,
          card:cards(id, title)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_running', true)
        .limit(5);

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      return data.map(timer => ({
        ...timer,
        profile: profiles?.find(p => p.id === timer.user_id),
        duration: differenceInSeconds(new Date(), new Date(timer.started_at)),
      }));
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });

  // Fetch today's events
  const { data: todayEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['work-radar-events', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data } = await supabase
        .from('events')
        .select('id, title, start_time, event_type')
        .eq('workspace_id', currentWorkspace.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  const isLoading = cardsLoading || timersLoading || eventsLoading;
  const hasData = (criticalCards?.length || 0) > 0 || 
                  (runningTimers?.length || 0) > 0 || 
                  (todayEvents?.length || 0) > 0;

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className="col-span-full bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mb-4">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Tudo em dia! 🎉</h3>
          <p className="text-muted-foreground text-sm">
            Nenhum alerta crítico ou atividade urgente no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-yellow-500" />
          Work Radar
        </CardTitle>
        <CardDescription>
          Visão rápida do que precisa de atenção
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Critical Cards */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Atenção Urgente
              {(criticalCards?.length || 0) > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {criticalCards?.length}
                </Badge>
              )}
            </h4>
            <ScrollArea className="h-32">
              {criticalCards && criticalCards.length > 0 ? (
                <div className="space-y-2 pr-2">
                  {criticalCards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => navigate(`/tasks`)}
                      className={`p-2 rounded-md cursor-pointer transition-colors ${
                        card.severity === 'critical' 
                          ? 'bg-destructive/10 hover:bg-destructive/20 border border-destructive/30' 
                          : 'bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30'
                      }`}
                    >
                      <p className="text-sm font-medium truncate">{card.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.daysUntil < 0 
                          ? `${Math.abs(card.daysUntil)} dias de atraso`
                          : isToday(new Date(card.due_date!))
                            ? 'Vence hoje'
                            : 'Vence amanhã'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma tarefa urgente
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Active Timers */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-600">
              <Timer className="h-4 w-4" />
              Timers Ativos
              {(runningTimers?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-auto bg-green-500/20 text-green-600">
                  {runningTimers?.length}
                </Badge>
              )}
            </h4>
            <ScrollArea className="h-32">
              {runningTimers && runningTimers.length > 0 ? (
                <div className="space-y-2 pr-2">
                  {runningTimers.map(timer => (
                    <div
                      key={timer.id}
                      className="p-2 rounded-md bg-green-500/10 border border-green-500/20 flex items-center gap-2"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={timer.profile?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {timer.profile?.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">
                          {(timer.card as { title: string } | null)?.title || 'Card'}
                        </p>
                        <p className="text-xs font-medium text-green-600">
                          {formatDuration(timer.duration)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum timer ativo
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Today's Events */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Agenda de Hoje
              {(todayEvents?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {todayEvents?.length}
                </Badge>
              )}
            </h4>
            <ScrollArea className="h-32">
              {todayEvents && todayEvents.length > 0 ? (
                <div className="space-y-2 pr-2">
                  {todayEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => navigate('/calendar')}
                      className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum evento hoje
                </p>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
            Ver todas as tarefas
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
