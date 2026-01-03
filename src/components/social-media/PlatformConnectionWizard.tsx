import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Shield,
  RefreshCw,
  Info,
  ChevronDown,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

type PlatformId = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface PlatformConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformId: PlatformId;
  platformName: string;
  onSuccess?: () => void;
}

// Platform-specific configurations
const PLATFORM_CONFIGS: Record<PlatformId, {
  steps: WizardStep[];
  permissions: string[];
  authUrl?: string;
  instructions: string[];
  oauthSupported: boolean;
}> = {
  instagram: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com Meta' },
      { id: 'select', title: 'Seleção', description: 'Escolha a conta' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar posts, stories e reels',
      'Acessar métricas e insights',
      'Gerenciar mensagens diretas',
      'Ver informações do perfil',
    ],
    instructions: [
      'Você será redirecionado para o Facebook/Meta',
      'Faça login com a conta conectada ao Instagram Business',
      'Selecione a página do Facebook vinculada',
      'Escolha a conta do Instagram a conectar',
      'Autorize as permissões necessárias',
    ],
    oauthSupported: true,
  },
  facebook: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com Facebook' },
      { id: 'select', title: 'Seleção de Página', description: 'Escolha a página' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar em páginas',
      'Acessar insights da página',
      'Gerenciar mensagens',
      'Ver lista de páginas',
    ],
    instructions: [
      'Você será redirecionado para o Facebook',
      'Faça login com sua conta de administrador',
      'Selecione as páginas que deseja conectar',
      'Autorize as permissões de publicação',
    ],
    oauthSupported: true,
  },
  linkedin: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com LinkedIn' },
      { id: 'select', title: 'Seleção', description: 'Escolha empresa/perfil' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar posts e artigos',
      'Acessar analytics',
      'Publicar em nome da empresa',
      'Ver conexões e seguidores',
    ],
    instructions: [
      'Você será redirecionado para o LinkedIn',
      'Faça login com sua conta',
      'Selecione o perfil pessoal ou página da empresa',
      'Autorize as permissões da API Marketing',
    ],
    oauthSupported: true,
  },
  tiktok: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com TikTok' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar vídeos',
      'Acessar métricas',
      'Ver informações do perfil',
    ],
    instructions: [
      'Você será redirecionado para o TikTok for Business',
      'Faça login com sua conta comercial',
      'Autorize as permissões de publicação',
    ],
    oauthSupported: true,
  },
  youtube: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com Google' },
      { id: 'select', title: 'Seleção de Canal', description: 'Escolha o canal' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Fazer upload de vídeos',
      'Publicar Shorts',
      'Acessar YouTube Analytics',
      'Gerenciar playlists',
    ],
    instructions: [
      'Você será redirecionado para o Google',
      'Faça login com a conta do Google vinculada ao canal',
      'Selecione o canal do YouTube',
      'Autorize as permissões de upload e analytics',
    ],
    oauthSupported: true,
  },
  twitter: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com X' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar tweets',
      'Criar threads',
      'Acessar métricas',
      'Ver perfil e seguidores',
    ],
    instructions: [
      'Você será redirecionado para o X (Twitter)',
      'Faça login com sua conta',
      'Autorize o acesso do FlowAlt',
    ],
    oauthSupported: true,
  },
};

