import { useMemo } from 'react';
import { format, parseISO, isAfter, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Clock,
  Banknote,
  FileText,
  RefreshCw,
  XCircle,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDDABoletos, useDDASyncStatus } from '@/hooks/useDDA';
import { DDABoleto } from '@/hooks/useDDA';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface DDAAlert {
  id: string;
  type: 'overdue' | 'due_soon' | 'high_value' | 'sync_failed' | 'unlinked';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  boleto?: DDABoleto;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface DDAAlertsProps {
  highValueThreshold?: number;
  onBoletoClick?: (boleto: DDABoleto) => void;
  onSyncClick?: () => void;
  maxAlerts?: number;
}

export function DDAAlerts({
  highValueThreshold = 10000,
  onBoletoClick,
  onSyncClick,
  maxAlerts = 10,
}: DDAAlertsProps) {
  const { data: boletos = [], isLoading: boletosLoading } = useDDABoletos();
  const { data: syncStatus, isLoading: syncLoading } = useDDASyncStatus();

  const alerts = useMemo(() => {
    const now = new Date();
    const alertList: DDAAlert[] = [];

    const pendingBoletos = boletos.filter(
      (b) => b.status === 'pending' && b.workflow_status !== 'ignored' && !b.deleted_at
    );

    // Overdue boletos
    const overdueBoletos = pendingBoletos.filter((b) => isAfter(now, parseISO(b.data_vencimento)));
    overdueBoletos.forEach((boleto) => {
      const daysOverdue = differenceInDays(now, parseISO(boleto.data_vencimento));
      alertList.push({
        id: `overdue-${boleto.id}`,
        type: 'overdue',
        severity: 'error',
        title: `Boleto vencido há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}`,
        description: `${boleto.cedente_nome} - ${formatCurrency(boleto.valor_original)}`,
        boleto,
        action: onBoletoClick
          ? { label: 'Ver detalhes', onClick: () => onBoletoClick(boleto) }
          : undefined,
      });
    });

    // Due soon (next 3 days)
    const dueSoonBoletos = pendingBoletos.filter((b) => {
      const days = differenceInDays(parseISO(b.data_vencimento), now);
      return days >= 0 && days <= 3;
    });
    dueSoonBoletos.forEach((boleto) => {
      const daysUntilDue = differenceInDays(parseISO(boleto.data_vencimento), now);
      alertList.push({
        id: `due-soon-${boleto.id}`,
        type: 'due_soon',
        severity: 'warning',
        title: daysUntilDue === 0 ? 'Vence hoje' : `Vence em ${daysUntilDue} dia${daysUntilDue > 1 ? 's' : ''}`,
        description: `${boleto.cedente_nome} - ${formatCurrency(boleto.valor_original)}`,
        boleto,
        action: onBoletoClick
          ? { label: 'Ver detalhes', onClick: () => onBoletoClick(boleto) }
          : undefined,
      });
    });

    // High value boletos (not already in overdue or due soon)
    const highValueBoletos = pendingBoletos.filter(
      (b) =>
        b.valor_original >= highValueThreshold &&
        !overdueBoletos.includes(b) &&
        !dueSoonBoletos.includes(b)
    );
    highValueBoletos.forEach((boleto) => {
      alertList.push({
        id: `high-value-${boleto.id}`,
        type: 'high_value',
        severity: 'info',
        title: 'Boleto de alto valor',
        description: `${boleto.cedente_nome} - ${formatCurrency(boleto.valor_original)}`,
        boleto,
        action: onBoletoClick
          ? { label: 'Ver detalhes', onClick: () => onBoletoClick(boleto) }
          : undefined,
      });
    });

    // Unlinked boletos (more than 5)
    const unlinkedBoletos = pendingBoletos.filter((b) => !b.linked_ap_id && !b.transaction_id);
    if (unlinkedBoletos.length > 5) {
      alertList.push({
        id: 'unlinked-many',
        type: 'unlinked',
        severity: 'warning',
        title: `${unlinkedBoletos.length} boletos não vinculados`,
        description: 'Vincule os boletos a Contas a Pagar para melhor controle',
      });
    }

    // Sync failed
    if (syncStatus?.last_sync?.status === 'error') {
      alertList.push({
        id: 'sync-failed',
        type: 'sync_failed',
        severity: 'error',
        title: 'Falha na sincronização DDA',
        description: syncStatus.last_sync.error_message || 'Erro ao sincronizar boletos',
        action: onSyncClick ? { label: 'Tentar novamente', onClick: onSyncClick } : undefined,
      });
    }

    // Sort by severity (error first, then warning, then info)
    const severityOrder = { error: 0, warning: 1, info: 2 };
    alertList.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alertList.slice(0, maxAlerts);
  }, [boletos, syncStatus, highValueThreshold, onBoletoClick, onSyncClick, maxAlerts]);

  const isLoading = boletosLoading || syncLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alertas DDA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum alerta no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const severityConfig = {
    error: {
      bgColor: 'bg-destructive/10 border-destructive/30',
      iconColor: 'text-destructive',
      icon: AlertTriangle,
    },
    warning: {
      bgColor: 'bg-amber-500/10 border-amber-500/30',
      iconColor: 'text-amber-600',
      icon: Clock,
    },
    info: {
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      iconColor: 'text-blue-600',
      icon: Banknote,
    },
  };

  const errorCount = alerts.filter((a) => a.severity === 'error').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alertas DDA
          </CardTitle>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {errorCount} crítico{errorCount > 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                {warningCount} atenção
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor}`}
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
              </div>
              {alert.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 text-xs h-7"
                  onClick={alert.action.onClick}
                >
                  {alert.action.label}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
