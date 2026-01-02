import React, { useState } from 'react';
import { useWorkspacePlan, useWorkspaceUsage, useEntitlements, PlanTier } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBillingGovernanceEvents } from '@/hooks/useBillingGovernanceEvents';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Crown, Building2, Sparkles, ArrowRight, Check, X, 
  Users, FolderKanban, Key, Webhook, Database, TrendingUp,
  Unlock, Lock, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanConfig {
  tier: PlanTier;
  label: string;
  icon: React.ElementType;
  color: string;
  limits: {
    seats: number;
    spaces: number;
    api_keys: number;
    webhooks: number;
    storage_mb: number;
  };
  features: string[];
}

const planConfigs: PlanConfig[] = [
  {
    tier: 'free',
    label: 'Free',
    icon: Sparkles,
    color: 'bg-muted text-muted-foreground',
    limits: { seats: 3, spaces: 3, api_keys: 0, webhooks: 0, storage_mb: 500 },
    features: ['Audit logs (7 dias)', 'Relatórios básicos'],
  },
  {
    tier: 'pro',
    label: 'Pro',
    icon: Crown,
    color: 'bg-primary text-primary-foreground',
    limits: { seats: 15, spaces: 30, api_keys: 5, webhooks: 10, storage_mb: 5000 },
    features: ['API Keys e Webhooks', 'Templates avançados', 'Audit logs (30 dias)', 'Relatórios completos'],
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    icon: Building2,
    color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    limits: { seats: 999, spaces: 999, api_keys: 50, webhooks: 100, storage_mb: 50000 },
    features: ['Webhook replay', 'Export de audit', 'Suporte prioritário', 'SSO (em breve)', 'SLA customizado'],
  },
];

const tierOrder: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };

