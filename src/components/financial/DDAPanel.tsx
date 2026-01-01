import { useState, useMemo, useEffect } from 'react';
import { format, parseISO, differenceInDays, isAfter, addDays } from 'date-fns';
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
  Copy,
  MoreHorizontal,
  ArrowUpRight,
  Eye,
  Trash2,
  Building2,
  Wallet,
  Link2,
  GitMerge,
  FileCheck,
  ArrowRight,
  Banknote,
  TrendingUp,
  AlertCircle,
  Zap,
  Shield,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAutoReconcileDDA } from '@/hooks/useDDAMatching';
import {
  useDDABoletos,
  useDDASyncStatus,
  useSyncDDA,
  useUpdateBoletoStatus,
  useAddManualBoleto,
  useDeleteBoleto,
  useLinkBoletoToTransaction,
  DDABoleto,
  WorkflowStatus,
} from '@/hooks/useDDA';
import { DDAQAChecklist } from './DDAQAChecklist';
import { PluggyConnectButton } from './PluggyConnectButton';

// Workflow status configuration
const workflowConfig: Record<WorkflowStatus, { label: string; color: string; icon: React.ElementType; next?: WorkflowStatus }> = {
  captured: { label: 'Capturado', color: 'bg-slate-500/20 text-slate-600 border-slate-500/30', icon: FileText, next: 'reviewed' },
  reviewed: { label: 'Revisado', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: FileCheck, next: 'ap_created' },
  ap_created: { label: 'Conta Criada', color: 'bg-purple-500/20 text-purple-600 border-purple-500/30', icon: Wallet, next: 'awaiting_payment' },
  awaiting_payment: { label: 'Aguardando Pgto', color: 'bg-amber-500/20 text-amber-600 border-amber-500/30', icon: Clock, next: 'paid_reconciled' },
  paid_reconciled: { label: 'Pago/Conciliado', color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
  ignored: { label: 'Ignorado', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30', icon: Clock },
  scheduled: { label: 'Agendado', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: Calendar },
  paid: { label: 'Pago', color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
  expired: { label: 'Vencido', color: 'bg-red-500/20 text-red-600 border-red-500/30', icon: AlertTriangle },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground', icon: XCircle },
  ignored: { label: 'Ignorado', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

export function DDAPanel() {
  const { currentWorkspace } = useWorkspace();
  const permissions = usePermissions();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');
  const [linkedFilter, setLinkedFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<DDABoleto | null>(null);
  const [createAPDialog, setCreateAPDialog] = useState<DDABoleto | null>(null);
  const [linkTransactionDialog, setLinkTransactionDialog] = useState<DDABoleto | null>(null);
  const [matchesDialog, setMatchesDialog] = useState<DDABoleto | null>(null);

  const { data: boletos = [], isLoading, refetch } = useDDABoletos({ status: statusFilter !== 'all' ? statusFilter : undefined });
  const { data: syncStatus } = useDDASyncStatus();
  const syncMutation = useSyncDDA();
  const updateStatusMutation = useUpdateBoletoStatus();
  const addBoletoMutation = useAddManualBoleto();
  const deleteMutation = useDeleteBoleto();
  const linkMutation = useLinkBoletoToTransaction();
  const autoReconcileMutation = useAutoReconcileDDA();

  // Permission checks
  const canManage = permissions.canManageFinancial;
  const canDelete = permissions.isOwner || permissions.isAdmin;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Apply all filters
  const filteredBoletos = useMemo(() => {
    return boletos.filter((b) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchSearch = 
          b.cedente_nome?.toLowerCase().includes(search) ||
          b.cedente_documento?.includes(search) ||
          b.digitable_line?.includes(search) ||
          b.barcode?.includes(search);
        if (!matchSearch) return false;
      }

      // Workflow filter
      if (workflowFilter !== 'all' && b.workflow_status !== workflowFilter) return false;

      // Due date filter
      if (dueDateFilter !== 'all') {
        const dueDate = parseISO(b.data_vencimento);
        const today = new Date();
        
        if (dueDateFilter === 'overdue' && !isAfter(today, dueDate)) return false;
        if (dueDateFilter === 'today' && format(dueDate, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd')) return false;
        if (dueDateFilter === 'week') {
          const weekFromNow = addDays(today, 7);
          if (isAfter(today, dueDate) || isAfter(dueDate, weekFromNow)) return false;
        }
        if (dueDateFilter === 'month') {
          const monthFromNow = addDays(today, 30);
          if (isAfter(today, dueDate) || isAfter(dueDate, monthFromNow)) return false;
        }
      }

      // Linked filter
      if (linkedFilter === 'linked' && !b.linked_ap_id && !b.transaction_id) return false;
      if (linkedFilter === 'unlinked' && (b.linked_ap_id || b.transaction_id)) return false;

      return true;
    });
  }, [boletos, searchTerm, workflowFilter, dueDateFilter, linkedFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const pending = boletos.filter((b) => b.status === 'pending' && b.workflow_status !== 'ignored');
    const overdue = pending.filter((b) => isAfter(now, parseISO(b.data_vencimento)));
    const dueSoon = pending.filter((b) => {
      const days = differenceInDays(parseISO(b.data_vencimento), now);
      return days >= 0 && days <= 7;
    });
    const unlinked = boletos.filter((b) => !b.linked_ap_id && !b.transaction_id && b.workflow_status !== 'ignored');
    const totalPending = pending.reduce((sum, b) => sum + b.valor_original, 0);
    const totalOverdue = overdue.reduce((sum, b) => sum + b.valor_original, 0);

    return {
      total: boletos.length,
      pending: pending.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      unlinked: unlinked.length,
      totalPending,
      totalOverdue,
      linkedPercent: boletos.length > 0 
        ? Math.round(((boletos.length - unlinked.length) / boletos.length) * 100) 
        : 0,
    };
  }, [boletos]);

  const handleCopyLine = (line: string) => {
    navigator.clipboard.writeText(line);
    toast.success('Linha digitável copiada');
  };

  const handleWorkflowChange = async (boletoId: string, newStatus: WorkflowStatus) => {
    const updateData: Record<string, unknown> = { workflow_status: newStatus };
    
    if (newStatus === 'reviewed') {
      updateData.reviewed_at = new Date().toISOString();
    }
    
    if (newStatus === 'paid_reconciled') {
      updateData.status = 'paid';
      updateData.data_pagamento = new Date().toISOString().split('T')[0];
    }
    
    if (newStatus === 'ignored') {
      updateData.status = 'ignored';
    }

    try {
      const { error } = await supabase
        .from('dda_boletos')
        .update(updateData)
        .eq('id', boletoId);

      if (error) throw error;
      
      toast.success(`Status alterado para "${workflowConfig[newStatus].label}"`);
      refetch();
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSoftDelete = async (boletoId: string) => {
    try {
      const { error } = await supabase
        .from('dda_boletos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', boletoId);

      if (error) throw error;
      
      toast.success('Boleto removido');
      refetch();
    } catch {
      toast.error('Erro ao remover boleto');
    }
  };

  const getWorkflowBadge = (status: WorkflowStatus) => {
    const config = workflowConfig[status] || workflowConfig.captured;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
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
    if (days < 0) return <span className="text-destructive font-medium">Vencido há {Math.abs(days)}d</span>;
    if (days === 0) return <span className="text-warning font-medium">Vence hoje</span>;
    if (days <= 3) return <span className="text-warning">{days}d</span>;
    if (days <= 7) return <span className="text-amber-600">{days}d</span>;
    return <span className="text-muted-foreground">{days}d</span>;
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
            Boletos emitidos contra seu CNPJ • Fluxo de Contas a Pagar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => autoReconcileMutation.mutate()}
                  disabled={autoReconcileMutation.isPending || !canManage}
                >
                  <Zap className={`w-4 h-4 mr-2 ${autoReconcileMutation.isPending ? 'animate-pulse' : ''}`} />
                  Auto-conciliar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Busca automaticamente transações pagas que correspondem a boletos pendentes</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !syncStatus?.is_configured}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          
          {canManage && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Integration Status */}
      {syncStatus?.is_configured ? (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-green-700">Pluggy conectado e ativo</p>
              <p className="text-sm text-muted-foreground">
                {syncStatus.last_sync 
                  ? `Última sincronização: ${format(new Date(syncStatus.last_sync.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                  : 'Nenhuma sincronização realizada ainda. Clique em "Sincronizar" para buscar boletos.'
                }
              </p>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
              <Shield className="w-3 h-3 mr-1" />
              Integração Ativa
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium">Pluggy não configurado</p>
              <p className="text-sm text-muted-foreground">
                Não há integração Pluggy ativa para o workspace atual{currentWorkspace?.name ? ` (${currentWorkspace.name})` : ''}. Configure em Configurações → Conectores.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/settings?tab=connectors">Configurar</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bank Account Connection */}
      {syncStatus?.is_configured && (
        <PluggyConnectButton />
      )}

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Boletos</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-2xl font-bold">{stats.pending}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
          </CardContent>
        </Card>
        
        <Card className={stats.overdue > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-4 h-4 ${stats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>
                {stats.overdue}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Vencidos</p>
            {stats.totalOverdue > 0 && (
              <p className="text-xs text-destructive font-medium">{formatCurrency(stats.totalOverdue)}</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-2xl font-bold">{stats.dueSoon}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Vencem em 7d</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary" />
              <span className="text-lg font-bold text-primary">
                {formatCurrency(stats.totalPending)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Pendente</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-2xl font-bold">{stats.linkedPercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Vinculados</p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Pipeline Visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline de Workflow</CardTitle>
          <CardDescription>Fluxo: Capturado → Revisado → Conta Criada → Aguardando → Pago</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {(['captured', 'reviewed', 'ap_created', 'awaiting_payment', 'paid_reconciled'] as WorkflowStatus[]).map((status, idx) => {
              const config = workflowConfig[status];
              const Icon = config.icon;
              const count = boletos.filter(b => b.workflow_status === status).length;
              
              return (
                <div key={status} className="flex items-center">
                  <button
                    onClick={() => setWorkflowFilter(workflowFilter === status ? 'all' : status)}
                    className={`flex flex-col items-center p-3 rounded-lg border transition-all min-w-[100px] ${
                      workflowFilter === status 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium mt-1">{config.label}</span>
                    <span className="text-lg font-bold">{count}</span>
                  </button>
                  {idx < 4 && <ArrowRight className="w-4 h-4 text-muted-foreground mx-1 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Boletos</CardTitle>
              {syncStatus?.last_sync && (
                <CardDescription>
                  Última sync: {format(parseISO(syncStatus.last_sync.synced_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredBoletos.length} resultados</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cedente, documento, código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
              <SelectTrigger className="w-[150px]">
                <GitMerge className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(workflowConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Próx. 7 dias</SelectItem>
                <SelectItem value="month">Próx. 30 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={linkedFilter} onValueChange={setLinkedFilter}>
              <SelectTrigger className="w-[150px]">
                <Link2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Vínculo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="linked">Vinculados</SelectItem>
                <SelectItem value="unlinked">Não vinculados</SelectItem>
              </SelectContent>
            </Select>

            {(workflowFilter !== 'all' || dueDateFilter !== 'all' || linkedFilter !== 'all' || searchTerm) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setWorkflowFilter('all');
                  setDueDateFilter('all');
                  setLinkedFilter('all');
                  setSearchTerm('');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredBoletos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Nenhum boleto encontrado</p>
              <p className="text-sm">
                {syncStatus?.is_configured 
                  ? 'Clique em "Sincronizar" para buscar boletos' 
                  : 'Configure o Pluggy para começar'}
              </p>
              {syncStatus?.is_configured && (
                <Button variant="link" onClick={() => syncMutation.mutate()} className="mt-2">
                  Sincronizar agora
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cedente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBoletos.map((boleto) => (
                    <TableRow key={boleto.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px]">{boleto.cedente_nome}</p>
                            {boleto.cedente_documento && (
                              <p className="text-xs text-muted-foreground">{boleto.cedente_documento}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatCurrency(boleto.valor_atualizado || boleto.valor_original)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">
                            {format(parseISO(boleto.data_vencimento), 'dd/MM/yyyy')}
                          </p>
                          <p className="text-xs">{getDaysUntilDue(boleto.data_vencimento)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getWorkflowBadge(boleto.workflow_status || 'captured')}
                      </TableCell>
                      <TableCell>
                        {boleto.linked_ap_id || boleto.transaction_id ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <Link2 className="w-3 h-3 mr-1" />
                            Vinculado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Não vinculado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setDetailSheet(boleto)}>
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
                            
                            {/* Workflow Actions */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <GitMerge className="h-4 w-4 mr-2" />
                                Alterar Workflow
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {Object.entries(workflowConfig).map(([key, config]) => {
                                  const Icon = config.icon;
                                  return (
                                    <DropdownMenuItem 
                                      key={key}
                                      onClick={() => handleWorkflowChange(boleto.id, key as WorkflowStatus)}
                                      disabled={boleto.workflow_status === key}
                                    >
                                      <Icon className="h-4 w-4 mr-2" />
                                      {config.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            
                            <DropdownMenuSeparator />
                            
                            {/* AP Actions - only if user can manage */}
                            {canManage && !boleto.linked_ap_id && boleto.workflow_status !== 'paid_reconciled' && (
                              <>
                                <DropdownMenuItem onClick={() => setCreateAPDialog(boleto)}>
                                  <Wallet className="h-4 w-4 mr-2 text-primary" />
                                  Criar Conta a Pagar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLinkTransactionDialog(boleto)}>
                                  <Link2 className="h-4 w-4 mr-2" />
                                  Vincular a Transação
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setMatchesDialog(boleto)}>
                                  <ArrowUpRight className="h-4 w-4 mr-2" />
                                  Buscar Matches
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {/* Delete - only admin/owner */}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleSoftDelete(boleto.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QA Checklist Section */}
      {permissions.isAdmin && (
        <DDAQAChecklist />
      )}

      {/* Dialogs */}
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

      {detailSheet && (
        <BoletoDetailSheet
          boleto={detailSheet}
          open={!!detailSheet}
          onOpenChange={() => setDetailSheet(null)}
          onCopyLine={handleCopyLine}
          onWorkflowChange={(status) => {
            handleWorkflowChange(detailSheet.id, status);
            setDetailSheet(null);
          }}
        />
      )}

      {createAPDialog && (
        <CreateAPDialog
          boleto={createAPDialog}
          open={!!createAPDialog}
          onOpenChange={() => setCreateAPDialog(null)}
          onSuccess={() => {
            refetch();
            setCreateAPDialog(null);
          }}
        />
      )}

      {linkTransactionDialog && (
        <LinkTransactionDialog
          boleto={linkTransactionDialog}
          open={!!linkTransactionDialog}
          onOpenChange={() => setLinkTransactionDialog(null)}
          onSuccess={() => {
            refetch();
            setLinkTransactionDialog(null);
          }}
        />
      )}

      {matchesDialog && (
        <MatchesDialog
          boleto={matchesDialog}
          open={!!matchesDialog}
          onOpenChange={() => setMatchesDialog(null)}
          onMatch={(transactionId) => {
            linkMutation.mutate({ boletoId: matchesDialog.id, transactionId }, {
              onSuccess: () => {
                refetch();
                setMatchesDialog(null);
              }
            });
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

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
          <DialogDescription>Adicione um boleto que não foi capturado automaticamente</DialogDescription>
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
            <div className="col-span-2">
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

function BoletoDetailSheet({
  boleto,
  open,
  onOpenChange,
  onCopyLine,
  onWorkflowChange,
}: {
  boleto: DDABoleto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyLine: (line: string) => void;
  onWorkflowChange: (status: WorkflowStatus) => void;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const currentWorkflow = workflowConfig[boleto.workflow_status || 'captured'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Boleto</SheetTitle>
          <SheetDescription>
            {boleto.source === 'pluggy' ? 'Capturado via Pluggy' : 'Adicionado manualmente'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Workflow</p>
              <div className="mt-1">
                <Badge variant="outline" className={currentWorkflow.color}>
                  {currentWorkflow.label}
                </Badge>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Status Pagamento</p>
              <div className="mt-1">
                <Badge variant="outline" className={statusConfig[boleto.status]?.color}>
                  {statusConfig[boleto.status]?.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Main Info */}
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cedente</p>
                  <p className="font-medium">{boleto.cedente_nome}</p>
                  {boleto.cedente_documento && (
                    <p className="text-sm text-muted-foreground">{boleto.cedente_documento}</p>
                  )}
                </div>
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Original</p>
                  <p className="text-lg font-bold">{formatCurrency(boleto.valor_original)}</p>
                </div>
                {boleto.valor_atualizado && boleto.valor_atualizado !== boleto.valor_original && (
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Atualizado</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(boleto.valor_atualizado)}</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">
                    {format(parseISO(boleto.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
                {boleto.data_emissao && (
                  <div>
                    <p className="text-xs text-muted-foreground">Emissão</p>
                    <p>{format(parseISO(boleto.data_emissao), 'dd/MM/yyyy')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Codes */}
            {boleto.digitable_line && (
              <div className="space-y-2">
                <Label>Linha Digitável</Label>
                <div className="flex gap-2">
                  <Input value={boleto.digitable_line} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => onCopyLine(boleto.digitable_line!)}>
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
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">{boleto.notes}</p>
              </div>
            )}

            {/* Workflow Actions */}
            <div className="space-y-2">
              <Label>Alterar Workflow</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(workflowConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  const isCurrent = boleto.workflow_status === key;
                  return (
                    <Button
                      key={key}
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => !isCurrent && onWorkflowChange(key as WorkflowStatus)}
                      disabled={isCurrent}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
            <p>ID: {boleto.id}</p>
            {boleto.synced_at && (
              <p>Sincronizado: {format(parseISO(boleto.synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
            {boleto.reviewed_at && (
              <p>Revisado: {format(parseISO(boleto.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateAPDialog({
  boleto,
  open,
  onOpenChange,
  onSuccess,
}: {
  boleto: DDABoleto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState(`Boleto DDA - ${boleto.cedente_nome}`);

  const handleCreate = async () => {
    if (!currentWorkspace?.id) return;
    
    setIsLoading(true);
    try {
      // Create expense transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert([{
          workspace_id: currentWorkspace.id,
          type: 'expense' as const,
          amount: -(boleto.valor_atualizado || boleto.valor_original),
          description,
          due_date: boleto.data_vencimento,
          status: 'pending' as const,
        }])
        .select()
        .single();

      if (txError) throw txError;

      // Link boleto to transaction
      const { error: linkError } = await supabase
        .from('dda_boletos')
        .update({
          linked_ap_id: transaction.id,
          workflow_status: 'ap_created',
        })
        .eq('id', boleto.id);

      if (linkError) throw linkError;

      toast.success('Conta a Pagar criada com sucesso');
      onSuccess();
    } catch (error) {
      console.error('Error creating AP:', error);
      toast.error('Erro ao criar Conta a Pagar');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Conta a Pagar</DialogTitle>
          <DialogDescription>
            Gerar lançamento de despesa a partir deste boleto
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cedente</span>
              <span className="font-medium">{boleto.cedente_nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className="font-bold text-primary">
                {formatCurrency(boleto.valor_atualizado || boleto.valor_original)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Vencimento</span>
              <span>{format(parseISO(boleto.data_vencimento), 'dd/MM/yyyy')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do lançamento"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'Criando...' : 'Criar Conta a Pagar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkTransactionDialog({
  boleto,
  open,
  onOpenChange,
  onSuccess,
}: {
  boleto: DDABoleto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  // Fetch pending expense transactions - use useEffect, not useState
  useEffect(() => {
    if (!currentWorkspace?.id || !open) return;
    
    supabase
      .from('transactions')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('type', 'expense')
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setTransactions(data);
      });
  }, [currentWorkspace?.id, open]);

  const handleLink = async () => {
    if (!selectedId) {
      toast.error('Selecione uma transação');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('dda_boletos')
        .update({
          linked_ap_id: selectedId,
          workflow_status: 'ap_created',
        })
        .eq('id', boleto.id);

      if (error) throw error;

      toast.success('Boleto vinculado com sucesso');
      onSuccess();
    } catch {
      toast.error('Erro ao vincular boleto');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular a Transação Existente</DialogTitle>
          <DialogDescription>
            Selecione uma conta a pagar para vincular
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma transação pendente encontrada
            </p>
          ) : (
            transactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => setSelectedId(tx.id)}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedId === tx.id 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-primary/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{tx.description || 'Sem descrição'}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(tx.date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <span className="font-bold">{formatCurrency(tx.amount)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleLink} disabled={isLoading || !selectedId}>
            {isLoading ? 'Vinculando...' : 'Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MatchesDialog({
  boleto,
  open,
  onOpenChange,
  onMatch,
}: {
  boleto: DDABoleto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMatch: (transactionId: string) => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);

  // Fetch matches using the database function
  useState(() => {
    if (!currentWorkspace?.id || !open) return;
    
    setIsLoading(true);
    supabase
      .rpc('match_dda_with_transactions', {
        p_workspace_id: currentWorkspace.id,
        p_tolerance_days: 5,
        p_tolerance_amount: 0.05,
      })
      .then(({ data, error }) => {
        if (!error && data) {
          const boletoMatches = data.filter((m: any) => m.boleto_id === boleto.id);
          
          // Fetch transaction details
          if (boletoMatches.length > 0) {
            const txIds = boletoMatches.map((m: any) => m.transaction_id);
            supabase
              .from('transactions')
              .select('*')
              .in('id', txIds)
              .then(({ data: txData }) => {
                if (txData) {
                  const enriched = boletoMatches.map((m: any) => ({
                    ...m,
                    transaction: txData.find((t) => t.id === m.transaction_id),
                  }));
                  setMatches(enriched);
                }
                setIsLoading(false);
              });
          } else {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      });
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Matches Encontrados</DialogTitle>
          <DialogDescription>
            Transações que podem corresponder a este boleto
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : matches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum match encontrado
            </p>
          ) : (
            matches.map((match) => (
              <div
                key={match.transaction_id}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{match.transaction?.description || 'Sem descrição'}</p>
                    <p className="text-sm text-muted-foreground">
                      {match.transaction?.date && format(parseISO(match.transaction.date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <span className="font-bold">{formatCurrency(match.transaction?.amount || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      match.match_score >= 0.9 ? 'bg-green-500/10 text-green-600' :
                      match.match_score >= 0.7 ? 'bg-amber-500/10 text-amber-600' :
                      'bg-muted'
                    }>
                      {Math.round(match.match_score * 100)}% match
                    </Badge>
                    <span className="text-xs text-muted-foreground">{match.match_reason}</span>
                  </div>
                  <Button size="sm" onClick={() => onMatch(match.transaction_id)}>
                    <Link2 className="h-3 w-3 mr-1" />
                    Vincular
                  </Button>
                </div>
              </div>
            ))
          )}
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
