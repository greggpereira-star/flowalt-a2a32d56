import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Mail, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FirstAccessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createWorkspace, refreshWorkspaces } = useWorkspace();
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      toast.error('Digite um nome para o workspace');
      return;
    }

    setIsCreating(true);
    try {
      await createWorkspace(workspaceName.trim());
      toast.success('Workspace criado com sucesso!');
      await refreshWorkspaces();
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar workspace');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      toast.error('Cole o link ou token do convite');
      return;
    }

    setIsAccepting(true);
    try {
      // Extract token from URL if full URL was pasted
      let token = inviteToken.trim();
      if (token.includes('/invite/')) {
        const parts = token.split('/invite/');
        token = parts[parts.length - 1];
      }

      navigate(`/invite/${token}`);
    } catch (error: any) {
      toast.error('Token de convite inválido');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao Flowalt</h1>
          <p className="text-muted-foreground mt-2">
            {user?.email && <span className="block text-sm">Logado como {user.email}</span>}
            Para começar, crie um workspace ou aceite um convite.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="create" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Workspace
            </TabsTrigger>
            <TabsTrigger value="invite" className="gap-2">
              <Mail className="h-4 w-4" />
              Tenho um Convite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Criar Novo Workspace</CardTitle>
                <CardDescription>
                  Crie seu próprio workspace e convide sua equipe.
                  Você será o proprietário (Owner).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Nome do Workspace</Label>
                    <Input
                      id="workspace-name"
                      placeholder="Ex: Minha Agência, Equipe de Design..."
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      disabled={isCreating}
                    />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">O que será criado:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Workspace com você como Owner</li>
                      <li>• Espaço "Clientes" para gestão</li>
                      <li>• Categorias financeiras padrão</li>
                      <li>• Pronto para convidar sua equipe</li>
                    </ul>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isCreating}>
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Criar Workspace
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite">
            <Card>
              <CardHeader>
                <CardTitle>Aceitar Convite</CardTitle>
                <CardDescription>
                  Cole o link ou token do convite que você recebeu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAcceptInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-token">Link ou Token do Convite</Label>
                    <Input
                      id="invite-token"
                      placeholder="Cole o link completo ou apenas o token..."
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      disabled={isAccepting}
                    />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      O convite foi enviado por email ou mensagem pelo administrador 
                      do workspace. Copie e cole o link aqui.
                    </p>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isAccepting}>
                    {isAccepting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Verificar Convite
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Precisa de ajuda? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}
