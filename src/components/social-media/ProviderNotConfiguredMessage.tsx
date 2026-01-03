import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Settings, 
  MessageCircle, 
  Clock, 
  ShieldAlert,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PlatformBadge, SocialReadinessBadge } from './SocialReadinessBadge';

interface ProviderNotConfiguredMessageProps {
  isSuperAdmin: boolean;
  platformName?: string;
  className?: string;
}

/**
 * Mensagem exibida quando o provider OAuth não está configurado
 * - Super Admin: CTA para ir para /platform configurar
 * - Cliente: Mensagem amigável + CTA para falar com suporte
 */
export function ProviderNotConfiguredMessage({
  isSuperAdmin,
  platformName,
  className,
}: ProviderNotConfiguredMessageProps) {
  if (isSuperAdmin) {
    return (
      <Alert className={cn('border-amber-200 bg-amber-50', className)}>
        <Settings className="h-5 w-5 text-amber-600" />
        <AlertTitle className="text-amber-800">
          Configuração de Provider Necessária
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-amber-700 mb-3">
            {platformName 
              ? `As credenciais OAuth para ${platformName} ainda não foram configuradas.`
              : 'Um ou mais providers OAuth precisam ser configurados para habilitar conexões.'}
          </p>
          <Link to="/platform?tab=social">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Providers
            </Button>
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // Client message
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          Integração em Configuração
        </h3>
        <p className="text-muted-foreground max-w-sm mb-4">
          {platformName 
            ? `A integração com ${platformName} está sendo configurada pelo administrador.`
            : 'Esta integração está em processo de configuração pelo administrador do sistema.'}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Disponível após ativação do administrador.
        </p>
        <Button variant="outline" size="sm">
          <MessageCircle className="h-4 w-4 mr-2" />
          Falar com suporte
        </Button>
      </CardContent>
    </Card>
  );
}

interface SocialUpsellCardProps {
  className?: string;
}

/**
 * Card para exibir na Pricing Page com os badges das plataformas
 */
export function SocialUpsellCard({ className }: SocialUpsellCardProps) {
  const platforms: Array<'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'twitter'> = [
    'instagram',
    'facebook',
    'youtube',
    'linkedin',
    'tiktok',
    'twitter',
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-primary" />
        <h4 className="font-semibold">Social Media PRO</h4>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Conecte Instagram, Facebook, YouTube, LinkedIn, TikTok e X com OAuth seguro.
        Agende posts, monitore métricas e gerencie todas as redes em um só lugar.
      </p>

      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => (
          <PlatformBadge 
            key={platform} 
            platform={platform} 
            isActive 
            size="sm" 
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4" />
        <span>OAuth 2.0 seguro • Tokens criptografados • Sem armazenar senhas</span>
      </div>
    </div>
  );
}

/**
 * Lista de status dos providers para o Super Admin
 */
interface ProviderStatusListProps {
  providers: Record<string, { status: 'ready' | 'partial' | 'not_configured'; displayName: string }>;
  className?: string;
}

export function ProviderStatusList({ providers, className }: ProviderStatusListProps) {
  if (!providers || Object.keys(providers).length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Object.entries(providers).map(([key, provider]) => (
        <div 
          key={key} 
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
        >
          <span className="font-medium">{provider.displayName}</span>
          <SocialReadinessBadge status={provider.status} />
        </div>
      ))}
    </div>
  );
}
