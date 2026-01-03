import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  RefreshCw,
  Loader2,
  Shield,
  Key,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Platform = 'meta' | 'google' | 'linkedin' | 'tiktok' | 'twitter';

interface ProviderStatus {
  status: 'not_configured' | 'partial' | 'ready';
  missing: string[];
  configured: string[];
  redirect_uri: string;
  displayName: string;
  portalUrl: string;
  activeConnections: number;
}

interface ProviderStatusResponse {
  providers: Record<Platform, ProviderStatus>;
  encryption_configured: boolean;
  summary: {
    ready: number;
    partial: number;
    not_configured: number;
    total: number;
  };
}

// Setup instructions per platform
const SETUP_INSTRUCTIONS: Record<Platform, {
  steps: string[];
  scopes: string[];
  notes: string[];
}> = {
  meta: {
    steps: [
      '1. Acesse developers.facebook.com e crie ou selecione um App',
      '2. Em "Adicionar Produtos", adicione: Facebook Login, Instagram Graph API, Pages API',
      '3. Em Configurações > Básico, copie o App ID e App Secret',
      '4. Em Facebook Login > Configurações, adicione a Redirect URI abaixo',
      '5. Em Permissões, solicite: pages_manage_posts, instagram_basic, instagram_content_publish',
      '6. Adicione os secrets META_APP_ID e META_APP_SECRET no Lovable Cloud',
    ],
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
    ],
    notes: [
      'O App precisa estar em modo "Live" para uso em produção',
      'Para Instagram, a conta deve ser Business ou Creator',
      'A Page do Facebook deve estar vinculada à conta do Instagram',
    ],
  },
  google: {
    steps: [
      '1. Acesse console.cloud.google.com e crie ou selecione um projeto',
      '2. Ative a YouTube Data API v3 em "APIs e Serviços"',
      '3. Em "Credenciais", crie uma credencial OAuth 2.0 (tipo Web)',
      '4. Configure a Tela de Consentimento OAuth (externo)',
      '5. Adicione a Redirect URI abaixo nas URIs autorizadas',
      '6. Copie o Client ID e Client Secret',
      '7. Adicione os secrets GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Lovable Cloud',
    ],
    scopes: [
      'youtube.upload',
      'youtube.readonly',
      'yt-analytics.readonly',
    ],
    notes: [
      'O projeto precisa estar verificado para produção',
      'A verificação do Google pode levar algumas semanas',
      'Teste com contas de teste antes de publicar',
    ],
  },
  linkedin: {
    steps: [
      '1. Acesse linkedin.com/developers e crie um App',
      '2. Selecione os produtos: Share on LinkedIn, Marketing Developer Platform',
      '3. Em Auth, copie o Client ID e Client Secret',
      '4. Adicione a Redirect URI abaixo em OAuth 2.0 settings',
      '5. Adicione os secrets LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET no Lovable Cloud',
    ],
    scopes: [
      'r_liteprofile',
      'w_member_social',
      'r_organization_social',
      'w_organization_social',
    ],
    notes: [
      'Para publicar em Company Pages, precisa do Marketing Developer Platform',
      'O app precisa ser verificado pelo LinkedIn',
    ],
  },
  tiktok: {
    steps: [
      '1. Acesse developers.tiktok.com e crie um App',
      '2. Selecione os produtos: Login Kit, Content Posting API',
      '3. Em App Details, copie o Client Key e Client Secret',
      '4. Adicione a Redirect URI abaixo nas configurações OAuth',
      '5. Adicione os secrets TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET no Lovable Cloud',
    ],
    scopes: [
      'user.info.basic',
      'video.upload',
      'video.publish',
    ],
    notes: [
      'O TikTok tem um processo de aprovação rigoroso',
      'Vídeos devem seguir as diretrizes da comunidade',
    ],
  },
  twitter: {
    steps: [
      '1. Acesse developer.twitter.com e crie um projeto',
      '2. Dentro do projeto, crie um App com OAuth 2.0',
      '3. Em User authentication settings, configure OAuth 2.0',
      '4. Selecione "Read and Write" permissions',
      '5. Adicione a Redirect URI abaixo',
      '6. Copie o Client ID e Client Secret (OAuth 2.0)',
      '7. Adicione os secrets TWITTER_CLIENT_ID e TWITTER_CLIENT_SECRET no Lovable Cloud',
    ],
    scopes: [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ],
    notes: [
      'Use OAuth 2.0 com PKCE (não OAuth 1.0a)',
      'O acesso gratuito tem limites de posting',
      'Para mais volume, considere o plano Basic ou Pro',
    ],
  },
};

