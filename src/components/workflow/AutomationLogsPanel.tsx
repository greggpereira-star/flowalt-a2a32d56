import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  History,
  CheckCircle,
  XCircle,
  Zap,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Bell,
  UserPlus,
  CheckSquare,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutomationLogsPanelProps {
  limit?: number;
  showHeader?: boolean;
}

const ACTION_ICONS: Record<string, typeof Zap> = {
  change_status: RefreshCw,
  set_urgency: AlertTriangle,
  add_comment: MessageSquare,
  send_notification: Bell,
  assign_owner: UserPlus,
  create_checklist: CheckSquare,
};

const ACTION_LABELS: Record<string, string> = {
  change_status: 'Mudar Etapa',
  set_urgency: 'Definir Urgência',
  add_comment: 'Adicionar Comentário',
  send_notification: 'Enviar Notificação',
  assign_owner: 'Atribuir Responsável',
  create_checklist: 'Criar Checklist',
};

export function AutomationLogsPanel({ limit = 50, showHeader = true }: AutomationLogsPanelProps) {
  const { currentWorkspace } = useWorkspace();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['automation-logs-all', currentWorkspace?.id, limit],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('automation_logs')
        .select(`
          *,
          automation:card_automations(name),
          card:cards(title)
        `)
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  if (isLoading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Automações
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {logs?.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-12 w-12" />}
            title="Nenhuma execução registrada"
            description="As execuções de automações aparecerão aqui"
          />
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs?.map((log) => {
                const ActionIcon = ACTION_ICONS[log.action_type] || Zap;
                const actionLabel = ACTION_LABELS[log.action_type] || log.action_type;

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      log.success ? 'bg-card' : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        log.success ? 'bg-green-500/10' : 'bg-destructive/10'
                      }`}
                    >
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {(log.automation as any)?.name || 'Automação'}
                        </span>
                        <Badge variant="outline" className="gap-1">
                          <ActionIcon className="h-3 w-3" />
                          {actionLabel}
                        </Badge>
                        {!log.success && (
                          <Badge variant="destructive">Falhou</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Card: {(log.card as any)?.title || 'N/A'}</span>
                        <span>•</span>
                        <span>Gatilho: {log.trigger_status}</span>
                      </div>

                      {log.error_message && (
                        <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                          {log.error_message}
                        </div>
                      )}

                      {log.action_result && log.success && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {JSON.stringify(log.action_result)}
                        </div>
                      )}
                    </div>

                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(log.executed_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {new Date(log.executed_at).toLocaleString('pt-BR')}
                      </TooltipContent>
                    </Tooltip>
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
