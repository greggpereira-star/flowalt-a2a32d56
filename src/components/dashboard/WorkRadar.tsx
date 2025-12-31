import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Timer,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Radar,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, differenceInSeconds, isToday } from 'date-fns';
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

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

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
        
        let severity: 'critical' | 'warning' = 'warning';
        if (daysUntil < 0) severity = 'critical';

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
  const hasCriticalItems = (criticalCards?.length || 0) > 0;
  const hasSecondaryData = (runningTimers?.length || 0) > 0 || (todayEvents?.length || 0) > 0;
  const hasAnyData = hasCriticalItems || hasSecondaryData;

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - all clear
  if (!hasAnyData) {
    return (
      <Card className="col-span-full overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-emerald-500/5 via-green-500/5 to-teal-500/5 p-8">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Tudo sob controle</h3>
                <p className="text-sm text-muted-foreground">
                  Nenhuma tarefa crítica ou atividade urgente no momento
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdueCards = criticalCards?.filter(c => c.severity === 'critical') || [];
  const dueTodayCards = criticalCards?.filter(c => c.severity === 'warning') || [];

  return (
    <Card className="col-span-full overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Radar className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Radar de Atenção</h3>
              <p className="text-xs text-muted-foreground">
                {hasCriticalItems 
                  ? `${criticalCards?.length} ${criticalCards?.length === 1 ? 'item requer' : 'itens requerem'} atenção`
                  : 'Atividades em andamento'}
              </p>
            </div>
          </div>
        </div>

        {/* Critical Section */}
        {hasCriticalItems && (
          <div className="p-4 space-y-3">
            {/* Overdue Cards - Most Critical */}
            {overdueCards.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 animate-pulse" />
                  Atrasado
                </span>
                {overdueCards.map(card => (
                  <div
                    key={card.id}
                    onClick={() => navigate('/tasks')}
                    className="group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-l-4 border-destructive hover:bg-destructive/15 hover:translate-x-0.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-destructive transition-colors">
                        {card.title}
                      </p>
                      <p className="text-xs text-destructive/80">
                        {Math.abs(card.daysUntil)} {Math.abs(card.daysUntil) === 1 ? 'dia' : 'dias'} de atraso
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}

            {/* Due Today Cards */}
            {dueTodayCards.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Vence Hoje
                </span>
                {dueTodayCards.map(card => (
                  <div
                    key={card.id}
                    onClick={() => navigate('/tasks')}
                    className="group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 hover:bg-amber-500/15 hover:translate-x-0.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-amber-600 transition-colors">
                        {card.title}
                      </p>
                      <p className="text-xs text-amber-600/80">
                        {isToday(new Date(card.due_date!)) ? 'Vence hoje' : 'Vence amanhã'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Secondary Section - Only if has data */}
        {hasSecondaryData && (
          <div className={`grid ${(runningTimers?.length || 0) > 0 && (todayEvents?.length || 0) > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-px bg-border/50 ${hasCriticalItems ? 'border-t border-border/50' : ''}`}>
            {/* Active Timers */}
            {(runningTimers?.length || 0) > 0 && (
              <div className="p-4 bg-background">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {runningTimers?.length} timer{(runningTimers?.length || 0) > 1 ? 's' : ''} ativo{(runningTimers?.length || 0) > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {runningTimers?.slice(0, 3).map(timer => (
                    <div
                      key={timer.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={timer.profile?.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-emerald-500/20 text-emerald-700">
                          {timer.profile?.full_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate text-foreground">
                          {(timer.card as { title: string } | null)?.title || 'Card'}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-medium text-emerald-600 tabular-nums">
                        {formatDuration(timer.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Events */}
            {(todayEvents?.length || 0) > 0 && (
              <div className="p-4 bg-background">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {todayEvents?.length} evento{(todayEvents?.length || 0) > 1 ? 's' : ''} hoje
                  </span>
                </div>
                <div className="space-y-2">
                  {todayEvents?.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={() => navigate('/calendar')}
                      className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 cursor-pointer hover:bg-blue-500/10 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate text-foreground">{event.title}</p>
                      </div>
                      <span className="text-xs font-mono text-blue-600 tabular-nums">
                        {format(new Date(event.start_time), 'HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Action */}
        <div
          onClick={() => navigate('/tasks')}
          className="px-4 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors group"
        >
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Ver todas as tarefas
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
};