export function AdminSocialSetup() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  // Fetch provider status
  const { data: providerStatus, isLoading, refetch, isRefetching } = useQuery<ProviderStatusResponse>({
    queryKey: ['social-provider-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('social-provider-status');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handleCopyRedirectUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    toast.success('Redirect URI copiada!');
  };

  const handleOpenSetup = (platform: Platform) => {
    setSelectedPlatform(platform);
    setSetupDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-500">Pronto</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Parcial</Badge>;
      default:
        return <Badge variant="destructive">Não configurado</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlatformData = selectedPlatform ? providerStatus?.providers[selectedPlatform] : null;
  const currentInstructions = selectedPlatform ? SETUP_INSTRUCTIONS[selectedPlatform] : null;

  return (
    <div className="space-y-6">
      {/* Header with encryption status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6" />
            Configuração de Social OAuth
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure as credenciais OAuth para cada plataforma social
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Encryption Key Warning */}
      {providerStatus && !providerStatus.encryption_configured && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Chave de Criptografia Não Configurada</AlertTitle>
          <AlertDescription>
            O secret TOKEN_ENCRYPTION_KEY precisa ser configurado para criptografar os tokens OAuth dos clientes.
            Adicione um valor de 32 caracteres aleatórios nos secrets do projeto.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {providerStatus && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Prontos</CardDescription>
              <CardTitle className="text-3xl text-green-600">{providerStatus.summary.ready}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Parciais</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{providerStatus.summary.partial}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Não Configurados</CardDescription>
              <CardTitle className="text-3xl text-destructive">{providerStatus.summary.not_configured}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Providers</CardDescription>
              <CardTitle className="text-3xl">{providerStatus.summary.total}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providerStatus && Object.entries(providerStatus.providers).map(([platform, status]) => (
          <Card key={platform} className={cn(
            "transition-all",
            status.status === 'ready' && "border-green-200 dark:border-green-800",
            status.status === 'partial' && "border-amber-200 dark:border-amber-800",
            status.status === 'not_configured' && "border-destructive/50"
          )}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(status.status)}
                  <div>
                    <CardTitle className="text-lg">{status.displayName}</CardTitle>
                    <CardDescription>
                      {status.activeConnections} conexão(ões) ativa(s)
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(status.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Configured/Missing secrets */}
              <div className="text-sm space-y-1">
                {status.configured.map(secret => (
                  <div key={secret} className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="font-mono text-xs">{secret}</span>
                  </div>
                ))}
                {status.missing.map(secret => (
                  <div key={secret} className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span className="font-mono text-xs">{secret}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant={status.status === 'ready' ? 'outline' : 'default'}
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenSetup(platform as Platform)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  {status.status === 'ready' ? 'Ver Configuração' : 'Configurar'}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open(status.portalUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configurar {currentPlatformData?.displayName}
            </DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para configurar a integração OAuth
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Status */}
              {currentPlatformData && (
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  {getStatusIcon(currentPlatformData.status)}
                  <div className="flex-1">
                    <p className="font-medium">Status atual: {getStatusBadge(currentPlatformData.status)}</p>
                    {currentPlatformData.missing.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Faltando: {currentPlatformData.missing.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Redirect URI */}
              {currentPlatformData && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Redirect URI (copie para o portal)
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-muted rounded text-xs break-all">
                      {currentPlatformData.redirect_uri}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCopyRedirectUri(currentPlatformData.redirect_uri)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Steps */}
              {currentInstructions && (
                <div className="space-y-3">
                  <h4 className="font-medium">Passos para Configuração:</h4>
                  <div className="space-y-2">
                    {currentInstructions.steps.map((step, index) => (
                      <div key={index} className="flex gap-3 text-sm">
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scopes */}
              {currentInstructions && (
                <div className="space-y-2">
                  <h4 className="font-medium">Escopos necessários:</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentInstructions.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="font-mono text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {currentInstructions && currentInstructions.notes.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Observações importantes</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      {currentInstructions.notes.map((note, index) => (
                        <li key={index} className="text-sm">{note}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => window.open(currentPlatformData?.portalUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Portal do Desenvolvedor
            </Button>
            <Button onClick={() => setSetupDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
