import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  useSocialPlatformsWithState,
  useUnconnectedPlatformState,
  useDisconnectPlatform,
  useRefreshPlatformToken,
  useTestPlatformConnection,
  type PlatformWithState,
} from '@/hooks/useSocialPlatforms';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PlatformConnectionWizard } from './PlatformConnectionWizard';
import { SmokeTestConsole } from './SmokeTestConsole';
import type { PlatformState } from '@/lib/social/platform-state';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Music2,
  Twitter,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Settings,
  Zap,
  Info,
  ExternalLink,
  Crown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PlatformId = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface PlatformConfig {
  id: PlatformId;
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    bgColor: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    description: 'Posts, Stories, Reels e Carrossel',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600',
    description: 'Posts, Stories e Vídeos',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    bgColor: 'bg-blue-700',
    description: 'Posts e Artigos',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Music2,
    color: 'text-black',
    bgColor: 'bg-black',
    description: 'Vídeos curtos',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-600',
    bgColor: 'bg-red-600',
    description: 'Vídeos e Shorts',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: Twitter,
    color: 'text-black',
    bgColor: 'bg-black',
    description: 'Tweets e Threads',
  },
];

/**
 * Badge variant based on platform state
 */
function getStateBadgeProps(state: PlatformState): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  icon: React.ReactNode;
  text: string;
} {
  switch (state) {
    case 'CONNECTED':
      return {
        variant: 'outline',
        className: 'bg-green-50 text-green-700 border-green-200',
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        text: 'Conectado',
      };
    case 'ASSET_REQUIRED':
      return {
        variant: 'outline',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <Settings className="h-3 w-3 mr-1" />,
        text: 'Selecionar ativo',
      };
    case 'EXPIRING':
      return {
        variant: 'outline',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <Clock className="h-3 w-3 mr-1" />,
        text: 'Token expirando',
      };
    case 'EXPIRED':
      return {
        variant: 'outline',
        className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        icon: <Clock className="h-3 w-3 mr-1" />,
        text: 'Token expirado',
      };
    case 'ERROR':
      return {
        variant: 'outline',
        className: 'bg-red-50 text-red-700 border-red-200',
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
        text: 'Erro',
      };
    case 'PROVIDER_NOT_CONFIGURED':
      return {
        variant: 'outline',
        className: 'bg-gray-50 text-gray-500 border-gray-200',
        icon: <Settings className="h-3 w-3 mr-1" />,
        text: 'Em configuração',
      };
    case 'PLAN_REQUIRED':
      return {
        variant: 'outline',
        className: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <Crown className="h-3 w-3 mr-1" />,
        text: 'Premium',
      };
    case 'LIMIT_REACHED':
      return {
        variant: 'outline',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <Lock className="h-3 w-3 mr-1" />,
        text: 'Limite atingido',
      };
    default:
      return {
        variant: 'outline',
        className: 'bg-gray-50 text-gray-600 border-gray-200',
        icon: null,
        text: 'Desconectado',
      };
  }
}

/**
 * Platform Card for connected platforms
 */
