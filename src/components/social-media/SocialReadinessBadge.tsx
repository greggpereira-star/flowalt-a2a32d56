import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialReadinessBadgeProps {
  status: 'ready' | 'partial' | 'not_configured' | 'pending';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  ready: {
    icon: CheckCircle2,
    label: 'Disponível',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  partial: {
    icon: Clock,
    label: 'Parcial',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  not_configured: {
    icon: AlertCircle,
    label: 'Não configurado',
    className: 'bg-muted text-muted-foreground border-muted hover:bg-muted',
  },
  pending: {
    icon: Clock,
    label: 'Em configuração',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
};

const SIZE_CONFIG = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

export function SocialReadinessBadge({
  status,
  label,
  size = 'sm',
  showIcon = true,
  className,
}: SocialReadinessBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const displayLabel = label || config.label;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, SIZE_CONFIG[size], className)}
    >
      {showIcon && <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />}
      {displayLabel}
    </Badge>
  );
}

interface PlatformBadgeProps {
  platform: 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'twitter';
  isActive?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const PLATFORM_CONFIG = {
  instagram: {
    label: 'Instagram',
    icon: '📸',
    activeClass: 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-400/10 text-pink-700 border-pink-200',
  },
  facebook: {
    label: 'Facebook',
    icon: '📘',
    activeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  youtube: {
    label: 'YouTube',
    icon: '🔴',
    activeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: '💼',
    activeClass: 'bg-blue-50 text-blue-800 border-blue-300',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    activeClass: 'bg-gray-50 text-gray-900 border-gray-300',
  },
  twitter: {
    label: 'X',
    icon: '🐦',
    activeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
};

export function PlatformBadge({
  platform,
  isActive = true,
  size = 'sm',
  className,
}: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform];
  
  return (
    <Badge
      variant="outline"
      className={cn(
        isActive ? config.activeClass : 'bg-muted text-muted-foreground',
        SIZE_CONFIG[size],
        className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}

// Sales badge for pricing page
export function SocialFeatureBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-gradient-to-r from-primary/10 to-purple-500/10 text-primary border-primary/20',
        'px-3 py-1 text-sm font-medium',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
      Social Media PRO
    </Badge>
  );
}
