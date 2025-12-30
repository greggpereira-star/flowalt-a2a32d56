import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Building2, 
  CreditCard, 
  BarChart3, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Shield,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface WorkspaceStats {
  id: string;
  name: string;
  status: string;
  created_at: string;
  member_count: number;
  card_count: number;
  active_cards: number;
  overdue_cards: number;
}

interface PlatformMetrics {
  total_workspaces: number;
  active_workspaces: number;
  total_users: number;
  total_cards: number;
  total_hours_logged: number;
  revenue_total: number;
}

export const SuperAdminDashboard = () => {
  const { currentWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch platform-wide metrics (Super Admin only)
  const { data: platformMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async (): Promise<PlatformMetrics> => {
      // Get workspaces count
      const { count: workspacesCount } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true });

      const { count: activeWorkspacesCount } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get users count (via profiles)
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get cards count
      const { count: cardsCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true });

      // Get total hours logged
      const { data: timeData } = await supabase
        .from('time_entries')
        .select('duration_seconds');
      
      const totalHours = (timeData || []).reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0) / 3600;

      // Get total revenue
      const { data: revenueData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'income')
        .eq('status', 'paid');
      
      const totalRevenue = (revenueData || []).reduce((sum, t) => sum + (t.amount || 0), 0);

      return {
        total_workspaces: workspacesCount || 0,
        active_workspaces: activeWorkspacesCount || 0,
        total_users: usersCount || 0,
        total_cards: cardsCount || 0,
        total_hours_logged: totalHours,
        revenue_total: totalRevenue,
      };
    },
  });

  // Fetch workspace list with stats
  const { data: workspaces, isLoading: workspacesLoading, refetch: refetchWorkspaces } = useQuery({
    queryKey: ['admin-workspaces', searchTerm],
    queryFn: async (): Promise<WorkspaceStats[]> => {
      let query = supabase
        .from('workspaces')
        .select(`
          id,
          name,
          status,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data: workspacesData, error } = await query.limit(50);
      if (error) throw error;

      // Fetch stats for each workspace
      const statsPromises = (workspacesData || []).map(async (ws) => {
        const [membersRes, cardsRes, activeCardsRes, overdueRes] = await Promise.all([
          supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('is_active', true),
          supabase.from('cards').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('cards').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id).in('status', ['todo', 'in_progress', 'review']),
          supabase.from('cards').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id).not('status', 'in', '("delivered","archived")').lt('due_date', new Date().toISOString().split('T')[0]),
        ]);

        return {
          ...ws,
          member_count: membersRes.count || 0,
          card_count: cardsRes.count || 0,
          active_cards: activeCardsRes.count || 0,
          overdue_cards: overdueRes.count || 0,
        };
      });

      return Promise.all(statsPromises);
    },
  });

  // Fetch recent system logs
  const { data: systemLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-system-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('structured_logs')
        .select('*')
        .in('log_level', ['error', 'warn'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchMetrics(), refetchWorkspaces()]);
      toast({ title: 'Dados atualizados' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (metricsLoading || workspacesLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Super Admin - Visão da Plataforma
          </CardTitle>
          <CardDescription>
            Métricas globais e gestão de workspaces
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs">Workspaces</span>
                </div>
                <div className="text-2xl font-bold">{platformMetrics?.total_workspaces}</div>
                <div className="text-xs text-green-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {platformMetrics?.active_workspaces} ativos
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Usuários</span>
                </div>
                <div className="text-2xl font-bold">{platformMetrics?.total_users}</div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs">Cards</span>
                </div>
                <div className="text-2xl font-bold">{platformMetrics?.total_cards}</div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">Horas Logadas</span>
                </div>
                <div className="text-2xl font-bold">{platformMetrics?.total_hours_logged.toFixed(0)}h</div>
              </Card>

              <Card className="p-4 col-span-2">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-xs">Receita Total Registrada</span>
                </div>
                <div className="text-2xl font-bold text-green-500">
                  {formatCurrency(platformMetrics?.revenue_total || 0)}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="mt-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar workspace..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {workspaces?.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ws.name}</span>
                        <Badge variant={ws.status === 'active' ? 'default' : 'secondary'}>
                          {ws.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Criado em {format(new Date(ws.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{ws.member_count}</div>
                        <div className="text-xs text-muted-foreground">membros</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{ws.card_count}</div>
                        <div className="text-xs text-muted-foreground">cards</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-blue-500">{ws.active_cards}</div>
                        <div className="text-xs text-muted-foreground">ativos</div>
                      </div>
                      {ws.overdue_cards > 0 && (
                        <div className="text-center">
                          <div className="font-medium text-destructive">{ws.overdue_cards}</div>
                          <div className="text-xs text-muted-foreground">atrasados</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4">
            <ScrollArea className="h-[400px]">
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : systemLogs && systemLogs.length > 0 ? (
                <div className="space-y-2">
                  {systemLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <AlertTriangle className={`h-4 w-4 mt-0.5 ${log.log_level === 'error' ? 'text-destructive' : 'text-yellow-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.log_level === 'error' ? 'destructive' : 'outline'}>
                            {log.log_level}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{log.service}</span>
                        </div>
                        <p className="text-sm mt-1 truncate">{log.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum alerta recente
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
