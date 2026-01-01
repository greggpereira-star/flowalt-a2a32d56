import React from 'react';
import { useWorkspacePlan, useHasEntitlement, PlanTier } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Sparkles, Building2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanGateProps {
  featureKey?: string;
  requiredTier?: PlanTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const tierOrder: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };

const tierLabels: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const tierBenefits: Record<PlanTier, string[]> = {
  pro: [
    'Até 15 membros na equipe',
    'Até 30 espaços de trabalho',
    'API Keys e Webhooks',
    'Templates avançados',
    'Audit logs (30 dias)',
  ],
  enterprise: [
    'Membros ilimitados',
    'Espaços ilimitados',
    'Webhook replay e health',
    'Export de audit logs',
    'Suporte prioritário',
    'SSO (em breve)',
  ],
  free: [],
};

export const PaywallState: React.FC<{
  requiredTier: PlanTier;
  featureName?: string;
  isAdmin?: boolean;
  compact?: boolean;
}> = ({ requiredTier, featureName, isAdmin = false, compact = false }) => {
  const Icon = requiredTier === 'enterprise' ? Building2 : Sparkles;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {featureName || 'Este recurso'} requer plano {tierLabels[requiredTier]}
        </span>
        {isAdmin && (
          <Button variant="link" size="sm" className="ml-auto p-0 h-auto">
            Fazer upgrade <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">
          {featureName || 'Recurso'} disponível no plano {tierLabels[requiredTier]}
        </CardTitle>
        <CardDescription>
          Faça upgrade para desbloquear este e outros recursos avançados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {tierBenefits[requiredTier].map((benefit, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {isAdmin ? (
            <>
              <Button className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Fazer upgrade para {tierLabels[requiredTier]}
              </Button>
              <Button variant="outline" className="w-full">
                Comparar planos
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Peça ao administrador do workspace para fazer upgrade
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const PlanGate: React.FC<PlanGateProps> = ({
  featureKey,
  requiredTier,
  children,
  fallback,
}) => {
  const { data: plan, isLoading } = useWorkspacePlan();
  const { currentRole } = useWorkspace();
  const hasEntitlement = useHasEntitlement(featureKey || '');

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  if (isLoading) return null;

  // Check entitlement if featureKey is provided
  if (featureKey && !hasEntitlement) {
    return fallback || (
      <PaywallState
        requiredTier={requiredTier || 'pro'}
        featureName={featureKey.split('.')[0]}
        isAdmin={isAdmin}
      />
    );
  }

  // Check tier if requiredTier is provided
  if (requiredTier && plan) {
    const currentTierLevel = tierOrder[plan.plan_tier];
    const requiredTierLevel = tierOrder[requiredTier];

    if (currentTierLevel < requiredTierLevel) {
      return fallback || (
        <PaywallState
          requiredTier={requiredTier}
          isAdmin={isAdmin}
        />
      );
    }
  }

  return <>{children}</>;
};

// HOC for page-level gating
export const withPlanGate = (
  Component: React.ComponentType,
  options: { featureKey?: string; requiredTier?: PlanTier; featureName?: string }
) => {
  return function GatedComponent(props: any) {
    return (
      <PlanGate featureKey={options.featureKey} requiredTier={options.requiredTier}>
        <Component {...props} />
      </PlanGate>
    );
  };
};

export default PlanGate;
