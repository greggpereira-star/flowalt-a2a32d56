import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Facebook,
  Instagram,
  RefreshCw,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocialPlatformsWithState, type PlatformWithState } from '@/hooks/useSocialPlatforms';

interface MetaConnectionStatusProps {
  onManageConnections?: () => void;
  compact?: boolean;
}

export function MetaConnectionStatus({ onManageConnections, compact = false }: MetaConnectionStatusProps) {
  const { data: platforms, isLoading } = useSocialPlatformsWithState();

  if (isLoading) {
    return (
      <Card className={cn(compact && "border-0 shadow-none")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando conexões...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metaPlatforms = platforms?.filter(p => 
    p.platform === 'facebook' || p.platform === 'instagram'
  ) || [];

  const facebookConnection = metaPlatforms.find(p => p.platform === 'facebook');
  const instagramConnection = metaPlatforms.find(p => p.platform === 'instagram');

  const getConnectionStatus = (platform?: PlatformWithState) => {
    if (!platform) return { status: 'disconnected', label: 'Não conectado', color: 'text-muted-foreground' };
    
    switch (platform.computedState) {
      case 'CONNECTED':
        return { status: 'connected', label: 'Conectado', color: 'text-green-600' };
      case 'ASSET_REQUIRED':
        return { status: 'pending', label: 'Selecionar página', color: 'text-blue-600' };
      case 'EXPIRING':
        return { status: 'warning', label: 'Token expirando', color: 'text-amber-600' };
      case 'EXPIRED':
        return { status: 'error', label: 'Token expirado', color: 'text-red-600' };
      case 'ERROR':
        return { status: 'error', label: 'Erro', color: 'text-red-600' };
      default:
        return { status: 'disconnected', label: 'Não conectado', color: 'text-muted-foreground' };
    }
  };

  const fbStatus = getConnectionStatus(facebookConnection);
  const igStatus = getConnectionStatus(instagramConnection);

  const connectedCount = metaPlatforms.filter(p => p.computedState === 'CONNECTED').length;
  const totalMeta = 2; // Facebook + Instagram
  const connectionProgress = (connectedCount / totalMeta) * 100;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Settings className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Facebook className="h-4 w-4 text-blue-600" />
          {getStatusIcon(fbStatus.status)}
        </div>
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500" />
          {getStatusIcon(igStatus.status)}
        </div>
        {onManageConnections && (
          <Button variant="ghost" size="sm" onClick={onManageConnections}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Conexões Meta
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Facebook e Instagram via Graph API v24.0
            </CardDescription>
          </div>
          {onManageConnections && (
            <Button variant="outline" size="sm" onClick={onManageConnections}>
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso de conexão</span>
            <span className="font-medium">{connectedCount}/{totalMeta}</span>
          </div>
          <Progress value={connectionProgress} className="h-2" />
        </div>

        {/* Platform status cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Facebook */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded bg-blue-100">
                <Facebook className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-medium text-sm">Facebook</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(fbStatus.status)}
              <span className={cn("text-xs", fbStatus.color)}>{fbStatus.label}</span>
            </div>
            {facebookConnection?.account_name && fbStatus.status === 'connected' && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {facebookConnection.account_name}
              </p>
            )}
          </div>

          {/* Instagram */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded bg-gradient-to-br from-purple-100 to-pink-100">
                <Instagram className="h-4 w-4 text-pink-600" />
              </div>
              <span className="font-medium text-sm">Instagram</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(igStatus.status)}
              <span className={cn("text-xs", igStatus.color)}>{igStatus.label}</span>
            </div>
            {instagramConnection?.account_name && igStatus.status === 'connected' && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {instagramConnection.account_name}
              </p>
            )}
          </div>
        </div>

        {/* Quick tips */}
        {connectedCount < totalMeta && (
          <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Dicas para conectar:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Use uma conta que seja administrador da Página</li>
              <li>Para Instagram, a conta deve ser Business/Creator vinculada a uma Página</li>
              <li>Autorize todas as permissões solicitadas</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
