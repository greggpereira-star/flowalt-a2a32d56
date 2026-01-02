import React, { useEffect } from 'react';
import { useWorkspacePlan, useHasEntitlement, PlanTier } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBillingGovernanceEvents } from '@/hooks/useBillingGovernanceEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Sparkles, Building2, ArrowRight, Crown, Copy, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PlanGateProps {
  featureKey?: string;
  requiredTier?: PlanTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  blockReason?: string;
  showUpgradePath?: boolean;
  featureName?: string;
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

const freeAlternatives = [
  'Até 3 membros no workspace',
  'Até 3 espaços de trabalho',
  'Relatórios básicos',
  'Audit logs por 7 dias',
];

export const PaywallState: React.FC<{
  requiredTier: PlanTier;
  featureName?: string;
  blockReason?: string;
  isAdmin?: boolean;
  compact?: boolean;
  showUpgradePath?: boolean;
}> = ({ requiredTier, featureName, blockReason, isAdmin = false, compact = false, showUpgradePath = true }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logPaywallViewed, logUpgradeIntent, logRequestUpgradeSent } = useBillingGovernanceEvents();
  const Icon = requiredTier === 'enterprise' ? Building2 : Crown;

  useEffect(() => {
    logPaywallViewed(featureName || 'unknown', requiredTier);
  }, [featureName, requiredTier]);

  const handleUpgrade = () => {
    logUpgradeIntent(requiredTier, `paywall_${featureName}`);
    navigate('/settings?tab=billing');
  };

  const handleCopyMessage = () => {
    const message = `Olá! Preciso de acesso a ${featureName || 'recursos avançados'} no workspace. Poderia fazer upgrade do plano para ${tierLabels[requiredTier]}?`;
    navigator.clipboard.writeText(message);
    toast({
      title: 'Mensagem copiada',
      description: 'Cole no Slack/WhatsApp para enviar ao Admin.',
    });
  };

  const handleRequestAccess = () => {
    logRequestUpgradeSent();
    toast({
      title: 'Solicitação enviada',
      description: 'O administrador será notificado.',
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {featureName || 'Este recurso'} requer plano {tierLabels[requiredTier]}
        </span>
        {isAdmin && (
          <Button variant="link" size="sm" className="ml-auto p-0 h-auto" onClick={handleUpgrade}>
            Fazer upgrade <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-dashed max-w-lg mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-xl">
          {featureName || 'Recurso'} disponível no plano {tierLabels[requiredTier]}
        </CardTitle>
        <CardDescription>
          {blockReason || 'Faça upgrade para desbloquear este e outros recursos avançados'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Benefits of upgrade */}
        {showUpgradePath && (
          <div className="space-y-2">
            <p className="text-sm font-medium">O que você ganha:</p>
            <ul className="space-y-1.5">
              {tierBenefits[requiredTier].slice(0, 4).map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Free alternatives */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">O que você pode fazer no Free:</p>
          <ul className="space-y-1">
            {freeAlternatives.map((alt, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                • {alt}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions - 3 paths */}
        <div className="space-y-3 pt-2">
          {isAdmin ? (
            <>
              {/* Path 1: Upgrade */}
              <Button className="w-full gap-2" onClick={handleUpgrade}>
                <Crown className="h-4 w-4" />
                Fazer upgrade para {tierLabels[requiredTier]}
                <ArrowRight className="h-4 w-4" />
              </Button>
              
              {/* Path 2: Enterprise contact */}
              {requiredTier !== 'enterprise' && (
                <Button variant="outline" className="w-full gap-2" onClick={() => navigate('/settings?tab=billing')}>
                  <Building2 className="h-4 w-4" />
                  Falar com vendas (Enterprise)
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Path 3: Request access (non-admin) */}
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                  Você não tem permissão para gerenciar plano.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleCopyMessage}>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar mensagem
                  </Button>
                  <Button size="sm" className="flex-1 gap-1.5" onClick={handleRequestAccess}>
                    <Mail className="h-3.5 w-3.5" />
                    Solicitar acesso
                  </Button>
                </div>
              </div>
            </>
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
  blockReason,
  showUpgradePath = true,
  featureName,
}) => {
  const { data: plan, isLoading } = useWorkspacePlan();
  const { currentRole } = useWorkspace();
  const hasEntitlement = useHasEntitlement(featureKey || '');
  const { logEntitlementEnforced } = useBillingGovernanceEvents();

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  if (isLoading) return null;

  // Check entitlement if featureKey is provided
  if (featureKey && !hasEntitlement) {
    logEntitlementEnforced(featureKey, 'view_feature');
    
    return fallback || (
      <PaywallState
        requiredTier={requiredTier || 'pro'}
        featureName={featureName || featureKey.split('.')[0]}
        blockReason={blockReason}
        isAdmin={isAdmin}
        showUpgradePath={showUpgradePath}
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
          featureName={featureName}
          blockReason={blockReason}
          isAdmin={isAdmin}
          showUpgradePath={showUpgradePath}
        />
      );
    }
  }

  return <>{children}</>;
};

// HOC for page-level gating
export const withPlanGate = (
  Component: React.ComponentType,
  options: { 
    featureKey?: string; 
    requiredTier?: PlanTier; 
    featureName?: string;
    blockReason?: string;
  }
) => {
  return function GatedComponent(props: any) {
    return (
      <PlanGate 
        featureKey={options.featureKey} 
        requiredTier={options.requiredTier}
        featureName={options.featureName}
        blockReason={options.blockReason}
      >
        <Component {...props} />
      </PlanGate>
    );
  };
};

export default PlanGate;