export const UpgradeImpactSimulator: React.FC = () => {
  const { data: plan } = useWorkspacePlan();
  const { data: usage } = useWorkspaceUsage();
  const { data: entitlements } = useEntitlements();
  const { currentRole } = useWorkspace();
  const { logUpgradeIntent } = useBillingGovernanceEvents();

  const currentTier = plan?.plan_tier || 'free';
  const [selectedTier, setSelectedTier] = useState<PlanTier>(
    currentTier === 'enterprise' ? 'enterprise' : currentTier === 'pro' ? 'enterprise' : 'pro'
  );

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const currentConfig = planConfigs.find(p => p.tier === currentTier)!;
  const selectedConfig = planConfigs.find(p => p.tier === selectedTier)!;

  const isUpgrade = tierOrder[selectedTier] > tierOrder[currentTier];
  const isDowngrade = tierOrder[selectedTier] < tierOrder[currentTier];
  const isSame = selectedTier === currentTier;

  // Calculate impact
  const calculateDelta = (current: number, target: number) => target - current;
  
  const seatsImpact = calculateDelta(currentConfig.limits.seats, selectedConfig.limits.seats);
  const spacesImpact = calculateDelta(currentConfig.limits.spaces, selectedConfig.limits.spaces);
  const apiKeysImpact = calculateDelta(currentConfig.limits.api_keys, selectedConfig.limits.api_keys);
  const webhooksImpact = calculateDelta(currentConfig.limits.webhooks, selectedConfig.limits.webhooks);

  // Check what's currently blocked
  const blockedResources: string[] = [];
  if ((usage?.api_keys_used || 0) >= (plan?.api_keys_limit || 0) && plan?.api_keys_limit === 0) {
    blockedResources.push('API Keys');
  }
  if ((usage?.webhooks_used || 0) >= (plan?.webhooks_limit || 0) && plan?.webhooks_limit === 0) {
    blockedResources.push('Webhooks');
  }

  // New features unlocked
  const newFeatures = selectedConfig.features.filter(
    f => !currentConfig.features.includes(f)
  );

  const handleUpgradeClick = () => {
    logUpgradeIntent(selectedTier, 'upgrade_simulator');
    // In a real app, this would open a checkout flow
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Simular Upgrade
        </CardTitle>
        <CardDescription>
          Veja o impacto de mudar de plano no seu workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Selector */}
        <div className="space-y-3">
          <Label>Selecione o plano desejado</Label>
          <RadioGroup
            value={selectedTier}
            onValueChange={(v) => setSelectedTier(v as PlanTier)}
            className="grid grid-cols-3 gap-3"
          >
            {planConfigs.map((config) => {
              const Icon = config.icon;
              const isCurrent = config.tier === currentTier;
              const isSelected = config.tier === selectedTier;

              return (
                <div key={config.tier}>
                  <RadioGroupItem
                    value={config.tier}
                    id={config.tier}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={config.tier}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50',
                      isCurrent && 'ring-2 ring-offset-2 ring-primary/30'
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium">{config.label}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs">Atual</Badge>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        <Separator />

        {/* Impact Summary */}
        {isSame ? (
          <div className="text-center p-6 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">
              Este é seu plano atual. Selecione outro para ver o impacto.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              {isUpgrade ? (
                <>
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Impacto do upgrade para {selectedConfig.label}
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Impacto do downgrade para {selectedConfig.label}
                </>
              )}
            </h4>

            {/* Limits Changes */}
            <div className="grid grid-cols-2 gap-3">
              <ImpactItem
                icon={Users}
                label="Membros"
                current={currentConfig.limits.seats}
                target={selectedConfig.limits.seats}
                used={usage?.seats_used || 0}
              />
              <ImpactItem
                icon={FolderKanban}
                label="Espaços"
                current={currentConfig.limits.spaces}
                target={selectedConfig.limits.spaces}
                used={usage?.spaces_used || 0}
              />
              <ImpactItem
                icon={Key}
                label="API Keys"
                current={currentConfig.limits.api_keys}
                target={selectedConfig.limits.api_keys}
                used={usage?.api_keys_used || 0}
              />
              <ImpactItem
                icon={Webhook}
                label="Webhooks"
                current={currentConfig.limits.webhooks}
                target={selectedConfig.limits.webhooks}
                used={usage?.webhooks_used || 0}
              />
            </div>

            {/* New Features */}
            {isUpgrade && newFeatures.length > 0 && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h5 className="font-medium flex items-center gap-2 mb-3">
                  <Unlock className="h-4 w-4 text-primary" />
                  Recursos desbloqueados
                </h5>
                <ul className="space-y-2">
                  {newFeatures.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Currently Blocked Resources */}
            {blockedResources.length > 0 && isUpgrade && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/50">
                <h5 className="font-medium flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-300">
                  <Lock className="h-4 w-4" />
                  Você está bloqueado em:
                </h5>
                <div className="flex gap-2">
                  {blockedResources.map((resource) => (
                    <Badge key={resource} variant="outline" className="border-amber-300">
                      {resource}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Com o upgrade, você poderá criar esses recursos.
                </p>
              </div>
            )}

            {/* Downgrade Warning */}
            {isDowngrade && (
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
                <h5 className="font-medium flex items-center gap-2 mb-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Atenção ao fazer downgrade
                </h5>
                <p className="text-sm text-muted-foreground">
                  Se você tiver recursos acima do limite do novo plano, você não poderá criar novos
                  até reduzir o uso. Recursos existentes continuarão funcionando.
                </p>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {!isSame && isAdmin && (
          <div className="flex gap-2 pt-4">
            <Button 
              className="flex-1 gap-2"
              onClick={handleUpgradeClick}
            >
              {isUpgrade ? (
                <>
                  <Crown className="h-4 w-4" />
                  Fazer upgrade para {selectedConfig.label}
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  Confirmar downgrade
                </>
              )}
            </Button>
          </div>
        )}

        {!isAdmin && !isSame && (
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Apenas Admin/Owner pode alterar o plano.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ImpactItemProps {
  icon: React.ElementType;
  label: string;
  current: number;
  target: number;
  used: number;
}

const ImpactItem: React.FC<ImpactItemProps> = ({
  icon: Icon,
  label,
  current,
  target,
  used,
}) => {
  const delta = target - current;
  const isIncrease = delta > 0;
  const willBeOverLimit = used > target && delta < 0;

  const formatLimit = (n: number) => n >= 999 ? '∞' : n.toString();

  return (
    <div className={cn(
      "p-3 rounded-lg border",
      willBeOverLimit ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/30'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{formatLimit(current)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className={cn(
          "font-medium",
          isIncrease ? 'text-primary' : delta < 0 ? 'text-destructive' : ''
        )}>
          {formatLimit(target)}
        </span>
        {delta !== 0 && (
          <Badge variant={isIncrease ? 'default' : 'destructive'} className="text-xs">
            {delta > 0 ? '+' : ''}{formatLimit(delta)}
          </Badge>
        )}
      </div>
      {willBeOverLimit && (
        <p className="text-xs text-destructive mt-1">
          Uso atual: {used} (acima do novo limite)
        </p>
      )}
    </div>
  );
};

export default UpgradeImpactSimulator;
