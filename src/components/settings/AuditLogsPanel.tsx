import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAccessLogging } from '@/hooks/useAccessLogging';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield, Search, Eye, Filter, Download, Clock } from 'lucide-react';

interface AuditLog {
  id: string;
  workspace_id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/20 text-green-600',
  update: 'bg-blue-500/20 text-blue-600',
  delete: 'bg-red-500/20 text-red-600',
  reordered: 'bg-purple-500/20 text-purple-600',
  archived: 'bg-orange-500/20 text-orange-600',
};

const ENTITY_LABELS: Record<string, string> = {
  cards: 'Card',
  transactions: 'Transação',
  workspace_members: 'Membro',
  user_roles: 'Permissão',
  api_keys: 'API Key',
  webhook_subscriptions: 'Webhook',
  feature_flags: 'Feature Flag',
  collaborator_details: 'Colaborador',
  sprints: 'Sprint',
  space: 'Espaço',
};

export function AuditLogsPanel() {
  const { currentWorkspace } = useWorkspace();
  const { logAccess } = useAccessLogging();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Log access to audit logs
  React.useEffect(() => {
    logAccess('audit_log_view');
  }, [logAccess]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', currentWorkspace?.id, entityFilter, actionFilter],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const filteredLogs = logs?.filter(log => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.entity_type.toLowerCase().includes(searchLower) ||
      log.entity_id.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower)
    );
  });

  const exportLogs = () => {
    if (!filteredLogs) return;
    
    const csvContent = [
      ['Data', 'Tipo', 'Entidade', 'Ação', 'Usuário'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
        ENTITY_LABELS[log.entity_type] || log.entity_type,
        log.entity_id,
        log.action,
        log.user_id || 'Sistema',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Histórico de alterações críticas no sistema
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tipo, ID ou ação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Atualização</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data/Hora</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="w-[80px]">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={ACTION_COLORS[log.action] || 'bg-muted'}>
                      {log.action === 'create' ? 'Criação' :
                       log.action === 'update' ? 'Atualização' :
                       log.action === 'delete' ? 'Exclusão' : log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.entity_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Detalhes da Alteração</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Entidade</p>
                              <p className="font-medium">{ENTITY_LABELS[log.entity_type] || log.entity_type}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">ID</p>
                              <p className="font-mono text-xs">{log.entity_id}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Ação</p>
                              <Badge className={ACTION_COLORS[log.action]}>
                                {log.action}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Data/Hora</p>
                              <p>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
                            </div>
                          </div>
                          
                          {log.old_data && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Dados Anteriores</p>
                              <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {log.new_data && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Dados Novos</p>
                              <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {filteredLogs && filteredLogs.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Exibindo {filteredLogs.length} registros
          </p>
        )}
      </CardContent>
    </Card>
  );
}
