import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Settings,
  Shield,
  Key,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

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

const SETUP_INSTRUCTIONS: Record<Platform, {
  steps: string[];
  scopes: string[];
  notes: string[];
  secrets: { name: string; description: string }[];
}> = {
  meta: {
    steps: [
      'Acesse developers.facebook.com/apps e crie um novo app',
      'Selecione "Business" como tipo de app',
      'No painel, vá em Configurações > Básico',
      'Copie o App ID e App Secret',
      'Em Produtos, adicione "Facebook Login"',
      'Configure o Redirect URI no Facebook Login > Settings',
      'Em Permissões, solicite: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish',
    ],
    scopes: [
      'pages_show_list',
      'pages_read_engagement', 
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ],
    notes: [
      'O mesmo app serve para Facebook e Instagram',
      'Precisa de uma Página do Facebook para conectar Instagram',
      'App precisa estar em modo "Live" para produção',
    ],
    secrets: [
      { name: 'META_APP_ID', description: 'App ID do Meta Developer Portal' },
      { name: 'META_APP_SECRET', description: 'App Secret do Meta Developer Portal' },
    ],
  },
  google: {
    steps: [
      'Acesse console.cloud.google.com e crie um novo projeto',
      'Ative a YouTube Data API v3',
      'Vá em APIs & Services > Credentials',
      'Crie OAuth 2.0 Client ID (tipo Web Application)',
      'Adicione o Redirect URI nas URIs autorizadas',
      'Copie o Client ID e Client Secret',
      'Configure a tela de consentimento OAuth',
    ],
    scopes: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    notes: [
      'Usado para publicação no YouTube',
      'Precisa verificar o app para acesso a escopos sensíveis',
      'Limite de 10.000 requisições por dia (pode aumentar)',
    ],
    secrets: [
      { name: 'GOOGLE_CLIENT_ID', description: 'Client ID do Google Cloud Console' },
      { name: 'GOOGLE_CLIENT_SECRET', description: 'Client Secret do Google Cloud Console' },
    ],
  },
  linkedin: {
    steps: [
      'Acesse linkedin.com/developers/apps',
      'Crie um novo app vinculado a uma Company Page',
      'Vá em Auth e copie o Client ID e Client Secret',
      'Adicione o Redirect URI em OAuth 2.0 settings',
      'Em Products, solicite "Share on LinkedIn" e "Sign In with LinkedIn"',
      'Aguarde aprovação dos produtos (pode levar alguns dias)',
    ],
    scopes: [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social',
      'r_organization_social',
      'w_organization_social',
    ],
    notes: [
      'Precisa de uma Company Page verificada',
      'Alguns escopos requerem aprovação do LinkedIn',
      'Marketing Developer Platform para funcionalidades avançadas',
    ],
    secrets: [
      { name: 'LINKEDIN_CLIENT_ID', description: 'Client ID do LinkedIn Developer Portal' },
      { name: 'LINKEDIN_CLIENT_SECRET', description: 'Client Secret do LinkedIn Developer Portal' },
    ],
  },
  tiktok: {
    steps: [
      'Acesse developers.tiktok.com e crie um app',
      'Selecione os produtos: Login Kit e Content Posting API',
      'Em Configurações, copie o Client Key e Client Secret',
      'Adicione o Redirect URI nas configurações',
      'Solicite aprovação para os escopos necessários',
      'Aguarde revisão do TikTok (pode levar semanas)',
    ],
    scopes: [
      'user.info.basic',
      'video.list',
      'video.upload',
      'video.publish',
    ],
    notes: [
      'TikTok tem processo de aprovação rigoroso',
      'Precisa de conta TikTok Business para algumas funcionalidades',
      'API ainda em desenvolvimento, funcionalidades limitadas',
    ],
    secrets: [
      { name: 'TIKTOK_CLIENT_KEY', description: 'Client Key do TikTok Developer Portal' },
      { name: 'TIKTOK_CLIENT_SECRET', description: 'Client Secret do TikTok Developer Portal' },
    ],
  },
  twitter: {
    steps: [
      'Acesse developer.twitter.com e crie um projeto',
      'Crie um App dentro do projeto',
      'Em Keys and tokens, gere o OAuth 2.0 Client ID e Secret',
      'Em User authentication settings, configure OAuth 2.0',
      'Adicione o Redirect URI',
      'Selecione os escopos: tweet.read, tweet.write, users.read',
    ],
    scopes: [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ],
    notes: [
      'X (Twitter) usa OAuth 2.0 com PKCE',
      'Plano gratuito tem limite de 1.500 tweets/mês',
      'Plano Basic ($100/mês) para acesso completo à API',
    ],
    secrets: [
      { name: 'TWITTER_CLIENT_ID', description: 'OAuth 2.0 Client ID do Twitter Developer Portal' },
      { name: 'TWITTER_CLIENT_SECRET', description: 'OAuth 2.0 Client Secret do Twitter Developer Portal' },
    ],
  },
};

