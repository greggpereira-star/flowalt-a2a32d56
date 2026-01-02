import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspacePlan, useEntitlements, useWorkspaceUsage, PlanTier } from '@/hooks/useWorkspacePlan';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Sparkles, Building2, Crown, Users, FolderKanban, Database, 
  Key, Webhook, Check, X, AlertCircle, CreditCard, ExternalLink,
  Shield, Clock, Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UpgradeImpactSimulator } from './UpgradeImpactSimulator';
import { ManageUsageModal } from './ManageUsageModal';

const tierConfig: Record<PlanTier, { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  description: string;
}> = {
  free: { 
    icon: Sparkles, 
    label: 'Free', 
    color: 'bg-muted text-muted-foreground',
    description: 'Para pequenas equipes começando'
  },
  pro: { 
    icon: Crown, 
    label: 'Pro', 
    color: 'bg-primary text-primary-foreground',
    description: 'Para equipes em crescimento'
  },
  enterprise: { 
    icon: Building2, 
    label: 'Enterprise', 
    color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
    description: 'Para grandes organizações'
  },
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  trialing: { label: 'Trial', variant: 'secondary' },
  past_due: { label: 'Pagamento Pendente', variant: 'destructive' },
  canceled: { label: 'Cancelado', variant: 'outline' },
};

const planFeatures: Record<PlanTier, string[]> = {
  free: [
    'Até 3 membros',
    'Até 3 espaços',
    'Audit logs (7 dias)',
    'Relatórios básicos',
  ],
  pro: [
    'Até 15 membros',
    'Até 30 espaços',
    'API Keys e Webhooks',
    'Templates avançados',
    'Audit logs (30 dias)',
    'Relatórios completos',
  ],
  enterprise: [
    'Membros ilimitados',
    'Espaços ilimitados',
    'Webhook replay e health',
    'Export de audit logs',
    'Suporte prioritário',
    'SSO (em breve)',
    'SLA customizado',
  ],
};

interface UsageItemProps {
  label: string;
  used: number;
  limit: number;
  icon: React.ElementType;
}

