import React from 'react';
import { useEntitlementRegistry, ReasonCode } from '@/hooks/useEntitlementRegistry';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, Crown, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EntitlementGateMode = 'hide' | 'disable' | 'paywall';

interface EntitlementGateProps {
  entitlementKey: string;
  mode?: EntitlementGateMode;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const EntitlementGate: React.FC<EntitlementGateProps> = ({
  entitlementKey,
  mode = 'paywall',
  fallback,
  children,
  className,
}) => {
  const { has, within, explain, isLoading } = useEntitlementRegistry();
  const { currentRole } = useWorkspace();
  const navigate = useNavigate();

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const explanation = explain(entitlementKey);
  const hasAccess = has(entitlementKey);
  const isWithinLimit = within(entitlementKey);

  // Loading state - show children optimistically
  if (isLoading) {
    return <>{children}</>;
  }

  // Has access and within limit - render children
  if (hasAccess && isWithinLimit) {
    return <>{children}</>;
  }

  // Handle based on mode
  switch (mode) {
    case 'hide':
      return fallback ? <>{fallback}</> : null;

    case 'disable':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn('opacity-50 cursor-not-allowed', className)}>
                <div className="pointer-events-none">
                  {children}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>{explanation.message}</span>
              </div>
              {explanation.cta && (
                <p className="text-xs text-muted-foreground mt-1">{explanation.cta}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'paywall':
    default:
      if (fallback) {
        return <>{fallback}</>;
      }

      return (
        <Card className={cn('border-dashed', className)}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              {explanation.reason_code === 'PLAN_LIMIT' ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <Crown className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="text-lg">{explanation.message}</CardTitle>
            <CardDescription>
              {explanation.reason_code === 'PLAN_LIMIT' && explanation.limit !== undefined && (
                <span>
                  Você atingiu o limite de {explanation.current}/{explanation.limit}
                </span>
              )}
              {explanation.reason_code === 'DISABLED' && (
                <span>Este recurso está disponível em planos superiores</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {isAdmin ? (
              <Button 
                onClick={() => navigate('/settings?tab=billing')}
                className="gap-2"
              >
                <Crown className="h-4 w-4" />
                Fazer upgrade
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Fale com o administrador do workspace para fazer upgrade.
              </p>
            )}
          </CardContent>
        </Card>
      );
  }
};

// HOC for wrapping components
export function withEntitlementGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  entitlementKey: string,
  mode: EntitlementGateMode = 'paywall'
) {
  return function WithEntitlementGate(props: P) {
    return (
      <EntitlementGate entitlementKey={entitlementKey} mode={mode}>
        <WrappedComponent {...props} />
      </EntitlementGate>
    );
  };
}

export default EntitlementGate;