export function PlatformConnectionWizard({
  open,
  onOpenChange,
  platformId,
  platformName,
  onSuccess,
}: PlatformConnectionWizardProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [accountName, setAccountName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupInstructions, setSetupInstructions] = useState<string[]>([]);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  
  const config = PLATFORM_CONFIGS[platformId];
  const steps = config.steps;
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Check for OAuth callback result
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    const platform = searchParams.get('platform');
    
    if (oauthSuccess === 'true' && platform === platformId) {
      setConnectionStatus('success');
      setCurrentStep(totalSteps - 1);
      toast.success(`${platformName} conectado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
    }
    
    if (oauthError && platform === platformId) {
      setConnectionStatus('error');
      setErrorMessage(searchParams.get('error_description') || 'Erro na autenticação');
    }
  }, [searchParams, platformId, platformName, totalSteps, queryClient]);

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStartOAuth = async () => {
    if (!currentWorkspace?.id || !user?.id) {
      toast.error('Erro: workspace ou usuário não encontrado');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('connecting');
    setErrorMessage(null);
    setRequiresSetup(false);

    try {
      // Call the real OAuth start edge function
      const { data, error } = await supabase.functions.invoke('social-oauth-start', {
        body: {
          platform: platformId,
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          return_url: window.location.pathname,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.requires_setup) {
        // Platform credentials not configured
        setRequiresSetup(true);
        setSetupInstructions(data.setup_instructions || []);
        setErrorMessage(data.message);
        setConnectionStatus('error');
        setIsConnecting(false);
        return;
      }

      if (data.auth_url) {
        // Redirect to OAuth provider
        window.location.href = data.auth_url;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error: any) {
      console.error('OAuth start error:', error);
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Erro ao iniciar autenticação');
      setIsConnecting(false);
    }
  };

  const handleValidateConnection = async () => {
    if (!selectedAccount) return;
    
    setIsValidating(true);
    setConnectionStatus('connecting');
    setErrorMessage(null);
    
    try {
      // Call the real connection test edge function
      const { data, error } = await supabase.functions.invoke('social-connection-test', {
        body: { platform_id: selectedAccount.id },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setConnectionStatus('success');
        setAccountName(data.account_name || selectedAccount.name);
      } else {
        setConnectionStatus('error');
        setErrorMessage(data.error_message || 'Falha na validação');
        
        if (data.requires_reconnect) {
          toast.error('Token expirado', {
            description: 'Você precisa reconectar a plataforma.',
          });
        }
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Falha na validação');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFinishConnection = async () => {
    // Connection was already saved by OAuth callback
    // Just close the wizard and refresh
    queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
    queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
    
    toast.success(`${platformName} conectado com sucesso!`);
    onSuccess?.();
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(0);
    setConnectionStatus('idle');
    setAccountName('');
    setSelectedAccount(null);
    setErrorMessage(null);
    setRequiresSetup(false);
    setSetupInstructions([]);
    onOpenChange(false);
  };

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Conectar {platformName}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                O FlowAlt precisará das seguintes permissões para gerenciar suas publicações:
              </p>
            </div>

            <div className="space-y-2">
              {config.permissions.map((permission, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{permission}</span>
                </div>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Suas credenciais são criptografadas e nunca compartilhadas. 
                Você pode revogar o acesso a qualquer momento.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'auth':
        return (
          <div className="space-y-6">
            {requiresSetup ? (
              // Platform not configured - show setup instructions
              <div className="space-y-4">
                <Alert variant="destructive" className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Configuração necessária:</strong> As credenciais do {platformName} ainda não foram configuradas.
                  </AlertDescription>
                </Alert>

                <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Como configurar o {platformName}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", instructionsOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
                      {setupInstructions.map((instruction, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">{instruction}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <p className="text-xs text-muted-foreground text-center">
                  Após configurar os secrets, tente novamente.
                </p>
              </div>
            ) : (
              // Normal OAuth flow
              <>
                <div className="text-center py-4">
                  <h3 className="text-lg font-semibold mb-2">
                    Autenticação
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                    Siga os passos abaixo para conectar sua conta:
                  </p>
                </div>

                <div className="space-y-3">
                  {config.instructions.map((instruction, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </div>
                      <span className="text-sm pt-0.5">{instruction}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <Button
                  onClick={handleStartOAuth}
                  disabled={isConnecting}
                  className="w-full"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecionando...
                    </>
                  ) : (
                    <>
                      Iniciar Conexão OAuth
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        );

      case 'select':
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h3 className="text-lg font-semibold mb-2">
                Selecione a Conta
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Escolha qual conta deseja conectar ao FlowAlt:
              </p>
            </div>

            <div className="space-y-3">
              {/* Mock account options */}
              {[
                { id: `${platformId}_1`, name: `@${platformId}_business`, type: 'Conta Comercial' },
                { id: `${platformId}_2`, name: `@${platformId}_personal`, type: 'Perfil Pessoal' },
              ].map((account) => (
                <button
                  key={account.id}
                  onClick={() => {
                    setSelectedAccount(account);
                    setAccountName(account.name);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left",
                    selectedAccount?.id === account.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    {account.name[1]?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.type}</p>
                  </div>
                  {selectedAccount?.id === account.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customName">Nome de exibição (opcional)</Label>
              <Input
                id="customName"
                placeholder={selectedAccount?.name || 'Ex: @minha_conta'}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Este nome será usado para identificar a conta no FlowAlt
              </p>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              {connectionStatus === 'success' ? (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-green-700">
                    Conexão Validada!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Finalizar" para concluir a configuração.
                  </p>
                </>
              ) : connectionStatus === 'error' ? (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-red-700">
                    Erro na Validação
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage || 'Não foi possível validar a conexão.'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">
                    Confirmar Conexão
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Revise as informações antes de finalizar:
                  </p>
                </>
              )}
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plataforma</span>
                <span className="font-medium">{platformName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conta</span>
                <span className="font-medium">{accountName || selectedAccount?.name || '-'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={cn(
                    connectionStatus === 'success' && "bg-green-50 text-green-700 border-green-200",
                    connectionStatus === 'error' && "bg-red-50 text-red-700 border-red-200",
                    connectionStatus === 'idle' && "bg-amber-50 text-amber-700 border-amber-200"
                  )}
                >
                  {connectionStatus === 'success' ? 'Validado' :
                   connectionStatus === 'error' ? 'Erro' : 'Aguardando validação'}
                </Badge>
              </div>
            </div>

            {connectionStatus !== 'success' && (
              <Button
                onClick={handleValidateConnection}
                disabled={isValidating}
                variant="outline"
                className="w-full"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </Button>
            )}

            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Conectar {platformName}
          </DialogTitle>
          <DialogDescription>
            {steps[currentStep]?.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Passo {currentStep + 1} de {totalSteps}</span>
            <span>{steps[currentStep]?.title}</span>
          </div>
          <Progress value={progress} className="h-1" />
          
          {/* Step indicators */}
          <div className="flex items-center justify-between pt-2">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1",
                  idx <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                    idx < currentStep
                      ? "bg-primary text-primary-foreground"
                      : idx === currentStep
                      ? "border-2 border-primary text-primary"
                      : "border border-muted-foreground/30"
                  )}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Step Content */}
        <div className="py-4">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={currentStep === 0 ? handleClose : handlePrevious}
            disabled={isConnecting}
          >
            {currentStep === 0 ? (
              'Cancelar'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </>
            )}
          </Button>

          {currentStep < totalSteps - 1 ? (
            <Button
              onClick={handleNext}
              disabled={
                (steps[currentStep].id === 'auth' && requiresSetup) ||
                (steps[currentStep].id === 'select' && !selectedAccount)
              }
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinishConnection}
              disabled={isConnecting || connectionStatus !== 'success'}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Finalizar'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