function ConnectedPlatformCard({
  platform,
  config,
  onDisconnect,
  onRefresh,
  onTest,
  onSelectAsset,
  onReconnect,
  isRefreshing,
  isTesting,
  isSuperAdmin,
}: {
  platform: PlatformWithState;
  config: PlatformConfig;
  onDisconnect: () => void;
  onRefresh: () => void;
  onTest: () => void;
  onSelectAsset: () => void;
  onReconnect: () => void;
  isRefreshing: boolean;
  isTesting: boolean;
  isSuperAdmin?: boolean;
}) {
  const Icon = config.icon;
  const badgeProps = getStateBadgeProps(platform.computedState);
  
  // Don't show fake account names
  const showAccountName = platform.computedState === 'CONNECTED' || 
    platform.computedState === 'EXPIRING' || 
    platform.computedState === 'EXPIRED' ||
    platform.computedState === 'ERROR';
  
  const hasValidAccountName = platform.account_name && 
    !platform.account_name.includes('account_') &&
    !platform.account_name.includes('_account');

  return (
    <Card className="relative overflow-hidden ring-2 ring-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg text-white", config.bgColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{config.name}</CardTitle>
              <CardDescription className="text-xs">
                {config.description}
              </CardDescription>
            </div>
          </div>
          <Badge variant={badgeProps.variant} className={badgeProps.className}>
            {badgeProps.icon}
            {badgeProps.text}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Account name - only show if valid */}
          {showAccountName && hasValidAccountName && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                @{platform.account_name}
              </span>
            </div>
          )}
          
          {/* GOX Message for error states */}
          {(platform.computedState === 'ERROR' || platform.computedState === 'EXPIRED') && 
            platform.last_error_message && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              {platform.last_error_message}
            </p>
          )}

          {/* Technical details for Super Admin */}
          {isSuperAdmin && platform.last_error_code && (
            <div className="text-xs font-mono bg-muted/30 p-2 rounded border border-dashed">
              <span className="text-muted-foreground">Error code:</span>{' '}
              <span className="text-destructive">{platform.last_error_code}</span>
              {platform.connection_status && (
                <>
                  <br />
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span>{platform.connection_status}</span>
                </>
              )}
            </div>
          )}
          
          {/* Action buttons based on state */}
          <div className="flex flex-wrap items-center gap-2">
            {platform.computedState === 'ASSET_REQUIRED' && (
              <Button onClick={onSelectAsset} size="sm" className="flex-1">
                <Settings className="h-4 w-4 mr-1" />
                Selecionar ativo
              </Button>
            )}
            
            {platform.computedState === 'CONNECTED' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={onTest}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Testar conexão</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {(platform.computedState === 'EXPIRING') && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")} />
                Renovar
              </Button>
            )}
            
            {(platform.computedState === 'EXPIRED' || platform.computedState === 'ERROR') && (
              <Button
                size="sm"
                onClick={onReconnect}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reconectar
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Last sync info */}
          {platform.last_sync_at && (platform.computedState === 'CONNECTED' || platform.computedState === 'EXPIRING') && (
            <p className="text-xs text-muted-foreground">
              Última sincronização: {new Date(platform.last_sync_at).toLocaleDateString('pt-BR')}
            </p>
          )}
          
          {platform.last_tested_at && (
            <p className="text-xs text-muted-foreground">
              Última validação: {new Date(platform.last_tested_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Platform Card for unconnected platforms
 */
function UnconnectedPlatformCard({
  config,
  onConnect,
  isSuperAdmin,
}: {
  config: PlatformConfig;
  onConnect: () => void;
  isSuperAdmin?: boolean;
}) {
  const { computedState, stateConfig, canConnect } = useUnconnectedPlatformState(config.id);
  const Icon = config.icon;
  const badgeProps = getStateBadgeProps(computedState);

  // Blocked states
  const isBlocked = ['PROVIDER_NOT_CONFIGURED', 'PLAN_REQUIRED', 'LIMIT_REACHED'].includes(computedState);

  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg text-white", config.bgColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{config.name}</CardTitle>
              <CardDescription className="text-xs">
                {config.description}
              </CardDescription>
            </div>
          </div>
          {isBlocked && (
            <Badge variant={badgeProps.variant} className={badgeProps.className}>
              {badgeProps.icon}
              {badgeProps.text}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {computedState === 'PROVIDER_NOT_CONFIGURED' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {stateConfig.goxMessage.message}
            </p>
            {isSuperAdmin ? (
              <Button asChild variant="secondary" className="w-full">
                <Link to="/platform?tab=social">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar OAuth
                </Link>
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled variant="secondary" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Em configuração
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>O administrador do sistema está configurando esta integração.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : computedState === 'PLAN_REQUIRED' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {stateConfig.goxMessage.message}
            </p>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/settings?tab=plano">
                <Crown className="h-4 w-4 mr-2" />
                Ver planos
              </Link>
            </Button>
          </div>
        ) : computedState === 'LIMIT_REACHED' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {stateConfig.goxMessage.message}
            </p>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/settings?tab=plano">
                <Lock className="h-4 w-4 mr-2" />
                Fazer upgrade
              </Link>
            </Button>
          </div>
        ) : (
          <Button
            onClick={onConnect}
            disabled={!canConnect}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Conectar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PlatformConnector() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { 
    data: platforms, 
    isLoading,
    hasSocialPublish,
    platformsLimit,
    currentPlatformCount,
    canConnectMore,
    isSuperAdmin,
  } = useSocialPlatformsWithState();
  
  const disconnectPlatform = useDisconnectPlatform();
  const refreshToken = useRefreshPlatformToken();
  const testConnection = useTestPlatformConnection();
  
  const [disconnectDialog, setDisconnectDialog] = useState<{ 
    open: boolean; 
    platform: PlatformWithState | null;
  }>({
    open: false,
    platform: null,
  });
  
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<{ id: PlatformId; name: string } | null>(null);
  const [wizardMode, setWizardMode] = useState<'connect' | 'asset_select' | 'reconnect'>('connect');
  const [initialOauthError, setInitialOauthError] = useState<{ code: string; description?: string } | null>(null);

  // Detect OAuth callback and auto-open wizard (and apply Meta invalid-scope fallback)
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const oauthError = searchParams.get('oauth_error');
    const errorDescription = searchParams.get('error_description') || undefined;
    const platform = searchParams.get('platform') as PlatformId | null;

    if (!platform) return;

    const hasOauthResult = oauthSuccess === 'true' || !!oauthError;
    if (!hasOauthResult) return;

    const normalizedError = oauthError?.toLowerCase();
    const isInvalidScope = normalizedError === 'invalid_scope' || oauthError === 'INVALID_SCOPE';
    const isMeta = platform === 'facebook' || platform === 'instagram';

    const redirectToAuth = (authUrl: string) => {
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = authUrl;
        } else {
          window.location.href = authUrl;
        }
      } catch {
        const win = window.open(authUrl, '_blank', 'noopener,noreferrer');
        if (!win) window.location.href = authUrl;
      }
    };

    // Auto-fallback: if Meta returns invalid_scope, re-try once without pages_show_list
    if (isMeta && isInvalidScope && currentWorkspace?.id) {
      const retryKey = `meta_oauth_retry:${currentWorkspace.id}:${platform}`;
      const alreadyRetried = window.localStorage.getItem(retryKey);

      if (!alreadyRetried) {
        window.localStorage.setItem(retryKey, '1');

        // Clean URL params early to avoid loops on refresh
        const cleaned = new URLSearchParams(searchParams);
        cleaned.delete('oauth_success');
        cleaned.delete('oauth_error');
        cleaned.delete('platform');
        cleaned.delete('error_description');
        setSearchParams(cleaned, { replace: true });

        (async () => {
          const { data, error } = await supabase.functions.invoke('social-oauth-start', {
            body: {
              platform,
              workspace_id: currentWorkspace.id,
              return_url: `${window.location.origin}${window.location.pathname}`,
              meta_scope_strategy: 'fallback',
            },
          });

          if (error || !data?.auth_url) {
            console.error('Meta fallback OAuth start failed:', error);
            toast.error('Falha ao tentar reconectar com permissões ajustadas.');
            setInitialOauthError({ code: 'INVALID_SCOPE', description: errorDescription });
            return;
          }

          redirectToAuth(data.auth_url);
        })();

        return;
      }

      // If we already retried once, open wizard and show a GOX message
      setInitialOauthError({ code: 'INVALID_SCOPE', description: errorDescription });
    } else if (oauthError) {
      setInitialOauthError({ code: oauthError, description: errorDescription });
    } else {
      setInitialOauthError(null);
    }

    // Find platform config to get name
    const platformConfig = PLATFORMS.find(p => p.id === platform);
    if (platformConfig) {
      setSelectedPlatform({ id: platform, name: platformConfig.name });
      setWizardMode('connect');
      setWizardOpen(true);
    }

    // Clean URL params
    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('oauth_success');
    cleaned.delete('oauth_error');
    cleaned.delete('platform');
    cleaned.delete('error_description');
    setSearchParams(cleaned, { replace: true });
  }, [searchParams, setSearchParams, currentWorkspace?.id]);

  const getConnectedPlatform = (platformId: string): PlatformWithState | undefined => {
    // Only return truly active and connected platforms
    return platforms?.find(p => p.platform === platformId && p.is_active);
  };

  const handleConnect = (platformId: PlatformId, platformName: string) => {
    setSelectedPlatform({ id: platformId, name: platformName });
    setWizardMode('connect');
    setWizardOpen(true);
  };

  const handleSelectAsset = (platform: PlatformWithState, platformName: string) => {
    setSelectedPlatform({ id: platform.platform as PlatformId, name: platformName });
    setWizardMode('asset_select');
    setWizardOpen(true);
  };

  const handleReconnect = (platformId: PlatformId, platformName: string) => {
    setSelectedPlatform({ id: platformId, name: platformName });
    setWizardMode('reconnect');
    setWizardOpen(true);
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog.platform) return;

    await disconnectPlatform.mutateAsync({ 
      platformId: disconnectDialog.platform.id,
      reason: 'user_initiated',
    });
    setDisconnectDialog({ open: false, platform: null });
  };

  const handleRefreshToken = async (platformId: string) => {
    await refreshToken.mutateAsync(platformId);
  };

  const handleTestConnection = async (platformId: string) => {
    await testConnection.mutateAsync(platformId);
  };

  // Plan required - show upgrade card
  if (!hasSocialPublish) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Recurso Premium</h3>
          <p className="text-muted-foreground max-w-sm">
            Conecte suas redes sociais e publique diretamente do FlowAlt.
            Faça upgrade para PRO para desbloquear.
          </p>
          <Button asChild className="mt-4">
            <Link to="/settings?tab=plano">Ver planos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Plataformas Conectadas</h2>
          <p className="text-sm text-muted-foreground">
            {currentPlatformCount} de {platformsLimit ?? '∞'} plataformas conectadas
          </p>
        </div>
        {!canConnectMore && (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            <Lock className="h-3 w-3 mr-1" />
            Limite atingido
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((config) => {
          const connected = getConnectedPlatform(config.id);

          if (connected) {
            return (
              <ConnectedPlatformCard
                key={config.id}
                platform={connected}
                config={config}
                onDisconnect={() => setDisconnectDialog({ open: true, platform: connected })}
                onRefresh={() => handleRefreshToken(connected.id)}
                onTest={() => handleTestConnection(connected.id)}
                onSelectAsset={() => handleSelectAsset(connected, config.name)}
                onReconnect={() => handleReconnect(config.id, config.name)}
                isRefreshing={refreshToken.isPending}
                isTesting={testConnection.isPending}
                isSuperAdmin={isSuperAdmin}
              />
            );
          }

          return (
            <UnconnectedPlatformCard
              key={config.id}
              config={config}
              onConnect={() => handleConnect(config.id, config.name)}
              isSuperAdmin={isSuperAdmin}
            />
          );
        })}
      </div>

      {/* Disconnect confirmation dialog */}
      <AlertDialog
        open={disconnectDialog.open}
        onOpenChange={(open) => setDisconnectDialog({ open, platform: disconnectDialog.platform })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar plataforma?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover a conexão com {disconnectDialog.platform?.account_name || 'esta conta'}.
              Posts agendados para esta conta não serão publicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700"
              disabled={disconnectPlatform.isPending}
            >
              {disconnectPlatform.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Smoke Test Console - Admin/Owner only */}
      <SmokeTestConsole />

      {/* Platform Connection Wizard */}
      {selectedPlatform && (
        <PlatformConnectionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          platformId={selectedPlatform.id}
          platformName={selectedPlatform.name}
          isSuperAdmin={isSuperAdmin}
          initialOauthError={initialOauthError}
          onSuccess={() => {
            setSelectedPlatform(null);
            setInitialOauthError(null);
            queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
          }}
        />
      )}
    </div>
  );
}
