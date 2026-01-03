import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { 
  useSocialPlatforms, 
  useConnectPlatform, 
  useDisconnectPlatform, 
  useRefreshPlatformToken,
  type ConnectedPlatform 
} from '@/hooks/useSocialPlatforms';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PlatformConnectionWizard } from './PlatformConnectionWizard';
import { SmokeTestConsole } from './SmokeTestConsole';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PlatformId = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface PlatformConfig {
  id: string;
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

export function PlatformConnector() {
  const { currentWorkspace } = useWorkspace();
  const { has, limit } = useEntitlementRegistry();
  const queryClient = useQueryClient();
  
  const { data: platforms } = useSocialPlatforms();
  const connectPlatform = useConnectPlatform();
  const disconnectPlatform = useDisconnectPlatform();
  const refreshToken = useRefreshPlatformToken();
  
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; platform: ConnectedPlatform | null }>({
    open: false,
    platform: null,
  });
  
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<{ id: PlatformId; name: string } | null>(null);

  const togglePlatform = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('social_platforms')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
    },
  });

  const hasSocialPublish = has('social_publish');
  const platformsLimit = limit('social_platforms_limit');
  const connectedCount = platforms?.filter(p => p.is_active)?.length || 0;
  const canConnectMore = platformsLimit === null || connectedCount < platformsLimit;

  const getConnectedPlatform = (platformId: string) => {
    return platforms?.find(p => p.platform === platformId);
  };

  const getStatusBadge = (platform: ConnectedPlatform) => {
    if (!platform) return null;
    
    switch (platform.connection_status) {
      case 'connected':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'pending_assets':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Selecionar ativo
          </Badge>
        );
      case 'expiring':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Token expirando
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Token expirado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleConnect = (platformId: string, platformName: string) => {
    if (!canConnectMore) {
      toast.error('Limite de plataformas atingido', {
        description: 'Faça upgrade do seu plano para conectar mais plataformas.',
      });
      return;
    }

    // Open the wizard instead of mock connection
    setSelectedPlatform({ id: platformId as PlatformId, name: platformName });
    setWizardOpen(true);
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog.platform) return;

    await disconnectPlatform.mutateAsync(disconnectDialog.platform.id);
    setDisconnectDialog({ open: false, platform: null });
    toast.success('Plataforma desconectada');
  };

  const handleRefreshToken = async (platformId: string) => {
    await refreshToken.mutateAsync(platformId);
    toast.success('Token atualizado com sucesso!');
  };

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
          <Button className="mt-4">Ver planos</Button>
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
            {connectedCount} de {platformsLimit ?? '∞'} plataformas conectadas
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
        {PLATFORMS.map((platform) => {
          const connected = getConnectedPlatform(platform.id);
          const Icon = platform.icon;

          return (
            <Card
              key={platform.id}
              className={cn(
                "relative overflow-hidden transition-all",
                connected && "ring-2 ring-primary/20"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg text-white", platform.bgColor)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{platform.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {platform.description}
                      </CardDescription>
                    </div>
                  </div>
                  {connected && (
                    <Switch
                      checked={connected.is_active}
                      onCheckedChange={(checked) => togglePlatform.mutate({ id: connected.id, isActive: checked })}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        @{connected.account_name}
                      </span>
                      {getStatusBadge(connected)}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {connected.connection_status === 'expired' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshToken(connected.id)}
                          disabled={refreshToken.isPending}
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-1", refreshToken.isPending && "animate-spin")} />
                          Reconectar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisconnectDialog({ open: true, platform: connected })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Desconectar
                      </Button>
                    </div>

                    {connected.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Última sincronização: {new Date(connected.last_sync_at).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={() => handleConnect(platform.id, platform.name)}
                    disabled={!canConnectMore || connectPlatform.isPending}
                    className="w-full"
                    variant={canConnectMore ? "default" : "secondary"}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Conectar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog
        open={disconnectDialog.open}
        onOpenChange={(open) => setDisconnectDialog({ open, platform: disconnectDialog.platform })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar plataforma?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover a conexão com {disconnectDialog.platform?.account_name}.
              Posts agendados para esta conta não serão publicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700"
            >
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
          onSuccess={() => {
            setSelectedPlatform(null);
            queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
          }}
        />
      )}
    </div>
  );
}
