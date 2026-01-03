import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Users, 
  Building2, 
  Activity, 
  AlertTriangle, 
  Key, 
  Clock, 
  Loader2,
  Search,
  Eye,
  RefreshCw,
  Crown,
  Settings2,
  Share2
} from 'lucide-react';
import { PlanManagementPanel } from '@/components/settings/PlanManagementPanel';
import { EntitlementOverridesPanel } from '@/components/settings/EntitlementOverridesPanel';
import { AdminSocialSetup } from '@/components/platform-admin/AdminSocialSetup';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PlatformAdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportReason, setSupportReason] = useState('');
  const [supportWorkspaceId, setSupportWorkspaceId] = useState('');
  const [supportDuration, setSupportDuration] = useState('30');
  const [supportMode, setSupportMode] = useState<'read_only' | 'elevated'>('read_only');

  // Check if user is super admin
  const { data: isSuperAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('platform_super_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Platform metrics
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const [workspacesRes, usersRes, cardsRes] = await Promise.all([
        supabase.from('workspaces').select('id, status', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('cards').select('id', { count: 'exact' }),
      ]);

      return {
        totalWorkspaces: workspacesRes.count || 0,
        activeWorkspaces: workspacesRes.data?.filter(w => w.status === 'active').length || 0,
        totalUsers: usersRes.count || 0,
        totalCards: cardsRes.count || 0,
      };
    },
    enabled: !!isSuperAdmin,
  });

  // All workspaces (for support mode and plan management)
  const { data: workspaces, isLoading: loadingWorkspaces } = useQuery({
    queryKey: ['all-workspaces', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('workspaces')
        .select(`
          id, name, slug, status, created_at,
          workspace_plans (plan_tier, status, seats_limit, spaces_limit)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data?.map(ws => ({
        ...ws,
        plan_tier: ws.workspace_plans?.[0]?.plan_tier || 'free',
        plan_status: ws.workspace_plans?.[0]?.status || 'active',
        seats_limit: ws.workspace_plans?.[0]?.seats_limit || 3,
        spaces_limit: ws.workspace_plans?.[0]?.spaces_limit || 3,
      }));
    },
    enabled: !!isSuperAdmin,
  });

  // Active support sessions
  const { data: activeSessions } = useQuery({
    queryKey: ['active-support-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_sessions')
        .select(`
          *,
          workspaces:workspace_id (name)
        `)
        .is('ended_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!isSuperAdmin,
  });

  // Recent audit logs
  const { data: recentLogs } = useQuery({
    queryKey: ['platform-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('actor_type', 'super_admin')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!isSuperAdmin,
  });

  // Start support session
  const startSupportMutation = useMutation({
    mutationFn: async () => {
      if (!supportWorkspaceId || supportReason.length < 10) {
        throw new Error('Workspace e motivo (mín. 10 caracteres) são obrigatórios');
      }

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(supportDuration));

      const { data, error } = await supabase
        .from('support_sessions')
        .insert({
          super_admin_user_id: user?.id,
          workspace_id: supportWorkspaceId,
          reason: supportReason,
          mode: supportMode,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Modo Suporte iniciado');
      setSupportDialogOpen(false);
      setSupportReason('');
      setSupportWorkspaceId('');
      queryClient.invalidateQueries({ queryKey: ['active-support-sessions'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // End support session
  const endSupportMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('support_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sessão de suporte encerrada');
      queryClient.invalidateQueries({ queryKey: ['active-support-sessions'] });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-destructive/5">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-destructive" />
            <div>
              <h1 className="text-lg font-bold">Platform Admin Console</h1>
              <p className="text-xs text-muted-foreground">Super Admin: {user?.email}</p>
            </div>
          </div>
          <Badge variant="destructive" className="gap-1">
            <Key className="h-3 w-3" />
            ELEVATED ACCESS
          </Badge>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Active Support Sessions Warning */}
        {activeSessions && activeSessions.length > 0 && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Sessões de Suporte Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeSessions.map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between p-2 bg-background rounded">
                    <div>
                      <span className="font-medium">{session.workspaces?.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({session.mode}) - Expira: {format(new Date(session.expires_at), 'HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => endSupportMutation.mutate(session.id)}
                    >
                      Encerrar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Workspaces</CardDescription>
              <CardTitle className="text-3xl">
                {loadingMetrics ? '...' : metrics?.totalWorkspaces}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">{metrics?.activeWorkspaces} ativos</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Usuários</CardDescription>
              <CardTitle className="text-3xl">
                {loadingMetrics ? '...' : metrics?.totalUsers}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cards</CardDescription>
              <CardTitle className="text-3xl">
                {loadingMetrics ? '...' : metrics?.totalCards}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sessões Ativas</CardDescription>
              <CardTitle className="text-3xl">
                {activeSessions?.length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="workspaces">
          <TabsList>
            <TabsTrigger value="workspaces" className="gap-2">
              <Building2 className="h-4 w-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <Crown className="h-4 w-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="entitlements" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Entitlements
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <Share2 className="h-4 w-4" />
              Social OAuth
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Activity className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="mt-4 space-y-4">
            {/* Search and Support Button */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar workspace por nome..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Iniciar Modo Suporte
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Iniciar Sessão de Suporte</DialogTitle>
                    <DialogDescription>
                      Isso permite acesso temporário ao workspace para debugging. 
                      Todas as ações serão auditadas.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Workspace</Label>
                      <Select value={supportWorkspaceId} onValueChange={setSupportWorkspaceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o workspace" />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaces?.map((ws) => (
                            <SelectItem key={ws.id} value={ws.id}>
                              {ws.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo (obrigatório, mín. 10 caracteres)</Label>
                      <Textarea
                        placeholder="Descreva o motivo do acesso..."
                        value={supportReason}
                        onChange={(e) => setSupportReason(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Duração</Label>
                        <Select value={supportDuration} onValueChange={setSupportDuration}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Modo</Label>
                        <Select value={supportMode} onValueChange={(v: 'read_only' | 'elevated') => setSupportMode(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read_only">Somente Leitura</SelectItem>
                            <SelectItem value="elevated">Elevado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSupportDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => startSupportMutation.mutate()}
                      disabled={startSupportMutation.isPending || supportReason.length < 10}
                    >
                      {startSupportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Iniciar Sessão
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Workspaces Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingWorkspaces ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : workspaces?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhum workspace encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    workspaces?.map((ws) => (
                      <TableRow key={ws.id}>
                        <TableCell className="font-medium">{ws.name}</TableCell>
                        <TableCell className="text-muted-foreground">{ws.slug}</TableCell>
                        <TableCell>
                          <Badge variant={ws.status === 'active' ? 'default' : 'secondary'}>
                            {ws.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(ws.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <PlanManagementPanel 
              workspaces={workspaces?.map(ws => ({
                id: ws.id,
                name: ws.name,
                plan_tier: ws.plan_tier as 'free' | 'pro' | 'enterprise',
                status: ws.plan_status || 'active',
                seats_limit: ws.seats_limit,
                spaces_limit: ws.spaces_limit,
              })) || []}
              isLoading={loadingWorkspaces}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['all-workspaces'] })}
            />
          </TabsContent>

          <TabsContent value="entitlements" className="mt-4">
            <EntitlementOverridesPanel 
              workspaces={workspaces?.map(ws => ({
                id: ws.id,
                name: ws.name,
                plan_tier: ws.plan_tier,
              })) || []}
            />
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <AdminSocialSetup />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs de Auditoria (Super Admin)</CardTitle>
                <CardDescription>
                  Ações realizadas por super admins nos últimos 30 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhum log encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentLogs?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>{log.entity_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {JSON.stringify(log.metadata)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
