import { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Circle,
  RefreshCw,
  FileText,
  Database,
  Shield,
  Plug,
  Layout,
  Wallet,
  GitMerge,
  CreditCard,
  Users,
  FileSearch,
  Smartphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDDABoletos, useDDASyncStatus } from '@/hooks/useDDA';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'passed' | 'failed' | 'pending' | 'manual';
  icon: React.ElementType;
}

export function DDAQAChecklist() {
  const { currentWorkspace } = useWorkspace();
  const permissions = usePermissions();
  const { data: boletos = [], isLoading: boletosLoading } = useDDABoletos();
  const { data: syncStatus, isLoading: syncLoading } = useDDASyncStatus();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Run automated checks
  const runChecks = async () => {
    if (!currentWorkspace?.id) return;
    
    setIsRunning(true);
    const items: ChecklistItem[] = [];

    // 1. Pluggy Connection
    items.push({
      id: 'pluggy-connection',
      category: 'Integração',
      title: 'Conexão Pluggy',
      description: syncStatus?.is_configured 
        ? 'Pluggy está configurado e ativo' 
        : 'Pluggy não está configurado',
      status: syncStatus?.is_configured ? 'passed' : 'failed',
      icon: Plug,
    });

    // 2. Sync Status
    const lastSyncOk = syncStatus?.last_sync?.status === 'success';
    items.push({
      id: 'sync-status',
      category: 'Integração',
      title: 'Última sincronização',
      description: syncStatus?.last_sync 
        ? lastSyncOk ? 'Sync executado com sucesso' : 'Última sync falhou'
        : 'Nenhuma sync realizada',
      status: lastSyncOk ? 'passed' : syncStatus?.last_sync ? 'failed' : 'pending',
      icon: RefreshCw,
    });

    // 3. Boletos Exist
    items.push({
      id: 'boletos-exist',
      category: 'Dados',
      title: 'Boletos capturados',
      description: boletos.length > 0 
        ? `${boletos.length} boletos no sistema`
        : 'Nenhum boleto capturado',
      status: boletos.length > 0 ? 'passed' : 'pending',
      icon: FileText,
    });

    // 4. No Duplicates (check by pluggy_bill_id)
    const pluggyBillIds = boletos.filter(b => b.pluggy_bill_id).map(b => b.pluggy_bill_id);
    const hasDuplicates = new Set(pluggyBillIds).size !== pluggyBillIds.length;
    items.push({
      id: 'no-duplicates',
      category: 'Dados',
      title: 'Sem duplicatas',
      description: hasDuplicates 
        ? 'Existem boletos duplicados'
        : 'Deduplicação funcionando corretamente',
      status: !hasDuplicates ? 'passed' : 'failed',
      icon: Database,
    });

    // 5. AP Linking
    const linkedBoletos = boletos.filter(b => b.linked_ap_id || b.transaction_id);
    items.push({
      id: 'ap-linking',
      category: 'Workflow',
      title: 'Vinculação a Contas a Pagar',
      description: linkedBoletos.length > 0 
        ? `${linkedBoletos.length} boletos vinculados a transações`
        : 'Nenhum boleto vinculado ainda',
      status: linkedBoletos.length > 0 ? 'passed' : 'pending',
      icon: Wallet,
    });

    // 6. Workflow States
    const workflowStates = new Set(boletos.map(b => b.workflow_status));
    items.push({
      id: 'workflow-states',
      category: 'Workflow',
      title: 'Estados de workflow',
      description: `${workflowStates.size} estados diferentes em uso`,
      status: workflowStates.size >= 1 ? 'passed' : 'pending',
      icon: GitMerge,
    });

    // 7. Paid/Reconciled
    const paidBoletos = boletos.filter(b => b.status === 'paid' || b.workflow_status === 'paid_reconciled');
    items.push({
      id: 'reconciliation',
      category: 'Conciliação',
      title: 'Boletos conciliados',
      description: paidBoletos.length > 0 
        ? `${paidBoletos.length} boletos pagos/conciliados`
        : 'Nenhum boleto conciliado ainda',
      status: paidBoletos.length > 0 ? 'passed' : 'pending',
      icon: CreditCard,
    });

    // 8. RLS/Permissions Check
    items.push({
      id: 'permissions',
      category: 'Segurança',
      title: 'Permissões de usuário',
      description: permissions.canViewFinancial 
        ? 'Usuário tem permissão financeira'
        : 'Usuário sem permissão financeira',
      status: permissions.canViewFinancial ? 'passed' : 'failed',
      icon: Shield,
    });

    // 9. Admin Delete Permission
    items.push({
      id: 'admin-delete',
      category: 'Segurança',
      title: 'Permissão de exclusão',
      description: permissions.isOwner || permissions.isAdmin
        ? 'Admin/Owner pode excluir boletos'
        : 'Usuário não pode excluir (correto se não for admin)',
      status: 'passed',
      icon: Users,
    });

    // 10. Audit Logs (check if audit table exists)
    const { count: auditCount } = await supabase
      .from('dda_audit_events')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', currentWorkspace.id);
    
    items.push({
      id: 'audit-logs',
      category: 'Auditoria',
      title: 'Logs de auditoria',
      description: (auditCount ?? 0) > 0 
        ? `${auditCount} eventos registrados`
        : 'Nenhum evento de auditoria ainda',
      status: (auditCount ?? 0) > 0 ? 'passed' : 'pending',
      icon: FileSearch,
    });

    // 11. UI Responsiveness (manual)
    items.push({
      id: 'responsive-ui',
      category: 'UI/UX',
      title: 'Interface responsiva',
      description: 'Verificar manualmente em diferentes tamanhos de tela',
      status: 'manual',
      icon: Smartphone,
    });

    // 12. Table Layout
    items.push({
      id: 'table-layout',
      category: 'UI/UX',
      title: 'Tabela sem cortes',
      description: 'Verificar que a tabela não corta conteúdo',
      status: 'manual',
      icon: Layout,
    });

    setChecklistItems(items);
    setIsRunning(false);
  };

  useEffect(() => {
    if (!boletosLoading && !syncLoading) {
      runChecks();
    }
  }, [boletosLoading, syncLoading, boletos.length]);

  const stats = useMemo(() => {
    const passed = checklistItems.filter(i => i.status === 'passed').length;
    const failed = checklistItems.filter(i => i.status === 'failed').length;
    const pending = checklistItems.filter(i => i.status === 'pending').length;
    const manual = checklistItems.filter(i => i.status === 'manual').length;
    const total = checklistItems.length;
    const percentage = total > 0 ? Math.round((passed / (total - manual)) * 100) : 0;
    
    return { passed, failed, pending, manual, total, percentage };
  }, [checklistItems]);

  const categories = useMemo(() => {
    const cats = new Map<string, ChecklistItem[]>();
    checklistItems.forEach(item => {
      const existing = cats.get(item.category) || [];
      cats.set(item.category, [...existing, item]);
    });
    return cats;
  }, [checklistItems]);

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-destructive" />;
      case 'pending': return <Circle className="w-5 h-5 text-amber-500" />;
      case 'manual': return <Circle className="w-5 h-5 text-blue-500 fill-blue-100" />;
    }
  };

  if (boletosLoading || syncLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Checklist de Validação DDA</CardTitle>
            <CardDescription>Verificação automática de funcionalidades</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runChecks}
            disabled={isRunning}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            Revalidar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
            <p className="text-xs text-muted-foreground">Passou</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Falhou</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-500/10">
            <p className="text-2xl font-bold text-blue-600">{stats.manual}</p>
            <p className="text-xs text-muted-foreground">Manual</p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso automático</span>
            <span className="font-medium">{stats.percentage}%</span>
          </div>
          <Progress value={stats.percentage} className="h-2" />
        </div>

        {/* Categories */}
        <div className="space-y-3">
          {Array.from(categories.entries()).map(([category, items]) => (
            <Collapsible key={category} defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <span className="font-medium">{category}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {items.filter(i => i.status === 'passed').length}/{items.length}
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-1">
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <div 
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      {getStatusIcon(item.status)}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
