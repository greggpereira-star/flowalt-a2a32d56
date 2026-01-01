import { useMemo } from 'react';
import { format, parseISO, isAfter, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Banknote,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDDABoletos, useDDASyncStatus } from '@/hooks/useDDA';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function DDADashboardWidget() {
  const navigate = useNavigate();
  const { data: boletos = [], isLoading } = useDDABoletos();
  const { data: syncStatus } = useDDASyncStatus();

  const stats = useMemo(() => {
    const now = new Date();
    const pending = boletos.filter(
      (b) => b.status === 'pending' && b.workflow_status !== 'ignored' && !b.deleted_at
    );
    const overdue = pending.filter((b) => isAfter(now, parseISO(b.data_vencimento)));
    const dueSoon = pending.filter((b) => {
      const days = differenceInDays(parseISO(b.data_vencimento), now);
      return days >= 0 && days <= 7;
    });
    const linked = boletos.filter((b) => b.linked_ap_id || b.transaction_id);
    const paid = boletos.filter((b) => b.status === 'paid');

    const totalPending = pending.reduce((sum, b) => sum + b.valor_original, 0);
    const totalOverdue = overdue.reduce((sum, b) => sum + b.valor_original, 0);

    return {
      total: boletos.length,
      pending: pending.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      linked: linked.length,
      paid: paid.length,
      totalPending,
      totalOverdue,
      linkedPercent: boletos.length > 0 ? Math.round((linked.length / boletos.length) * 100) : 0,
    };
  }, [boletos]);

  // Top 5 boletos mais urgentes
  const urgentBoletos = useMemo(() => {
    const now = new Date();
    return boletos
      .filter((b) => b.status === 'pending' && !b.deleted_at)
      .sort((a, b) => parseISO(a.data_vencimento).getTime() - parseISO(b.data_vencimento).getTime())
      .slice(0, 5)
      .map((b) => ({
        ...b,
        isOverdue: isAfter(now, parseISO(b.data_vencimento)),
        daysUntilDue: differenceInDays(parseISO(b.data_vencimento), now),
      }));
  }, [boletos]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              DDA - Boletos
            </CardTitle>
            <CardDescription>Débitos autorizados contra seu CNPJ</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/financial')}>
            <ExternalLink className="w-4 h-4 mr-1" />
            Ver todos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div
            className={`text-center p-2 rounded-lg ${
              stats.overdue > 0 ? 'bg-destructive/10' : 'bg-muted/50'
            }`}
          >
            <p className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>
              {stats.overdue}
            </p>
            <p className="text-xs text-muted-foreground">Vencidos</p>
          </div>
          <div
            className={`text-center p-2 rounded-lg ${
              stats.dueSoon > 0 ? 'bg-amber-500/10' : 'bg-muted/50'
            }`}
          >
            <p className={`text-2xl font-bold ${stats.dueSoon > 0 ? 'text-amber-600' : ''}`}>
              {stats.dueSoon}
            </p>
            <p className="text-xs text-muted-foreground">7 dias</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">Pagos</p>
          </div>
        </div>

        {/* Total Pending */}
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            <span className="text-sm">Total Pendente</span>
          </div>
          <span className="text-lg font-bold">{formatCurrency(stats.totalPending)}</span>
        </div>

        {/* Overdue Alert */}
        {stats.overdue > 0 && (
          <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="text-sm text-destructive">Vencidos</span>
            </div>
            <span className="text-lg font-bold text-destructive">
              {formatCurrency(stats.totalOverdue)}
            </span>
          </div>
        )}

        {/* Linked Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vinculados</span>
            <span className="font-medium">{stats.linkedPercent}%</span>
          </div>
          <Progress value={stats.linkedPercent} className="h-2" />
        </div>

        {/* Urgent Boletos List */}
        {urgentBoletos.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Próximos Vencimentos</p>
            <div className="space-y-1">
              {urgentBoletos.map((boleto) => (
                <div
                  key={boleto.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{boleto.cedente_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(boleto.data_vencimento), 'dd/MM', { locale: ptBR })}
                      {boleto.isOverdue ? (
                        <Badge variant="destructive" className="ml-2 text-[10px] h-4">
                          Vencido
                        </Badge>
                      ) : boleto.daysUntilDue <= 3 ? (
                        <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-amber-500/10 text-amber-600 border-amber-500/30">
                          {boleto.daysUntilDue}d
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatCurrency(boleto.valor_original)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Sync */}
        {syncStatus?.last_sync && (
          <p className="text-xs text-muted-foreground text-center">
            Última sync:{' '}
            {format(parseISO(syncStatus.last_sync.synced_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
