import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Lock, Eye, EyeOff, Shield, User, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type VisibilityType = 'public' | 'restricted' | 'owner' | 'system' | 'financial';

interface RestrictedBadgeProps {
  type: VisibilityType;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  tooltipContent?: string;
}

const visibilityConfig: Record<VisibilityType, {
  icon: React.ElementType;
  label: string;
  description: string;
  className: string;
}> = {
  public: {
    icon: Eye,
    label: 'Público',
    description: 'Visível para todos os membros do workspace',
    className: 'bg-success/10 text-success border-success/20',
  },
  restricted: {
    icon: Lock,
    label: 'Restrito',
    description: 'Conteúdo restrito a Admin / Coordenação',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  owner: {
    icon: User,
    label: 'Você',
    description: 'Você é o proprietário deste item',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  system: {
    icon: Settings2,
    label: 'Sistema',
    description: 'Item gerenciado pelo sistema (não pode ser excluído)',
    className: 'bg-muted text-muted-foreground border-border',
  },
  financial: {
    icon: Shield,
    label: 'Financeiro',
    description: 'Visível apenas para Financeiro e Proprietário',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export const RestrictedBadge: React.FC<RestrictedBadgeProps> = ({
  type,
  className,
  showLabel = true,
  size = 'sm',
  tooltipContent,
}) => {
  const config = visibilityConfig[type];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-normal',
        size === 'sm' && 'text-[10px] h-5 px-1.5',
        size === 'md' && 'text-xs h-6 px-2',
        config.className,
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-[200px] text-center"
        >
          <p className="text-xs">{tooltipContent || config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
