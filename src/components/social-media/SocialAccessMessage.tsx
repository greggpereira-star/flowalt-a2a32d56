import { AlertCircle, Lock, Unplug, Clock, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SocialBlockReason = 
  | 'no_card_access' 
  | 'no_entitlement' 
  | 'platform_disconnected' 
  | 'pending_approval'
  | 'downgrade_readonly';

interface SocialAccessMessageProps {
  reason: SocialBlockReason;
  platformName?: string;
  cardName?: string;
  onAction?: () => void;
  className?: string;
}

const BLOCK_CONFIGS: Record<SocialBlockReason, {
  icon: typeof AlertCircle;
  title: string;
  description: string;
  actionLabel?: string;
  variant: 'default' | 'destructive';
}> = {
  no_card_access: {
    icon: Shield,
    title: 'Sem acesso a este card',
    description: 'Você não tem permissão para visualizar ou editar posts deste card. Solicite acesso ao responsável pelo card ou entre em contato com o administrador do workspace.',
    actionLabel: 'Solicitar acesso',
    variant: 'default',
  },
  no_entitlement: {
    icon: Lock,
    title: 'Recurso não disponível no seu plano',
    description: 'O módulo de Mídias Sociais não está incluído no plano atual do workspace. Faça upgrade para ter acesso completo a criação, agendamento e métricas de posts.',
    actionLabel: 'Ver planos',
    variant: 'default',
  },
  platform_disconnected: {
    icon: Unplug,
    title: 'Plataforma desconectada',
    description: 'A conexão com esta plataforma expirou ou foi removida. Reconecte sua conta para continuar publicando.',
    actionLabel: 'Reconectar',
    variant: 'destructive',
  },
  pending_approval: {
    icon: Clock,
    title: 'Aguardando aprovação',
    description: 'Este post está aguardando aprovação de um coordenador ou administrador antes de ser agendado ou publicado.',
    variant: 'default',
  },
  downgrade_readonly: {
    icon: Lock,
    title: 'Modo somente leitura',
    description: 'O plano do workspace foi alterado e o módulo de Mídias Sociais está em modo somente leitura. Você pode visualizar o histórico, mas não pode criar ou editar posts.',
    actionLabel: 'Fazer upgrade',
    variant: 'default',
  },
};

export function SocialAccessMessage({ 
  reason, 
  platformName, 
  cardName,
  onAction,
  className 
}: SocialAccessMessageProps) {
  const config = BLOCK_CONFIGS[reason];
  const Icon = config.icon;

  // Personalize description with platform/card name if provided
  let description = config.description;
  if (platformName && reason === 'platform_disconnected') {
    description = `A conexão com ${platformName} expirou ou foi removida. Reconecte sua conta para continuar publicando.`;
  }
  if (cardName && reason === 'no_card_access') {
    description = `Você não tem permissão para visualizar ou editar posts do card "${cardName}". Solicite acesso ao responsável pelo card.`;
  }

  return (
    <Alert 
      variant={config.variant} 
      className={cn('border-l-4', className)}
    >
      <Icon className="h-5 w-5" />
      <AlertTitle className="font-semibold">{config.title}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        {config.actionLabel && onAction && (
          <Button 
            variant={config.variant === 'destructive' ? 'destructive' : 'outline'} 
            size="sm"
            onClick={onAction}
          >
            {config.actionLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Helper hook to determine which block reason applies
export function useSocialAccessCheck(params: {
  hasCardAccess?: boolean;
  hasEntitlement?: boolean;
  isPlatformConnected?: boolean;
  isPendingApproval?: boolean;
  isDowngraded?: boolean;
}): SocialBlockReason | null {
  const { hasCardAccess, hasEntitlement, isPlatformConnected, isPendingApproval, isDowngraded } = params;

  // Priority order of checks
  if (hasEntitlement === false) return 'no_entitlement';
  if (isDowngraded === true) return 'downgrade_readonly';
  if (hasCardAccess === false) return 'no_card_access';
  if (isPlatformConnected === false) return 'platform_disconnected';
  if (isPendingApproval === true) return 'pending_approval';

  return null;
}

export default SocialAccessMessage;
