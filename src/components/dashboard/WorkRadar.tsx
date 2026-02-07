import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Timer,
  Calendar,
  Zap,
  ArrowRight,
  Instagram,
  Share2,
  MessageCircle,
  AtSign,
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

interface FailedSocialPost {
  id: string;
  caption: string | null;
  platform: string;
  error_message: string | null;
  retry_count: number | null;
  updated_at: string;
  account_name?: string;
}

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

  // Fetch failed social media posts (retry_count >= 2 means permanently failed)
  const { data: failedSocialPosts, isLoading: socialLoading } = useQuery({
    queryKey: ['work-radar-social-failures', currentWorkspace?.id],
    queryFn: async (): Promise<FailedSocialPost[]> => {
      if (!currentWorkspace?.id) return [];

      // Get posts that failed after 2+ attempts (permanently failed)
      const { data: posts } = await supabase
        .from('social_posts')
        .select(`
          id, 
          caption, 
          platform, 
          error_message, 
          retry_count, 
          updated_at,
          platform_connection_id
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'failed')
        .gte('retry_count', 2)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!posts || posts.length === 0) return [];

      // Get account names from social_platforms
      const connectionIds = [...new Set(posts.map(p => p.platform_connection_id).filter(Boolean))];
      const { data: platforms } = await supabase
        .from('social_platforms')
        .select('id, account_name')
        .in('id', connectionIds);

      return posts.map(post => ({
        ...post,
        account_name: platforms?.find(p => p.id === post.platform_connection_id)?.account_name,
      }));
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });

  // Fetch unread notifications (mentions and comments)
  const { data: unreadNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['work-radar-notifications', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return [];

      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, message, metadata, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('type', ['mention', 'assignment'])
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    refetchInterval: 30000,
  });

  const isLoading = cardsLoading || timersLoading || eventsLoading || socialLoading || notificationsLoading;
  const criticalCount = criticalCards?.length || 0;
  const failedSocialCount = failedSocialPosts?.length || 0;
  const unreadNotifCount = unreadNotifications?.length || 0;

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-5 gap-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Work Radar</h3>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Visão rápida do que precisa de atenção
        </p>

        {/* 5 Column Grid */}
        <div className="grid grid-cols-5 gap-6">
          {/* Column 1: Atenção Urgente */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">Atenção Urgente</span>
              {criticalCount > 0 && (
                <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  {criticalCount}
                </Badge>
              )}
            </div>

            {criticalCount === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Nenhuma tarefa urgente
              </p>
            ) : (
              <div className="space-y-2">
                {criticalCards?.slice(0, 3).map(card => (
                  <div
                    key={card.id}
                    onClick={() => navigate('/tasks')}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-3 hover:translate-x-0.5 ${
                      card.severity === 'critical'
                        ? 'bg-destructive/5 border-l-destructive hover:bg-destructive/10'
                        : 'bg-amber-500/5 border-l-amber-500 hover:bg-amber-500/10'
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground truncate mb-0.5">
                      {card.title.toUpperCase()}
                    </p>
                    <p className={`text-xs ${
                      card.severity === 'critical' ? 'text-destructive' : 'text-amber-600'
                    }`}>
                      {card.severity === 'critical' 
                        ? `${Math.abs(card.daysUntil)} ${Math.abs(card.daysUntil) === 1 ? 'dia' : 'dias'} de atraso`
                        : 'Vence hoje'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Timers Ativos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Timer className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-600">Timers Ativos</span>
            </div>

            {(runningTimers?.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Nenhum timer ativo
              </p>
            ) : (
              <div className="space-y-2">
                {runningTimers?.slice(0, 3).map(timer => (
                  <div
                    key={timer.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={timer.profile?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-emerald-500/10 text-emerald-700">
                        {timer.profile?.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate text-foreground">
                        {(timer.card as { title: string } | null)?.title || 'Timer'}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-medium text-emerald-600 tabular-nums">
                      {formatDuration(timer.duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 3: Falhas de Social Media */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5 text-pink-600" />
              <span className="text-xs font-medium text-pink-600">Falhas de Publicação</span>
              {failedSocialCount > 0 && (
                <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-pink-500 text-white">
                  {failedSocialCount}
                </Badge>
              )}
            </div>

            {failedSocialCount === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Nenhuma falha de publicação
              </p>
            ) : (
              <div className="space-y-2">
                {failedSocialPosts?.slice(0, 3).map(post => (
                  <div
                    key={post.id}
                    onClick={() => navigate('/marketing')}
                    className="p-3 rounded-lg cursor-pointer transition-all duration-200 bg-pink-500/5 border-l-3 border-l-pink-500 hover:bg-pink-500/10 hover:translate-x-0.5"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {post.platform === 'instagram' ? (
                        <Instagram className="h-3 w-3 text-pink-600" />
                      ) : (
                        <Share2 className="h-3 w-3 text-pink-600" />
                      )}
                      <span className="text-[10px] font-medium text-pink-600">
                        {post.account_name ? `@${post.account_name}` : post.platform}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate mb-0.5">
                      {post.caption?.substring(0, 40) || 'Sem legenda'}
                      {(post.caption?.length || 0) > 40 && '...'}
                    </p>
                    <p className="text-[10px] text-pink-600">
                      {post.retry_count || 0} tentativas falharam
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 4: Agenda de Hoje */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-medium text-foreground">Agenda de Hoje</span>
            </div>

            {(todayEvents?.length || 0) === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Nenhum evento hoje
              </p>
            ) : (
              <div className="space-y-2">
                {todayEvents?.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={() => navigate('/calendar')}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate text-foreground">{event.title}</p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {format(new Date(event.start_time), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 5: Mensagens e Menções */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Mensagens</span>
              {unreadNotifCount > 0 && (
                <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-primary text-primary-foreground">
                  {unreadNotifCount}
                </Badge>
              )}
            </div>

            {unreadNotifCount === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Nenhuma mensagem não lida
              </p>
            ) : (
              <div className="space-y-2">
                {unreadNotifications?.slice(0, 3).map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => {
                      const spaceId = (notification.metadata as Record<string, unknown>)?.space_id;
                      const cardId = (notification.metadata as Record<string, unknown>)?.card_id;
                      if (spaceId && cardId) {
                        navigate(`/space/${spaceId}?card=${cardId}`);
                      } else if (cardId) {
                        navigate(`/workspace?card=${cardId}`);
                      }
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-3 hover:translate-x-0.5 ${
                      notification.type === 'mention'
                        ? 'bg-primary/5 border-l-primary hover:bg-primary/10'
                        : 'bg-muted/50 border-l-muted-foreground/30 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {notification.type === 'mention' ? (
                        <AtSign className="h-3 w-3 text-primary" />
                      ) : (
                        <MessageCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {notification.type === 'mention' ? 'Menção' : 'Nova mensagem'}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">
                      {notification.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4 border-t border-border/50">
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            Ver todas as tarefas
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
