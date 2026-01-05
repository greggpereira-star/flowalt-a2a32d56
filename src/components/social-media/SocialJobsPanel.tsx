/**
 * Social Jobs Panel with Real-time Updates
 * Shows publishing job status with user-friendly error messages
 */

import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  Activity, 
  Wifi, 
  WifiOff,
  AlertTriangle,
  Info,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useRealtimeSocialJobs, getErrorInfo, type SocialJob } from '@/hooks/useRealtimeSocialJobs';

const ACTION_LABELS: Record<string, string> = {
  publish: 'Publicação',
  metrics_sync: 'Sincronização',
  token_refresh: 'Renovação de token',
  retry: 'Nova tentativa',
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente', bgColor: 'bg-muted/50' },
  processing: { icon: Loader2, color: 'text-blue-500', label: 'Processando', bgColor: 'bg-blue-50' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Concluído', bgColor: 'bg-green-50' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Falhou', bgColor: 'bg-red-50' },
};

function JobErrorDisplay({ job }: { job: SocialJob }) {
  const errorInfo = getErrorInfo(job.error_code, job.error_message);
  
  const severityConfig = {
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-800',
      iconColor: 'text-amber-500',
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50 border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-500',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-500',
    },
  };

  const config = severityConfig[errorInfo.severity];
  const Icon = config.icon;

  return (
    <div className={cn("mt-2 p-3 rounded-lg border", config.bgColor)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", config.textColor)}>
            {errorInfo.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {errorInfo.description}
          </p>
          <p className={cn("text-xs font-medium mt-1", config.textColor)}>
            💡 {errorInfo.action}
          </p>
          {errorInfo.isRetryable && (
            <div className="flex items-center gap-1 mt-2">
              <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
              <span className="text-xs text-amber-600">Tentativa automática em andamento</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: SocialJob }) {
  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const isProcessing = job.status === 'processing';
  const isFailed = job.status === 'failed';
  const isCompleted = job.status === 'completed';

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border transition-all",
        isCompleted && "bg-green-50/50 border-green-200",
        isFailed && "bg-red-50/50 border-red-200",
        isProcessing && "bg-blue-50/50 border-blue-200 animate-pulse",
        !isCompleted && !isFailed && !isProcessing && "bg-card hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0",
        statusConfig.bgColor
      )}>
        <StatusIcon 
          className={cn(
            "h-5 w-5",
            statusConfig.color,
            isProcessing && 'animate-spin'
          )} 
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {ACTION_LABELS[job.action] || job.action}
          </span>
          <Badge 
            variant={isCompleted ? 'default' : isFailed ? 'destructive' : 'secondary'}
            className={cn(
              "text-xs",
              isCompleted && "bg-green-500 hover:bg-green-600",
              isProcessing && "bg-blue-500 hover:bg-blue-600"
            )}
          >
            {statusConfig.label}
          </Badge>
          {job.latency_ms && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">
                    {job.latency_ms}ms
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tempo de processamento</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {job.attempts > 1 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs gap-1">
                    <RefreshCw className="h-3 w-3" />
                    {job.attempts}x
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Número de tentativas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Success message */}
        {isCompleted && (
          <div className="mt-2 p-2 bg-green-100 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700">Processado com sucesso!</span>
            {job.result && (job.result as Record<string, string>).platform_url && (
              <a 
                href={(job.result as Record<string, string>).platform_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 bg-white px-2 py-1 rounded"
              >
                <ExternalLink className="h-3 w-3" />
                Ver post
              </a>
            )}
          </div>
        )}
        
        {/* Error display */}
        {isFailed && <JobErrorDisplay job={job} />}
        
        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-2">
          {job.completed_at 
            ? `Finalizado ${formatDistanceToNow(new Date(job.completed_at), { addSuffix: true, locale: ptBR })}`
            : job.started_at 
              ? `Iniciado ${formatDistanceToNow(new Date(job.started_at), { addSuffix: true, locale: ptBR })}`
              : format(new Date(job.created_at), "dd/MM HH:mm", { locale: ptBR })
          }
        </p>
      </div>
    </div>
  );
}

export function SocialJobsPanel() {
  const { 
    jobs, 
    jobStats, 
    isLoading, 
    refetch, 
    realtimeStatus 
  } = useRealtimeSocialJobs();

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
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Jobs de Publicação
            {/* Realtime status indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                    realtimeStatus === 'connected' && "bg-green-100 text-green-700",
                    realtimeStatus === 'connecting' && "bg-amber-100 text-amber-700",
                    realtimeStatus === 'disconnected' && "bg-red-100 text-red-700"
                  )}>
                    {realtimeStatus === 'connected' ? (
                      <Wifi className="h-3 w-3" />
                    ) : realtimeStatus === 'connecting' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <WifiOff className="h-3 w-3" />
                    )}
                    {realtimeStatus === 'connected' ? 'Ao vivo' : 
                     realtimeStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {realtimeStatus === 'connected' 
                      ? 'Atualizações em tempo real ativas' 
                      : realtimeStatus === 'connecting'
                        ? 'Estabelecendo conexão...'
                        : 'Conexão perdida. Clique em atualizar.'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Acompanhe o processamento de posts em tempo real
          </CardDescription>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Stats badges */}
          <div className="flex items-center gap-1">
            {jobStats.processing > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {jobStats.processing}
              </Badge>
            )}
            {jobStats.failed > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {jobStats.failed}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {jobStats.completed}
            </Badge>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Failed jobs alert */}
        {jobStats.failed > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {jobStats.failed} {jobStats.failed === 1 ? 'job falhou' : 'jobs falharam'}
            </AlertTitle>
            <AlertDescription>
              Verifique os detalhes abaixo para entender o problema e como resolver.
            </AlertDescription>
          </Alert>
        )}
        
        {!jobs || jobs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum job processado ainda</p>
            <p className="text-sm mt-1">
              Os jobs aparecerão aqui quando você agendar ou publicar posts
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {jobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </ScrollArea>
        )}
        
        {/* Help section */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Sobre os Jobs</p>
              <p className="mt-0.5">
                Cada publicação agendada cria um job. Erros temporários são 
                automaticamente retentados. Para erros persistentes, siga as 
                instruções de cada item.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SocialJobsPanel;