const UsageItem: React.FC<UsageItemProps> = ({ label, used, limit, icon: Icon }) => {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={`text-sm ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
          {used} / {limit === 999 ? '∞' : limit}
        </span>
      </div>
      <Progress 
        value={Math.min(percentage, 100)} 
        className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
      />
    </div>
  );
};

export const BillingPlanPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace, currentRole } = useWorkspace();
  const { isAdmin } = usePermissions();
  const { data: plan, isLoading: loadingPlan } = useWorkspacePlan();
  const { data: entitlements, isLoading: loadingEntitlements } = useEntitlements();
  const { data: usage, isLoading: loadingUsage } = useWorkspaceUsage();
  const [showManageUsage, setShowManageUsage] = useState(false);

  const isOwner = currentRole === 'owner';
  const canManageBilling = isOwner || isAdmin;

  const upgradePlan = useMutation({
    mutationFn: async (tier: PlanTier) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');
      const { error } = await supabase.rpc('upgrade_workspace_plan', {
        p_workspace_id: currentWorkspace.id,
        p_new_tier: tier,
        p_provider: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Plano atualizado com sucesso');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace-plan', currentWorkspace?.id] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-entitlements', currentWorkspace?.id] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-usage', currentWorkspace?.id] }),
      ]);
    },
    onError: (error: any) => {
      toast.error(error?.message ? `Erro ao atualizar plano: ${error.message}` : 'Erro ao atualizar plano');
    },
  });

  if (loadingPlan || loadingEntitlements) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />
      </div>
    );
  }

  const currentTier = plan?.plan_tier || 'free';
  const TierIcon = tierConfig[currentTier].icon;
  const status = plan?.status || 'active';

  // Get entitlement values
  const getEntitlement = (key: string) => {
    const ent = entitlements?.find(e => e.key === key);
    return ent?.value;
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${tierConfig[currentTier].color}`}>
                <TierIcon className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Plano {tierConfig[currentTier].label}</CardTitle>
                <CardDescription>{tierConfig[currentTier].description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusLabels[status].variant}>
                {statusLabels[status].label}
              </Badge>
              {plan?.provider === 'stripe' && (
                <Badge variant="outline" className="gap-1">
                  <CreditCard className="h-3 w-3" />
                  Stripe
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period Info */}
          {plan && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  Período: {format(new Date(plan.current_period_start), 'dd/MM/yyyy', { locale: ptBR })} - {format(new Date(plan.current_period_end), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
              {plan.trial_ends_at && new Date(plan.trial_ends_at) > new Date() && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  Trial até {format(new Date(plan.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })}
                </Badge>
              )}
            </div>
          )}

          {/* Features List */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {planFeatures[currentTier].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Upgrade Buttons */}
          {canManageBilling && currentTier !== 'enterprise' && (
            <div className="flex gap-2 pt-4">
              {currentTier === 'free' && (
                <Button
                  className="gap-2"
                  onClick={() => upgradePlan.mutate('pro')}
                  disabled={upgradePlan.isPending}
                >
                  {upgradePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                  Fazer upgrade para Pro
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (currentTier === 'free') {
                    toast.message('Upgrade para Enterprise', {
                      description: 'Entre em contato com vendas para ativar o plano Enterprise.',
                    });
                    return;
                  }
                  upgradePlan.mutate('enterprise');
                }}
                disabled={upgradePlan.isPending}
              >
                {upgradePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {currentTier === 'free' ? 'Falar com vendas' : 'Upgrade para Enterprise'}
              </Button>
            </div>
          )}

          {/* Manage Subscription */}
          {canManageBilling && plan?.provider === 'stripe' && (
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Gerenciar Assinatura
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Usage & Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Uso e Limites
              </CardTitle>
              <CardDescription>
                Consumo atual do workspace em relação aos limites do plano
              </CardDescription>
            </div>
            {canManageBilling && (
              <Button variant="outline" size="sm" onClick={() => setShowManageUsage(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Gerenciar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <UsageItem 
            label="Membros" 
            used={usage?.seats_used || 0} 
            limit={plan?.seats_limit || 3}
            icon={Users}
          />
          <UsageItem 
            label="Espaços" 
            used={usage?.spaces_used || 0} 
            limit={plan?.spaces_limit || 3}
            icon={FolderKanban}
          />
          <UsageItem 
            label="API Keys" 
            used={usage?.api_keys_used || 0} 
            limit={plan?.api_keys_limit || 0}
            icon={Key}
          />
          <UsageItem 
            label="Webhooks" 
            used={usage?.webhooks_used || 0} 
            limit={plan?.webhooks_limit || 0}
            icon={Webhook}
          />
          <UsageItem 
            label="Armazenamento (MB)" 
            used={usage?.storage_mb_used || 0} 
            limit={plan?.storage_mb_limit || 500}
            icon={Database}
          />
        </CardContent>
      </Card>

      {/* Entitlements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recursos Habilitados
          </CardTitle>
          <CardDescription>
            Features disponíveis no seu plano atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-3">
              {entitlements?.map((ent) => {
                const isEnabled = ent.value?.enabled === true;
                const value = ent.value?.value;
                const tier = ent.value?.tier;

                return (
                  <div key={ent.key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      {isEnabled ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">{ent.key.replace(/\./g, ' → ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {value !== undefined && (
                        <Badge variant="outline">{value}</Badge>
                      )}
                      {tier && (
                        <Badge variant="secondary">{tier}</Badge>
                      )}
                      {isEnabled === true && !value && !tier && (
                        <Badge variant="default">Ativo</Badge>
                      )}
                      {isEnabled === false && (
                        <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Upgrade Simulator */}
      <UpgradeImpactSimulator />

      {/* Warning for non-admin */}
      {!canManageBilling && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Somente o Owner ou Admin pode gerenciar o plano e billing do workspace.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manage Usage Modal */}
      <ManageUsageModal open={showManageUsage} onOpenChange={setShowManageUsage} />
    </div>
  );
};

export default BillingPlanPage;
