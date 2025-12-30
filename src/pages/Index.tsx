import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace, workspaces, loading, createWorkspace } = useWorkspace();
  const [isCreating, setIsCreating] = React.useState(false);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';

  const handleCreateWorkspace = async () => {
    setIsCreating(true);
    const { error } = await createWorkspace('Minha Empresa');
    setIsCreating(false);

    if (error) {
      console.error('Error creating workspace:', error);
    }
  };

  // Se não tem workspace, mostra tela de onboarding
  if (!loading && workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-lg animate-fade-in text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-primary">Flowalt</span>
          </div>

          <h1 className="mb-3 text-3xl font-semibold tracking-tight">
            Bem-vindo, {firstName}!
          </h1>
          <p className="mb-8 text-muted-foreground">
            Vamos criar seu primeiro workspace para começar a organizar o trabalho da sua equipe.
          </p>

          <Card className="border-border/50 text-left">
            <CardHeader>
              <CardTitle className="text-lg">Criar Workspace</CardTitle>
              <CardDescription>
                Um workspace é o espaço de trabalho da sua empresa. Ele contém todos os projetos, tarefas e membros da equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>6 espaços padrão (Designer, Audiovisual, Social Media...)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Sistema de cards com briefing inteligente</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Controle de tempo e hora-homem</span>
                </div>
              </div>
              <Button
                onClick={handleCreateWorkspace}
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Criar Workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Olá, {firstName}!
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo do seu dia no {currentWorkspace?.name || 'workspace'}.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tarefas Pendentes
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Nenhuma tarefa atribuída
              </p>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Timer Ativo
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">00:00:00</div>
              <p className="text-xs text-muted-foreground">
                Nenhum timer rodando
              </p>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entregas Hoje
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Nenhuma entrega programada
              </p>
            </CardContent>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Eventos Hoje
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Agenda livre
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Minhas Tarefas
              </CardTitle>
              <CardDescription>
                Tarefas atribuídas a você que precisam de atenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mb-2 font-medium">Tudo em dia!</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Você não tem tarefas pendentes no momento.
                </p>
                <Button variant="outline" onClick={() => navigate('/tasks')}>
                  Ver Todas as Tarefas
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Atividade Recente
              </CardTitle>
              <CardDescription>
                Últimas atualizações do workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="mb-2 font-medium">Workspace criado!</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Comece criando seu primeiro card.
                </p>
                <Button>
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