const PLATFORM_STYLES: Record<Platform, { icon: string; color: string }> = {
  meta: { icon: '📘', color: 'text-blue-600' },
  google: { icon: '🔴', color: 'text-red-600' },
  linkedin: { icon: '💼', color: 'text-blue-700' },
  tiktok: { icon: '🎵', color: 'text-pink-600' },
  twitter: { icon: '🐦', color: 'text-sky-500' },
};

export function AdminSocialSetup() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const queryClient = useQueryClient();

  const { data: providerStatus, isLoading, refetch } = useQuery({
    queryKey: ['social-provider-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('social-provider-status');

      if (error) throw error;
      return data as ProviderStatusResponse;
    },
  });

  const handleCopyUri = (uri: string) => {
    navigator.clipboard.writeText(uri);
    toast.success('Redirect URI copiado!');
  };

  const handleOpenPortal = (url: string) => {
    window.open(url, '_blank');
  };

  const handleVerifyProvider = async (platform: Platform) => {
    setIsVerifying(true);
    try {
      const response = await supabase.functions.invoke('social-provider-status', {
        body: { platform },
      });

      if (response.error) throw response.error;

      queryClient.setQueryData(['social-provider-status'], (old: ProviderStatusResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          providers: {
            ...old.providers,
            [platform]: response.data.providers[platform],
          },
        };
      });

      const newStatus = response.data.providers[platform]?.status;
      if (newStatus === 'ready') {
        toast.success(`${SETUP_INSTRUCTIONS[platform].secrets[0].name.split('_')[0]} configurado com sucesso!`);
      } else if (newStatus === 'partial') {
        toast.warning('Configuração parcial - faltam alguns secrets');
      } else {
        toast.error('Secrets ainda não configurados');
      }
    } catch (error) {
      console.error('Error verifying provider:', error);
      toast.error('Erro ao verificar configuração');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: ProviderStatus['status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" /> Pronto</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><AlertCircle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'not_configured':
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted"><XCircle className="h-3 w-3 mr-1" /> Não configurado</Badge>;
    }
  };

  const openConfigDialog = (platform: Platform) => {
    setSelectedPlatform(platform);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedProvider = selectedPlatform ? providerStatus?.providers[selectedPlatform] : null;
  const selectedInstructions = selectedPlatform ? SETUP_INSTRUCTIONS[selectedPlatform] : null;
  const selectedStyles = selectedPlatform ? PLATFORM_STYLES[selectedPlatform] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuração OAuth Social</h2>
          <p className="text-muted-foreground">
            Configure os providers de redes sociais para permitir conexões dos clientes
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Status
        </Button>
      </div>

      {providerStatus && !providerStatus.encryption_configured && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Chave de Criptografia Necessária</AlertTitle>
          <AlertDescription>
            O <code className="font-mono bg-destructive/20 px-1 rounded">TOKEN_ENCRYPTION_KEY</code> não está configurado.
            Esta chave é obrigatória para criptografar os tokens dos clientes de forma segura.
            Adicione um secret com uma chave de 32 caracteres no Lovable Cloud.
          </AlertDescription>
        </Alert>
      )}

      {providerStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{providerStatus.summary.ready}</div>
              <p className="text-sm text-muted-foreground">Prontos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{providerStatus.summary.partial}</div>
              <p className="text-sm text-muted-foreground">Parciais</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{providerStatus.summary.not_configured}</div>
              <p className="text-sm text-muted-foreground">Não Configurados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{providerStatus.summary.total}</div>
              <p className="text-sm text-muted-foreground">Total de Providers</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providerStatus && Object.entries(providerStatus.providers).map(([platform, status]) => {
          const styles = PLATFORM_STYLES[platform as Platform];
          return (
            <Card key={platform} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${status.status === 'ready' ? 'bg-green-500' : status.status === 'partial' ? 'bg-yellow-500' : 'bg-muted'}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{styles.icon}</span>
                    <CardTitle className="text-lg">{status.displayName}</CardTitle>
                  </div>
                  {getStatusBadge(status.status)}
                </div>
                <CardDescription>
                  {status.activeConnections} conexões ativas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {status.status !== 'ready' && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Faltando:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.missing.map(secret => (
                        <Badge key={secret} variant="outline" className="font-mono text-xs">
                          {secret}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {status.configured.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Configurados:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {status.configured.map(secret => (
                        <Badge key={secret} variant="secondary" className="font-mono text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {secret}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button 
                  className="w-full" 
                  variant={status.status === 'ready' ? 'outline' : 'default'}
                  onClick={() => openConfigDialog(platform as Platform)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {status.status === 'ready' ? 'Ver Configuração' : 'Configurar'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPlatform && selectedProvider && selectedInstructions && selectedStyles && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selectedStyles.icon}</span>
                  Configurar {selectedProvider.displayName}
                </DialogTitle>
                <DialogDescription>
                  Siga os passos abaixo para configurar a integração OAuth
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="font-medium">Status atual:</span>
                  {getStatusBadge(selectedProvider.status)}
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">1</span>
                    Copie o Redirect URI
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    Use este URI no portal do desenvolvedor para configurar o callback OAuth
                  </p>
                  <div className="flex gap-2 ml-8">
                    <Input 
                      value={selectedProvider.redirect_uri} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" onClick={() => handleCopyUri(selectedProvider.redirect_uri)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">2</span>
                    Crie o App no Portal
                  </h4>
                  <div className="ml-8 space-y-2">
                    <Button 
                      variant="outline" 
                      onClick={() => handleOpenPortal(selectedProvider.portalUrl)}
                      className="w-full justify-start"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir {selectedProvider.displayName} Developer Portal
                    </Button>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">Passos:</p>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        {selectedInstructions.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">3</span>
                    Adicione os Secrets
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    Após criar o app, adicione os secrets no Lovable Cloud
                  </p>
                  <div className="ml-8 space-y-2">
                    {selectedInstructions.secrets.map((secret) => {
                      const isConfigured = selectedProvider.configured.includes(secret.name);
                      return (
                        <div 
                          key={secret.name} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${isConfigured ? 'bg-green-50 border-green-200' : 'bg-muted border-border'}`}
                        >
                          <div className="flex items-center gap-3">
                            {isConfigured ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Key className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-mono text-sm font-medium">{secret.name}</p>
                              <p className="text-xs text-muted-foreground">{secret.description}</p>
                            </div>
                          </div>
                          {isConfigured ? (
                            <Badge className="bg-green-100 text-green-800">Configurado</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                        </div>
                      );
                    })}
                    
                    <Alert className="mt-3">
                      <Key className="h-4 w-4" />
                      <AlertTitle>Como adicionar secrets</AlertTitle>
                      <AlertDescription className="text-sm">
                        Acesse o painel do Lovable Cloud, vá em "Secrets" e adicione os secrets listados acima.
                        Após adicionar, clique em "Verificar Configuração" abaixo.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">4</span>
                    Verifique a Configuração
                  </h4>
                  <div className="ml-8">
                    <Button 
                      onClick={() => handleVerifyProvider(selectedPlatform)}
                      disabled={isVerifying}
                      className="w-full"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Verificar Configuração
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Escopos Necessários</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedInstructions.scopes.map(scope => (
                      <Badge key={scope} variant="outline" className="font-mono text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedInstructions.notes.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Notas Importantes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {selectedInstructions.notes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
