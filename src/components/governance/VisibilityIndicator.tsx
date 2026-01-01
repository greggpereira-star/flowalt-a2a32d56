import React from 'react';
import { Eye, EyeOff, Lock, Users, Globe, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type VisibilityLevel = 
  | 'inherit'
  | 'public'
  | 'workspace'
  | 'restricted'
  | 'private'
  | 'financial';

interface VisibilityIndicatorProps {
  level: VisibilityLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

const visibilityConfigs: Record<VisibilityLevel, {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  inherit: {
    icon: Users,
    label: 'Herdado',
    description: 'Herda visibilidade da pasta/espaço pai',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
  },
  public: {
    icon: Globe,
    label: 'Público',
    description: 'Visível para todos os membros do workspace',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  workspace: {
    icon: Users,
    label: 'Workspace',
    description: 'Visível para membros do workspace',
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  restricted: {
    icon: Lock,
    label: 'Restrito',
    description: 'Apenas Admin, Coordenação ou membros atribuídos',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  private: {
    icon: EyeOff,
    label: 'Privado',
    description: 'Visível apenas para você',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  financial: {
    icon: Shield,
    label: 'Financeiro',
    description: 'Apenas Financeiro e Proprietário',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
};

const sizeClasses = {
  sm: {
    container: 'h-5 px-1.5 gap-1',
    icon: 'h-3 w-3',
    text: 'text-[10px]',
    iconOnly: 'h-5 w-5',
  },
  md: {
    container: 'h-6 px-2 gap-1.5',
    icon: 'h-3.5 w-3.5',
    text: 'text-xs',
    iconOnly: 'h-6 w-6',
  },
  lg: {
    container: 'h-8 px-3 gap-2',
    icon: 'h-4 w-4',
    text: 'text-sm',
    iconOnly: 'h-8 w-8',
  },
};

export const VisibilityIndicator: React.FC<VisibilityIndicatorProps> = ({
  level,
  className,
  size = 'sm',
  showLabel = false,
  interactive = false,
  onClick,
}) => {
  const config = visibilityConfigs[level];
  const Icon = config.icon;
  const sizeClass = sizeClasses[size];

  const indicator = (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-md border transition-colors',
        config.bgColor,
        config.color,
        'border-current/20',
        showLabel ? sizeClass.container : sizeClass.iconOnly,
        interactive && 'cursor-pointer hover:opacity-80',
        className
      )}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <Icon className={sizeClass.icon} />
      {showLabel && (
        <span className={cn('font-medium', sizeClass.text)}>
          {config.label}
        </span>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="text-center">
            <p className="text-xs font-medium">{config.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {config.description}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Icon-only version for tight spaces
export const VisibilityIcon: React.FC<{
  level: VisibilityLevel;
  className?: string;
}> = ({ level, className }) => {
  const config = visibilityConfigs[level];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Icon className={cn('h-3.5 w-3.5', config.color, className)} />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
