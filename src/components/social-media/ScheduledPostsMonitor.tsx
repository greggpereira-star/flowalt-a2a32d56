/**
 * Scheduled Posts Monitor
 * Real-time monitoring of scheduled posts with countdown and status tracking
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Calendar,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  AlertTriangle,
  PlayCircle,
  Timer
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInSeconds, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduledPost {
  id: string;
  title: string;
  platform: string;
  content_type: string;
  status: string;
  scheduled_at: string;
  retry_count: number;
  error_message: string | null;
  error_code: string | null;
  processing_started_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  platform_url: string | null;
  created_at: string;
  updated_at: string;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  publishing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  published: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  draft: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Agendado',
  publishing: 'Publicando...',
  published: 'Publicado',
  failed: 'Falhou',
  draft: 'Rascunho',
};

function Countdown({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = differenceInSeconds(targetDate, now);
      
      if (diff <= 0) {
        setIsOverdue(true);
        setTimeLeft('Publicação iminente...');
        return;
      }
      
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
      setIsOverdue(false);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono ${isOverdue ? 'text-yellow-500' : 'text-muted-foreground'}`}>
      <Timer className="h-3.5 w-3.5" />
      {timeLeft}
    </div>
  );
}

export function ScheduledPostsMonitor() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Fetch posts with relevant statuses
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ['scheduled-posts-monitor', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .in('status', ['scheduled', 'publishing', 'published', 'failed'])
        .order('scheduled_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as unknown as ScheduledPost[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel(`scheduled-posts-monitor-${currentWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        (payload) => {
          console.log('[Monitor] Post update:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['scheduled-posts-monitor'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id, queryClient]);

  // Group posts by status
  const scheduledPosts = posts?.filter(p => p.status === 'scheduled') || [];
  const publishingPosts = posts?.filter(p => p.status === 'publishing') || [];
  const recentPublished = posts?.filter(p => p.status === 'published').slice(0, 5) || [];
  const failedPosts = posts?.filter(p => p.status === 'failed') || [];

  // Next post to be published
  const nextPost = scheduledPosts[0];
  const nextPostDate = nextPost ? new Date(nextPost.scheduled_at) : null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Monitor de Agendamentos
            </CardTitle>
            <CardDescription className="mt-1">
              Acompanhe o status dos seus posts em tempo real
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={realtimeStatus === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}
            >
              {realtimeStatus === 'connected' ? 'Conectado' : 'Reconectando...'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Next Post Highlight */}
        {nextPost && nextPostDate && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">Próxima Publicação</span>
              <Countdown targetDate={nextPostDate} />
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background">
                {platformIcons[nextPost.platform] || <Calendar className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{nextPost.title || 'Post sem título'}</p>
                <p className="text-sm text-muted-foreground">
                  {format(nextPostDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Badge variant="outline" className={statusColors[nextPost.status]}>
                {statusLabels[nextPost.status]}
              </Badge>
            </div>
          </div>
        )}

        {/* Publishing in Progress */}
        {publishingPosts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Publicando agora ({publishingPosts.length})
            </div>
            {publishingPosts.map(post => (
              <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <PlayCircle className="h-4 w-4 text-yellow-500 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{post.title || 'Post'}</p>
                  <p className="text-xs text-muted-foreground">
                    Iniciado {post.processing_started_at && formatDistanceToNow(new Date(post.processing_started_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {platformIcons[post.platform]}
              </div>
            ))}
          </div>
        )}

        {/* Failed Posts Alert */}
        {failedPosts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-500">
              <XCircle className="h-4 w-4" />
              Falhas recentes ({failedPosts.length})
            </div>
            {failedPosts.slice(0, 3).map(post => (
              <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{post.title || 'Post'}</p>
                  <p className="text-xs text-red-400 truncate">
                    {post.error_message || post.error_code || 'Erro desconhecido'}
                  </p>
                </div>
                <Badge variant="outline" className="text-red-500">
                  {post.retry_count > 0 ? `${post.retry_count} tentativas` : 'Falhou'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Upcoming Posts Queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Fila de Agendamentos</span>
            <span className="text-xs text-muted-foreground">{scheduledPosts.length} posts</span>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum post agendado</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {scheduledPosts.map((post, index) => {
                  const scheduledDate = new Date(post.scheduled_at);
                  const isOverdue = isPast(scheduledDate);
                  
                  return (
                    <div 
                      key={post.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                        ${index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50'}
                        ${isOverdue ? 'ring-1 ring-yellow-500/50' : ''}
                      `}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="p-1.5 rounded bg-background">
                        {platformIcons[post.platform] || <Calendar className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{post.title || 'Post sem título'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(scheduledDate, "dd/MM HH:mm")}</span>
                          <span>•</span>
                          <span className="capitalize">{post.content_type || 'feed'}</span>
                        </div>
                      </div>
                      {isOverdue && (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs">
                          Aguardando
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Recent Success */}
        {recentPublished.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                Publicados recentemente
              </div>
              <div className="space-y-1">
                {recentPublished.map(post => (
                  <div key={post.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    {platformIcons[post.platform]}
                    <span className="truncate flex-1">{post.title}</span>
                    <span className="text-xs">
                      {post.published_at && formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ScheduledPostsMonitor;
