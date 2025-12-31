import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaintenanceCosts, useMaintenanceStats, useUpdateMaintenanceStatus, MaintenanceStatus } from "@/hooks/useMaintenanceCosts";
import { Wrench, Clock, CheckCircle, PlayCircle, XCircle, DollarSign, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyInput } from "@/components/ui/currency-input";

const statusConfig: Record<MaintenanceStatus, { icon: React.ReactNode; label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  scheduled: { icon: <Clock className="h-4 w-4" />, label: "Agendada", variant: "outline" },
  in_progress: { icon: <PlayCircle className="h-4 w-4" />, label: "Em Andamento", variant: "secondary" },
  completed: { icon: <CheckCircle className="h-4 w-4" />, label: "Concluída", variant: "default" },
  cancelled: { icon: <XCircle className="h-4 w-4" />, label: "Cancelada", variant: "destructive" },
};

export function MaintenanceWorkflowPanel() {
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | undefined>();
  const { data: maintenances, isLoading, refetch } = useMaintenanceCosts({ status: statusFilter });
  const { data: stats } = useMaintenanceStats();
  const updateStatus = useUpdateMaintenanceStatus();

  const [completeDialog, setCompleteDialog] = useState<{ id: string; itemName: string } | null>(null);
  const [completionData, setCompletionData] = useState({
    solution: '',
    cost: 0,
  });

  const handleStatusChange = async (id: string, newStatus: MaintenanceStatus) => {
    if (newStatus === 'completed') {
      const maintenance = maintenances?.find(m => m.id === id);
      setCompleteDialog({ id, itemName: maintenance?.item_name || '' });
      return;
    }

    await updateStatus.mutateAsync({
      maintenanceId: id,
      status: newStatus,
    });
  };

  const handleComplete = async () => {
    if (!completeDialog) return;

    await updateStatus.mutateAsync({
      maintenanceId: completeDialog.id,
      status: 'completed',
      solutionDescription: completionData.solution,
      cost: completionData.cost,
    });

    setCompleteDialog(null);
    setCompletionData({ solution: '', cost: 0 });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status as MaintenanceStatus] || statusConfig.scheduled;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats?.scheduled || 0}</div>
            <p className="text-sm text-muted-foreground">Agendadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats?.inProgress || 0}</div>
            <p className="text-sm text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats?.completed || 0}</div>
            <p className="text-sm text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalCost || 0)}</div>
            <p className="text-sm text-muted-foreground">Custo Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.warrantyClaims || 0}</div>
            <p className="text-sm text-muted-foreground">Em Garantia</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Workflow de Manutenção
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === undefined ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(undefined)}
            >
              Todas
            </Button>
            <Button
              variant={statusFilter === 'scheduled' ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter('scheduled')}
            >
              Agendadas
            </Button>
            <Button
              variant={statusFilter === 'in_progress' ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter('in_progress')}
            >
              Em Andamento
            </Button>
            <Button
              variant={statusFilter === 'completed' ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter('completed')}
            >
              Concluídas
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : maintenances?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma manutenção encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>S/N</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead>Agendada</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenances?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.item_name}</TableCell>
                    <TableCell>{m.serial_number || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.maintenance_type || 'Geral'}</Badge>
                      {m.is_warranty_claim && (
                        <Badge variant="secondary" className="ml-1">Garantia</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{m.problem_description}</TableCell>
                    <TableCell>{formatDate(m.scheduled_date)}</TableCell>
                    <TableCell>
                      {m.cost ? (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(m.cost)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{renderStatusBadge(m.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {m.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(m.id, 'in_progress')}
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {m.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleStatusChange(m.id, 'completed')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Complete Dialog */}
      <Dialog open={!!completeDialog} onOpenChange={() => setCompleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Manutenção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Concluindo manutenção para: <strong>{completeDialog?.itemName}</strong>
            </p>
            <div className="space-y-2">
              <Label>Solução Aplicada</Label>
              <Textarea
                value={completionData.solution}
                onChange={(e) => setCompletionData(prev => ({ ...prev, solution: e.target.value }))}
                placeholder="Descreva a solução aplicada..."
              />
            </div>
            <div className="space-y-2">
              <Label>Custo da Manutenção (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={completionData.cost}
                onChange={(e) => setCompletionData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                O custo será automaticamente lançado como despesa financeira.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleComplete} disabled={updateStatus.isPending}>
              Concluir Manutenção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
