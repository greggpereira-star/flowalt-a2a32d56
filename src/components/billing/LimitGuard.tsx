import React, { useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBillingGovernanceEvents } from '@/hooks/useBillingGovernanceEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, Lock, TrendingUp, Crown, 
  ArrowRight, Settings, Sparkles 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type LimitGuardVariant = 'inline' | 'modal' | 'toast';
export type LimitStatus = 'ok' | 'warning' | 'blocked';

interface LimitGuardProps {
  resourceType: string;
  resourceLabel: string;
  currentUsage: number;
  limit: number;
  planTier: string;
  variant?: LimitGuardVariant;
  onUpgradeClick?: () => void;
  onLearnMoreClick?: () => void;
  onClose?: () => void;
  isOpen?: boolean;
  children?: React.ReactNode;
}

const getStatus = (usage: number, limit: number): LimitStatus => {
  if (limit === 0) return 'blocked';
  const percentage = (usage / limit) * 100;
  if (percentage >= 100) return 'blocked';
  if (percentage >= 80) return 'warning';
  return 'ok';
};

const getPercentage = (usage: number, limit: number): number => {
  if (limit === 0) return 100;
  return Math.min((usage / limit) * 100, 100);
};

const tierLabels: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const LimitGuard: React.FC<LimitGuardProps> = ({
  resourceType,
  resourceLabel,
  currentUsage,
  limit,
  planTier,
  variant = 'inline',
  onUpgradeClick,
  onLearnMoreClick,
  onClose,
  isOpen = true,
  children,
}) => {
  const navigate = useNavigate();
  const { currentRole } = useWorkspace();
  const { logLimitWarning, logLimitBlocked, logUpgradeIntent } = useBillingGovernanceEvents();

  const status = getStatus(currentUsage, limit);
  const percentage = getPercentage(currentUsage, limit);
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    if (status === 'warning') {
      logLimitWarning(resourceType, currentUsage, limit);
    } else if (status === 'blocked') {
      logLimitBlocked(resourceType, currentUsage, limit, `create_${resourceType}`);
    }
  }, [status, resourceType, currentUsage, limit]);

  const handleUpgrade = () => {
    logUpgradeIntent('pro', `limit_guard_${resourceType}`);
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      navigate('/settings?tab=billing');
    }
  };

  const handleLearnMore = () => {
    if (onLearnMoreClick) {
      onLearnMoreClick();
    } else {
      navigate('/settings?tab=billing');
    }
  };

  // Don't render anything if status is OK
  if (status === 'ok') {
    return <>{children}</>;
  }

  const content = (
    <div className="space-y-4">
      {/* Usage Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{resourceLabel}</span>
          <span className={cn(
            "font-medium",
            status === 'blocked' ? 'text-destructive' : 'text-amber-600'
          )}>
            {currentUsage} / {limit === 0 ? '0' : limit}
          </span>
        </div>
        <Progress 
          value={percentage} 
          className={cn(
            "h-2",
            status === 'blocked' ? '[&>div]:bg-destructive' : '[&>div]:bg-amber-500'
          )}
        />
      </div>

      {/* Message */}
      <p className="text-sm text-muted-foreground">
        {status === 'blocked' ? (
          <>
            <strong>Limite atingido:</strong> {currentUsage}/{limit} {resourceLabel.toLowerCase()}.
            <br />
            Para continuar, faça upgrade ou reduza o uso.
          </>
        ) : (
          <>
            Você está perto do limite de {resourceLabel.toLowerCase()} no plano {tierLabels[planTier] || planTier}.
          </>
        )}
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {isAdmin ? (
          <>
            <Button onClick={handleUpgrade} className="w-full gap-2">
              <Crown className="h-4 w-4" />
              Fazer upgrade
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleLearnMore} className="w-full gap-2">
              <Settings className="h-4 w-4" />
              {status === 'blocked' ? 'Gerenciar uso' : 'Ver alternativas'}
            </Button>
          </>
        ) : (
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para gerenciar plano.
              <br />
              Peça para um Admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className={cn(
        "rounded-lg border p-4",
        status === 'blocked' 
          ? 'border-destructive/50 bg-destructive/5' 
          : 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
      )}>
        <div className="flex items-start gap-3">
          {status === 'blocked' ? (
            <Lock className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h4 className={cn(
              "font-medium mb-2",
              status === 'blocked' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
            )}>
              {status === 'blocked' ? 'Limite atingido' : 'Perto do limite'}
            </h4>
            {content}
          </div>
        </div>
        {/* Render children but blocked */}
        {status === 'blocked' && children && (
          <div className="mt-4 opacity-50 pointer-events-none">
            {children}
          </div>
        )}
      </div>
    );
  }

  // Modal variant
  if (variant === 'modal') {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                {status === 'blocked' ? (
                  <div className="p-2 rounded-full bg-destructive/10">
                    <Lock className="h-5 w-5 text-destructive" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                )}
                <DialogTitle>
                  {status === 'blocked' ? 'Limite atingido' : 'Perto do limite'}
                </DialogTitle>
              </div>
              <DialogDescription>
                {status === 'blocked' 
                  ? `Você atingiu o limite de ${resourceLabel.toLowerCase()} no plano ${tierLabels[planTier] || planTier}.`
                  : `Você está usando ${percentage.toFixed(0)}% do limite de ${resourceLabel.toLowerCase()}.`
                }
              </DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
        {/* Always render children with modal - blocking is handled externally */}
        {children}
      </>
    );
  }

  // Toast variant - just return children, toast is handled elsewhere
  return <>{children}</>;
};

// Convenience hook for checking limits
export const useLimitCheck = (
  currentUsage: number,
  limit: number
): { status: LimitStatus; percentage: number; canCreate: boolean } => {
  const status = getStatus(currentUsage, limit);
  const percentage = getPercentage(currentUsage, limit);
  return {
    status,
    percentage,
    canCreate: status !== 'blocked',
  };
};

export default LimitGuard;
