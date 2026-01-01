import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info, Lock, AlertCircle } from 'lucide-react';

export type PermissionReason = 
  | 'not_owner'
  | 'not_admin'
  | 'not_coordinator'
  | 'not_financial'
  | 'not_member'
  | 'restricted_content'
  | 'system_managed'
  | 'no_access';

interface PermissionTooltipProps {
  children: React.ReactNode;
  reason: PermissionReason;
  customMessage?: string;
  disabled?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const reasonMessages: Record<PermissionReason, string> = {
  not_owner: 'Você só pode excluir itens criados por você',
  not_admin: 'Apenas Admin e Proprietário podem fazer isso',
  not_coordinator: 'Apenas Coordenação ou acima pode fazer isso',
  not_financial: 'Visível apenas para Financeiro e Proprietário',
  not_member: 'Você precisa ser membro para fazer isso',
  restricted_content: 'Conteúdo restrito a membros autorizados',
  system_managed: 'Este item é gerenciado pelo sistema',
  no_access: 'Você não tem acesso a este recurso',
};

const reasonIcons: Record<PermissionReason, React.ElementType> = {
  not_owner: Lock,
  not_admin: Lock,
  not_coordinator: Lock,
  not_financial: Lock,
  not_member: AlertCircle,
  restricted_content: Lock,
  system_managed: Info,
  no_access: AlertCircle,
};

export const PermissionTooltip: React.FC<PermissionTooltipProps> = ({
  children,
  reason,
  customMessage,
  disabled = true,
  side = 'top',
  className,
}) => {
  const message = customMessage || reasonMessages[reason];
  const Icon = reasonIcons[reason];

  // If not disabled, just render children without tooltip
  if (!disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          className="flex items-center gap-2 max-w-[250px]"
        >
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Convenience wrapper for disabled buttons
interface DisabledButtonWrapperProps {
  children: React.ReactNode;
  reason: PermissionReason;
  customMessage?: string;
  hasPermission: boolean;
}

export const DisabledButtonWrapper: React.FC<DisabledButtonWrapperProps> = ({
  children,
  reason,
  customMessage,
  hasPermission,
}) => {
  if (hasPermission) {
    return <>{children}</>;
  }

  return (
    <PermissionTooltip reason={reason} customMessage={customMessage} disabled>
      <span className="cursor-not-allowed">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              ...child.props,
              disabled: true,
              className: cn(child.props.className, 'pointer-events-none opacity-50'),
            });
          }
          return child;
        })}
      </span>
    </PermissionTooltip>
  );
};
