import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { WorkRadar } from '@/components/dashboard/WorkRadar';
import { BirthdayBanner } from '@/components/notices/BirthdayBanner';
import { TodayBirthdaysReminder } from '@/components/notices/TodayBirthdaysReminder';
import { HolidayBanner } from '@/components/notices/HolidayBanner';
import { HolidayCelebrationDemo } from '@/components/notices/HolidayCelebrationDemo';
import { AltControlPendingWidget } from '@/components/altcontrol/AltControlPendingWidget';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  FolderKanban,
  Users,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useToast } from '@/hooks/use-toast';
import { differenceInSeconds } from 'date-fns';
import { useSpaces, useCreateSpace } from '@/hooks/useSpaces';
import { EmptyWorkspaceState } from '@/components/workspace/EmptyWorkspaceState';
import { CreateSpaceDialog } from '@/components/settings/CreateSpaceDialog';
import type { SpaceTemplate, SpaceTemplateType } from '@/lib/spaceTemplates';

const Index: React.FC = () => {
  usePageTracking('dashboard');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace, workspaces, loading } = useWorkspace();
  const { data: spaces, isLoading: spacesLoading } = useSpaces();
  const createSpace = useCreateSpace();
  const [showCreateSpace, setShowCreateSpace] = useState(false);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';

  // Hooks devem ser chamados sempre na mesma ordem (não coloque antes de returns condicionais)
  const { data: myTasks } = useQuery({
    queryKey: ['index-my-tasks', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return { count: 0, todayCount: 0 };

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const { count: totalCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_id', user.id)
        .neq('status', 'archived')
        .neq('status', 'delivered');

      const { count: todayCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('owner_id', user.id)
        .neq('status', 'archived')
        .neq('status', 'delivered')
        .lte('due_date', today.toISOString());

      return { count: totalCount || 0, todayCount: todayCount || 0 };
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
  });

  const { data: myTimer } = useQuery({
    queryKey: ['index-my-timer', currentWorkspace?.id, user?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !user?.id) return null;

      const { data } = await supabase
        .from('time_entries')
        .select('id, started_at, card:cards(title)')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .eq('is_running', true)
        .maybeSingle();

      return data;
    },
    enabled: !!currentWorkspace?.id && !!user?.id,
    refetchInterval: 1000,
  });

  const { data: todayEvents } = useQuery({
    queryKey: ['index-today-events', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString());

      return count || 0;
    },
    enabled: !!currentWorkspace?.id,
  });

  const formatTimer = (startedAt: string): string => {
    const seconds = differenceInSeconds(new Date(), new Date(startedAt));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCreateSpace = async (data: {
    name: string;
    icon: string;
    color: string;
    type: SpaceTemplateType;
    template: SpaceTemplate;
  }) => {
    await createSpace.mutateAsync({
      name: data.name,
      icon: data.icon,
      color: data.color,
      type: data.type as any,
      template: data.template,
    });
    setShowCreateSpace(false);
  };

  // Se está carregando, mostrar spinner
  if (loading || spacesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não tem workspace, redireciona para FirstAccessPage
  if (workspaces.length === 0) {
    return <Navigate to="/first-access" replace />;
  }

  // Se workspace está vazio (sem espaços), mostrar estado vazio
  if (!spaces || spaces.length === 0) {
    return (
      <AppLayout>
        <EmptyWorkspaceState
          workspaceName={currentWorkspace?.name || 'Workspace'}
          onCreateSpace={() => setShowCreateSpace(true)}
          onInviteMembers={() => navigate('/settings?tab=workspace')}
        />
        <CreateSpaceDialog
          open={showCreateSpace}
          onOpenChange={setShowCreateSpace}
          onSubmit={handleCreateSpace}
          isLoading={createSpace.isPending}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}!</h1>
          <p className="text-muted-foreground">
            Aqui está o resumo do seu dia no {currentWorkspace?.name || 'workspace'}.
          </p>
        </div>

        {/* Holiday Celebrations */}
        <div className="mb-6">
          <HolidayBanner />
        </div>

        {/* Birthday Celebrations */}
        <div className="mb-6 space-y-2">
          <TodayBirthdaysReminder />
          <BirthdayBanner />
        </div>

        {/* Work Radar - Main focus area */}
        <div className="mb-8">
          <WorkRadar />
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="group cursor-pointer transition-all hover:shadow-md" onClick={() => navigate('/tasks')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tarefas Pendentes</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myTasks?.count || 0}</div>
              <p className="text-xs text-muted-foreground">
                {myTasks?.count === 0 ? 'Nenhuma tarefa atribuída' : `${myTasks?.todayCount || 0} para hoje`}
              </p>
            </CardContent>
          </Card>

          <Card
            className={`group cursor-pointer transition-all hover:shadow-md ${myTimer ? 'border-green-500/50 bg-green-500/5' : ''}`}
            onClick={() => navigate('/time')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Timer Ativo</CardTitle>
              <Clock className={`h-4 w-4 ${myTimer ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${myTimer ? 'text-green-600' : ''}`}>
                {myTimer ? formatTimer((myTimer as any).started_at) : '00:00:00'}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {myTimer ? ((myTimer as any).card as { title: string } | null)?.title || 'Rodando' : 'Nenhum timer rodando'}
              </p>
            </CardContent>
          </Card>

          <Card
            className={`group cursor-pointer transition-all hover:shadow-md ${(myTasks?.todayCount || 0) > 0 ? 'border-yellow-500/50' : ''}`}
            onClick={() => navigate('/tasks')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entregas Hoje</CardTitle>
              <AlertCircle
                className={`h-4 w-4 ${(myTasks?.todayCount || 0) > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}
              />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(myTasks?.todayCount || 0) > 0 ? 'text-yellow-600' : ''}`}>
                {myTasks?.todayCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {(myTasks?.todayCount || 0) === 0 ? 'Nenhuma entrega programada' : 'Precisam de atenção'}
              </p>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md" onClick={() => navigate('/calendar')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Eventos Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayEvents || 0}</div>
              <p className="text-xs text-muted-foreground">
                {(todayEvents || 0) === 0 ? 'Agenda livre' : 'Na agenda de hoje'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Minhas Tarefas
              </CardTitle>
              <CardDescription>Tarefas atribuídas a você que precisam de atenção</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mb-2 font-medium">Tudo em dia!</p>
                <p className="mb-4 text-sm text-muted-foreground">Você não tem tarefas pendentes no momento.</p>
                <Button variant="outline" onClick={() => navigate('/tasks')}>
                  Ver Todas as Tarefas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AltControl Widget */}
          <AltControlPendingWidget variant="combined" />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Atividade Recente
              </CardTitle>
              <CardDescription>Últimas atualizações do workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mb-2 font-medium">Workspace criado!</p>
                <p className="mb-4 text-sm text-muted-foreground">Comece criando seu primeiro card.</p>
                <Button onClick={() => {
                  const firstSpace = spaces?.[0];
                  if (firstSpace) {
                    navigate(`/space/${firstSpace.id}`);
                  } else {
                    toast({
                      title: 'Nenhum espaço disponível',
                      description: 'Crie um espaço primeiro para adicionar cards.',
                      variant: 'destructive',
                    });
                  }
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Card
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;

