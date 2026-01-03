import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SocialJob {
  id: string;
  workspace_id: string;
  post_id: string | null;
  action: string;
  status: string;
  result: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  publish: 'Publicação',
  metrics_sync: 'Sincronização de métricas',
  token_refresh: 'Atualização de token',
  retry: 'Tentativa de retry',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente' },
  processing: { icon: Loader2, color: 'text-blue-500', label: 'Processando' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Concluído' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Falhou' },
};

export function SocialJobsPanel() {
  const { currentWorkspace } = useWorkspace();

  const { data: jobs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['social-jobs', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('social_jobs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as SocialJob[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Jobs de Publicação
          </CardTitle>
          <CardDescription>
            Histórico de processamento de posts agendados
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum job processado ainda</p>
            <p className="text-sm">Os jobs aparecerão aqui quando posts forem agendados</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {jobs.map(job => {
                const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <div 
                    key={job.id} 
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <StatusIcon 
                      className={cn(
                        "h-5 w-5 mt-0.5 flex-shrink-0",
                        statusConfig.color,
                        job.status === 'processing' && 'animate-spin'
                      )} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {ACTION_LABELS[job.action] || job.action}
                        </span>
                        <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                          {statusConfig.label}
                        </Badge>
                        {job.latency_ms && (
                          <span className="text-xs text-muted-foreground">
                            {job.latency_ms}ms
                          </span>
                        )}
                      </div>
                      
                      {job.error_message && (
                        <p className="text-sm text-destructive mt-1 truncate">
                          {job.error_code}: {job.error_message}
                        </p>
                      )}
                      
                      {job.result && Object.keys(job.result).length > 0 && job.status === 'completed' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {(job.result as Record<string, string>).platform_url && (
                            <a 
                              href={(job.result as Record<string, string>).platform_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Ver no {(job.result as Record<string, string>).platform_post_id?.split('_')[0]}
                            </a>
                          )}
                        </p>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-1">
                        {job.completed_at 
                          ? formatDistanceToNow(new Date(job.completed_at), { addSuffix: true, locale: ptBR })
                          : job.started_at 
                            ? `Iniciado ${formatDistanceToNow(new Date(job.started_at), { addSuffix: true, locale: ptBR })}`
                            : format(new Date(job.created_at), "dd/MM HH:mm", { locale: ptBR })
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default SocialJobsPanel;
