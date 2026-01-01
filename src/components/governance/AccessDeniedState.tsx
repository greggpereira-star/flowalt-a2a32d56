import React from 'react';
import { Lock, ShieldAlert, EyeOff, AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export type AccessDeniedType = 
  | 'restricted_card'
  | 'restricted_space'
  | 'restricted_folder'
  | 'no_permission'
  | 'content_unavailable';

interface AccessDeniedStateProps {
  type: AccessDeniedType;
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  showContactAdmin?: boolean;
  className?: string;
  compact?: boolean;
}

const defaultConfigs: Record<AccessDeniedType, {
  icon: React.ElementType;
  title: string;
  description: string;
}> = {
  restricted_card: {
    icon: Lock,
    title: 'Este card é restrito',
    description: 'Visível apenas para membros autorizados',
  },
  restricted_space: {
    icon: ShieldAlert,
    title: 'Você não tem acesso a este espaço',
    description: 'Fale com um administrador para solicitar acesso',
  },
  restricted_folder: {
    icon: EyeOff,
    title: 'Conteúdo restrito',
    description: 'Esta pasta contém conteúdo restrito a Admin / Coordenação',
  },
  no_permission: {
    icon: AlertTriangle,
    title: 'Sem permissão',
    description: 'Você não tem permissão para acessar este recurso',
  },
  content_unavailable: {
    icon: EyeOff,
    title: 'Conteúdo indisponível',
    description: 'Este conteúdo não está disponível para você no momento',
  },
};

export const AccessDeniedState: React.FC<AccessDeniedStateProps> = ({
  type,
  title,
  description,
  showHomeButton = true,
  showContactAdmin = true,
  className,
  compact = false,
}) => {
  const navigate = useNavigate();
  const config = defaultConfigs[type];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-muted/30',
        className
      )}>
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {title || config.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {description || config.description}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title || config.title}
        </h3>
        
        <p className="text-sm text-muted-foreground max-w-[280px] mb-6">
          {description || config.description}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {showHomeButton && (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Ir para Dashboard
            </Button>
          )}
          
          {showContactAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Could open a modal or redirect to contact form
                navigate('/settings?tab=members');
              }}
            >
              Falar com Administrador
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Inline version for cards/items in lists
export const AccessDeniedInline: React.FC<{
  message?: string;
  className?: string;
}> = ({ 
  message = 'Conteúdo restrito', 
  className 
}) => {
  return (
    <div className={cn(
      'flex items-center gap-2 text-muted-foreground',
      className
    )}>
      <Lock className="h-3.5 w-3.5" />
      <span className="text-xs">{message}</span>
    </div>
  );
};
