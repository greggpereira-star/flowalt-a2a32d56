import { useState } from 'react';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  Calendar,
  Banknote,
  Copy,
  MoreHorizontal,
  ArrowUpRight,
  Link2,
  Eye,
  Trash2,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  useDDABoletos,
  useDDASyncStatus,
  useSyncDDA,
  useUpdateBoletoStatus,
  useAddManualBoleto,
  useDeleteBoleto,
  DDABoleto,
} from '@/hooks/useDDA';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30', icon: Clock },
  scheduled: { label: 'Agendado', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: Calendar },
  paid: { label: 'Pago', color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
  expired: { label: 'Vencido', color: 'bg-red-500/20 text-red-600 border-red-500/30', icon: AlertTriangle },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground', icon: XCircle },
  ignored: { label: 'Ignorado', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

export function DDAPanel() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<DDABoleto | null>(null);

  const { data: boletos = [], isLoading } = useDDABoletos({ status: statusFilter });
  const { data: syncStatus } = useDDASyncStatus();
  const syncMutation = useSyncDDA();
  const updateStatusMutation = useUpdateBoletoStatus();
  const addBoletoMutation = useAddManualBoleto();
  const deleteMutation = useDeleteBoleto();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredBoletos = boletos.filter((b) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      b.cedente_nome?.toLowerCase().includes(search) ||
      b.cedente_documento?.includes(search) ||
      b.digitable_line?.includes(search) ||
      b.barcode?.includes(search)
    );
  });

  const stats = {
    pending: boletos.filter((b) => b.status === 'pending').length,
    overdue: boletos.filter((b) => {
      if (b.status !== 'pending') return false;
      return isAfter(new Date(), parseISO(b.data_vencimento));
    }).length,
    totalPending: boletos
      .filter((b) => b.status === 'pending')
      .reduce((sum, b) => sum + b.valor_original, 0),
    dueSoon: boletos.filter((b) => {
      if (b.status !== 'pending') return false;
      const days = differenceInDays(parseISO(b.data_vencimento), new Date());
      return days >= 0 && days <= 7;
    }).length,
  };

  const handleCopyLine = (line: string) => {
    navigator.clipboard.writeText(line);
    toast.success('Linha digitável copiada');
  };

  const handleStatusChange = (boletoId: string, status: DDABoleto['status']) => {
    updateStatusMutation.mutate({ boletoId, status });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getDaysUntilDue = (dueDate: string) => {
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return <span className="text-destructive font-medium">Vencido há {Math.abs(days)} dias</span>;
    if (days === 0) return <span className="text-warning font-medium">Vence hoje</span>;
    if (days <= 7) return <span className="text-warning">{days} dias</span>;
    return <span className="text-muted-foreground">{days} dias</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            DDA - Débito Direto Autorizado
          </h3>
          <p className="text-sm text-muted-foreground">
            Boletos emitidos contra seu CNPJ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !syncStatus?.is_configured}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Boleto
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {!syncStatus?.is_configured && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium">Pluggy não configurado</p>
              <p className="text-sm text-muted-foreground">
                Configure a integração Pluggy em Configurações → Conectores para sincronizar boletos automaticamente.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/settings">Configurar</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Boletos Pendentes</p>
          </CardContent>
        </Card>
        <Card className={stats.overdue > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>
              {stats.overdue}
            </div>
            <p className="text-sm text-muted-foreground">Vencidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.dueSoon}</div>
            <p className="text-sm text-muted-foreground">Vencem em 7 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.totalPending)}
            </div>
            <p className="text-sm text-muted-foreground">Total a Pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boletos</CardTitle>
          {syncStatus?.last_sync && (
            <CardDescription>
              Última sincronização: {format(parseISO(syncStatus.last_sync.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cedente, documento ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="scheduled">Agendados</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
                <SelectItem value="ignored">Ignorados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredBoletos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum boleto encontrado</p>
              {syncStatus?.is_configured && (
                <Button variant="link" onClick={() => syncMutation.mutate()}>
                  Sincronizar agora
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cedente</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBoletos.map((boleto) => (
                  <TableRow key={boleto.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{boleto.cedente_nome}</p>
                          {boleto.cedente_documento && (
                            <p className="text-xs text-muted-foreground">{boleto.cedente_documento}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(boleto.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(boleto.valor_atualizado || boleto.valor_original)}
                    </TableCell>
                    <TableCell>{getStatusBadge(boleto.status)}</TableCell>
                    <TableCell>{getDaysUntilDue(boleto.data_vencimento)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailDialog(boleto)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {boleto.digitable_line && (
                            <DropdownMenuItem onClick={() => handleCopyLine(boleto.digitable_line!)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar Linha Digitável
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {boleto.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleStatusChange(boleto.id, 'paid')}>
                                <CheckCircle className="h-4 w-4 mr-2 text-success" />
                                Marcar como Pago
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(boleto.id, 'scheduled')}>
                                <Calendar className="h-4 w-4 mr-2 text-info" />
                                Agendar Pagamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(boleto.id, 'ignored')}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Ignorar
                              </DropdownMenuItem>
                            </>
                          )}
                          {boleto.status === 'ignored' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(boleto.id, 'pending')}>
                              <ArrowUpRight className="h-4 w-4 mr-2" />
                              Reativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(boleto.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Boleto Dialog */}
      <AddBoletoDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(data) => {
          addBoletoMutation.mutate(data, {
            onSuccess: () => setAddDialogOpen(false),
          });
        }}
        isLoading={addBoletoMutation.isPending}
      />

      {/* Detail Dialog */}
      {detailDialog && (
        <BoletoDetailDialog
          boleto={detailDialog}
          open={!!detailDialog}
          onOpenChange={() => setDetailDialog(null)}
          onCopyLine={handleCopyLine}
        />
      )}
    </div>
  );
}

// Sub-component for adding boleto
function AddBoletoDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<DDABoleto>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    cedente_nome: '',
    cedente_documento: '',
    valor_original: '',
    data_vencimento: '',
    digitable_line: '',
    barcode: '',
    notes: '',
  });

  const handleSubmit = () => {
    if (!formData.cedente_nome || !formData.valor_original || !formData.data_vencimento) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    onSubmit({
      cedente_nome: formData.cedente_nome,
      cedente_documento: formData.cedente_documento || null,
      valor_original: parseFloat(formData.valor_original),
      data_vencimento: formData.data_vencimento,
      digitable_line: formData.digitable_line || null,
      barcode: formData.barcode || null,
      notes: formData.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Boleto Manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Cedente (Emissor) *</Label>
              <Input
                value={formData.cedente_nome}
                onChange={(e) => setFormData({ ...formData, cedente_nome: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label>CNPJ/CPF do Cedente</Label>
              <Input
                value={formData.cedente_documento}
                onChange={(e) => setFormData({ ...formData, cedente_documento: e.target.value })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor_original}
                onChange={(e) => setFormData({ ...formData, valor_original: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Linha Digitável</Label>
              <Input
                value={formData.digitable_line}
                onChange={(e) => setFormData({ ...formData, digitable_line: e.target.value })}
                placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre este boleto"
                rows={2}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component for boleto details
function BoletoDetailDialog({
  boleto,
  open,
  onOpenChange,
  onCopyLine,
}: {
  boleto: DDABoleto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyLine: (line: string) => void;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do Boleto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cedente</span>
              <span className="font-medium">{boleto.cedente_nome}</span>
            </div>
            {boleto.cedente_documento && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CNPJ/CPF</span>
                <span>{boleto.cedente_documento}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(boleto.valor_atualizado || boleto.valor_original)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Vencimento</span>
              <span>
                {format(parseISO(boleto.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {statusConfig[boleto.status] && (
                <Badge variant="outline" className={statusConfig[boleto.status].color}>
                  {statusConfig[boleto.status].label}
                </Badge>
              )}
            </div>
          </div>

          {boleto.digitable_line && (
            <div className="space-y-2">
              <Label>Linha Digitável</Label>
              <div className="flex gap-2">
                <Input value={boleto.digitable_line} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onCopyLine(boleto.digitable_line!)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {boleto.barcode && (
            <div className="space-y-2">
              <Label>Código de Barras</Label>
              <div className="flex gap-2">
                <Input value={boleto.barcode} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => onCopyLine(boleto.barcode!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {boleto.notes && (
            <div className="space-y-2">
              <Label>Observações</Label>
              <p className="text-sm text-muted-foreground">{boleto.notes}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Fonte: {boleto.source === 'pluggy' ? 'Pluggy (Open Finance)' : 'Manual'}
            {boleto.synced_at && (
              <> · Sincronizado em {format(parseISO(boleto.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
