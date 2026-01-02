import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMyWorkspaceInvites } from '@/hooks/useMyWorkspaceInvites';
import { useAcceptWorkspaceInvite } from '@/hooks/useWorkspaceInvites';
import {
  Plus,
  Mail,
  Building2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Users,
  Target,
  Palette,
  Megaphone,
  Share2,
  Briefcase,
  Check,
  LogOut,
  Clock,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Step = 'choice' | 'create-form' | 'invite';

const COMPANY_SIZES = [
  { value: 'solo', label: 'Solo (apenas eu)' },
  { value: '2-5', label: '2 a 5 pessoas' },
  { value: '6-15', label: '6 a 15 pessoas' },
  { value: '16-50', label: '16 a 50 pessoas' },
  { value: '50+', label: 'Mais de 50 pessoas' },
];

const USE_OBJECTIVES = [
  { id: 'project-management', label: 'Gestão de projetos', icon: Target },
  { id: 'social-media', label: 'Social Media', icon: Share2 },
  { id: 'paid-traffic', label: 'Tráfego pago', icon: Megaphone },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'agency', label: 'Agência / Consultoria', icon: Briefcase },
  { id: 'other', label: 'Outro', icon: Users },
];

export default function FirstAccessPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { createWorkspace, refreshWorkspaces, workspaces, loading: workspaceLoading } = useWorkspace();
  const { data: pendingInvites = [], isLoading: invitesLoading } = useMyWorkspaceInvites();
  const acceptInvite = useAcceptWorkspaceInvite();

  const [step, setStep] = useState<Step>('choice');
  const [isCreating, setIsCreating] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  
  // Formulário de criação
  const [workspaceName, setWorkspaceName] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [segment, setSegment] = useState('');
  const [country, setCountry] = useState('Brasil');
  
  // Formulário de convite
  const [inviteToken, setInviteToken] = useState('');

  const handleAcceptPendingInvite = async (token: string, inviteId: string) => {
    setAcceptingInviteId(inviteId);
    try {
      await acceptInvite.mutateAsync(token);
      await refreshWorkspaces();
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aceitar convite');
    } finally {
      setAcceptingInviteId(null);
    }
  };

  useEffect(() => {
    // Se o usuário já tem workspace, não faz sentido ficar preso no onboarding.
    if (!workspaceLoading && workspaces.length > 0) {
      navigate('/');
    }
  }, [navigate, workspaceLoading, workspaces.length]);

  const toggleObjective = (id: string) => {
    setObjectives(prev => 
      prev.includes(id) 
        ? prev.filter(o => o !== id)
        : [...prev, id]
    );
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workspaceName.trim()) {
      toast.error('Digite o nome da empresa');
      return;
    }
    
    if (!companySize) {
      toast.error('Selecione o tamanho da empresa');
      return;
    }
    
    if (objectives.length === 0) {
      toast.error('Selecione pelo menos um objetivo de uso');
      return;
    }

    setIsCreating(true);
    try {
      const metadata = {
        company_size: companySize,
        objectives,
        segment: segment || null,
        country: country || 'Brasil',
      };
      
      const result = await createWorkspace(workspaceName.trim(), metadata);
      
      // Only show success and navigate if no error occurred
      if (result.error) {
        console.error('Workspace creation failed:', result.error);
        toast.error(result.error.message || 'Erro ao criar workspace. Tente novamente.');
        return;
      }
      
      // Double-check: ensure we actually have workspaces now
      await refreshWorkspaces();
      
      // Verify the workspace was created successfully by checking state
      toast.success('Workspace criado com sucesso!');
      
      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (error: any) {
      console.error('Unexpected error creating workspace:', error);
      toast.error(error.message || 'Erro inesperado ao criar workspace');
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

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'você';

  // STEP: Escolha inicial
  if (step === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>
        
        <div className="relative w-full max-w-lg animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-primary">Flowalt</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, {userName}!</h1>
            <p className="text-muted-foreground mt-2">
              Como você gostaria de começar?
            </p>
          </div>

          {/* Pending Invites Section */}
          {pendingInvites.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Você tem convites pendentes!</span>
                <Badge variant="secondary" className="ml-auto">
                  {pendingInvites.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {pendingInvites.map((invite) => {
                  const expiresIn = formatDistanceToNow(new Date(invite.expires_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  });
                  const isAcceptingThis = acceptingInviteId === invite.id;
                  
                  return (
                    <Card key={invite.id} className="border-primary/30 bg-primary/5">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{invite.workspace_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {invite.role}
                              </Badge>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expira {expiresIn}
                              </span>
                            </div>
                            {invite.inviter_name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Convidado por {invite.inviter_name}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAcceptPendingInvite(invite.token, invite.id)}
                            disabled={isAcceptingThis}
                          >
                            {isAcceptingThis ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Aceitar
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-4">
            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-lg group"
              onClick={() => setStep('create-form')}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Criar meu Workspace</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure um novo espaço de trabalho para sua empresa
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-lg group"
              onClick={() => setStep('invite')}
            >
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/80 group-hover:bg-secondary transition-colors">
                  <Mail className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Tenho um convite</h3>
                  <p className="text-sm text-muted-foreground">
                    Entre em um workspace existente com seu código de convite
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 space-y-2">
            <p className="text-xs text-muted-foreground">
              Logado como {user?.email}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate('/auth');
              }}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // STEP: Formulário de criação
  if (step === 'create-form') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>
        
        <div className="relative w-full max-w-xl animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => setStep('choice')}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-primary">Flowalt</span>
            </div>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Building2 className="h-6 w-6" />
                Criar Workspace
              </CardTitle>
              <CardDescription>
                Configure seu espaço de trabalho em poucos passos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWorkspace} className="space-y-6">
                {/* Nome da empresa */}
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">
                    Nome da empresa <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="workspace-name"
                    placeholder="Ex: Agência Criativa, Studio Design..."
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    disabled={isCreating}
                  />
                </div>

                {/* Tamanho da empresa */}
                <div className="space-y-2">
                  <Label>
                    Tamanho da empresa <span className="text-destructive">*</span>
                  </Label>
                  <Select value={companySize} onValueChange={setCompanySize} disabled={isCreating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map(size => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Objetivos de uso */}
                <div className="space-y-3">
                  <Label>
                    Principal objetivo de uso <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">Selecione um ou mais</p>
                  <div className="grid grid-cols-2 gap-2">
                    {USE_OBJECTIVES.map(obj => {
                      const Icon = obj.icon;
                      const isSelected = objectives.includes(obj.id);
                      return (
                        <div
                          key={obj.id}
                          onClick={() => !isCreating && toggleObjective(obj.id)}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                            ${isSelected 
                              ? 'border-primary bg-primary/5 text-primary' 
                              : 'border-border hover:border-primary/50'
                            }
                            ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <div className={`
                            flex h-8 w-8 items-center justify-center rounded-lg
                            ${isSelected ? 'bg-primary/10' : 'bg-muted'}
                          `}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium flex-1">{obj.label}</span>
                          {isSelected && <Check className="h-4 w-4" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Campos opcionais */}
                <div className="space-y-4 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Campos opcionais</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="segment">Segmento</Label>
                      <Input
                        id="segment"
                        placeholder="Ex: Marketing, Tech..."
                        value={segment}
                        onChange={(e) => setSegment(e.target.value)}
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">País</Label>
                      <Input
                        id="country"
                        placeholder="Brasil"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        disabled={isCreating}
                      />
                    </div>
                  </div>
                </div>

                {/* Info box */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">O que será criado:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-primary" />
                      Workspace com você como Owner
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-primary" />
                      Categorias financeiras padrão
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-primary" />
                      Pronto para criar espaços e convidar equipe
                    </li>
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
        </div>
      </div>
    );
  }

  // STEP: Aceitar convite
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-lg animate-fade-in">
        <Button
          variant="ghost"
          onClick={() => setStep('choice')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-primary">Flowalt</span>
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Mail className="h-6 w-6" />
              Aceitar Convite
            </CardTitle>
            <CardDescription>
              Cole o link ou token do convite que você recebeu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAcceptInvite} className="space-y-6">
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
      </div>
    </div>
  );
}
