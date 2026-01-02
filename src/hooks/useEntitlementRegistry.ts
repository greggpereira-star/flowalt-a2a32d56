import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspacePlan, useWorkspaceUsage } from './useWorkspacePlan';

export type EntitlementType = 'boolean' | 'limit' | 'tiered_limit';
export type UIVisibility = 'hidden' | 'disabled' | 'paywall' | 'visible';
export type ReasonCode = 'OK' | 'DISABLED' | 'PLAN_LIMIT' | 'NO_PLAN' | 'ENTITLEMENT_NOT_FOUND' | 'OVERRIDE_ACTIVE';

export interface EffectiveEntitlement {
  workspace_id: string;
  entitlement_key: string;
  name: string;
  description: string | null;
  category: string;
  type: EntitlementType;
  unit: string | null;
  enforcement_scope: string;
  ui_visibility: UIVisibility;
  plan_key: string;
  enabled: boolean;
  limit_value: number | null;
  source: 'plan' | 'override' | 'default';
  override_expires_at: string | null;
  override_reason: string | null;
}

export interface EntitlementExplanation {
  enabled: boolean;
  reason_code: ReasonCode;
  message: string;
  cta?: string;
  limit?: number | null;
  current?: number;
  remaining?: number;
}

const USAGE_MAP: Record<string, keyof ReturnType<typeof useWorkspaceUsage>['data'] & string> = {
  members_limit: 'seats_used',
  spaces_limit: 'spaces_used',
  api_keys_limit: 'api_keys_used',
  webhooks_limit: 'webhooks_used',
  storage_limit: 'storage_mb_used',
};

const REASON_MESSAGES: Record<ReasonCode, string> = {
  OK: 'Recurso disponível',
  DISABLED: 'Recurso indisponível no seu plano',
  PLAN_LIMIT: 'Limite do plano atingido',
  NO_PLAN: 'Nenhum plano ativo',
  ENTITLEMENT_NOT_FOUND: 'Recurso não encontrado',
  OVERRIDE_ACTIVE: 'Acesso temporário ativo',
};

export const useEntitlementRegistry = () => {
  const { currentWorkspace } = useWorkspace();
  const { data: plan } = useWorkspacePlan();
  const { data: usage } = useWorkspaceUsage();

  const { data: entitlements, isLoading, error } = useQuery({
    queryKey: ['entitlement-registry', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('workspace_entitlements_effective')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return (data || []) as EffectiveEntitlement[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const getEntitlement = (key: string): EffectiveEntitlement | undefined => {
    return entitlements?.find(e => e.entitlement_key === key);
  };

  const has = (key: string): boolean => {
    const entitlement = getEntitlement(key);
    return entitlement?.enabled ?? false;
  };

  const limit = (key: string): number | null => {
    const entitlement = getEntitlement(key);
    return entitlement?.limit_value ?? null;
  };

  const current = (key: string): number => {
    const usageKey = USAGE_MAP[key];
    if (!usageKey || !usage) return 0;
    return (usage as any)[usageKey] ?? 0;
  };

  const remaining = (key: string): number | null => {
    const lim = limit(key);
    if (lim === null) return null;
    return Math.max(0, lim - current(key));
  };

  const within = (key: string): boolean => {
    if (!has(key)) return false;
    const lim = limit(key);
    if (lim === null) return true;
    return current(key) < lim;
  };

  const explain = (key: string): EntitlementExplanation => {
    const entitlement = getEntitlement(key);
    const curr = current(key);
    const lim = limit(key);
    const rem = remaining(key);

    if (!entitlement) {
      return {
        enabled: false,
        reason_code: 'ENTITLEMENT_NOT_FOUND',
        message: REASON_MESSAGES.ENTITLEMENT_NOT_FOUND,
      };
    }

    if (!entitlement.enabled) {
      return {
        enabled: false,
        reason_code: 'DISABLED',
        message: REASON_MESSAGES.DISABLED,
        cta: 'Faça upgrade para acessar este recurso',
      };
    }

    if (lim !== null && curr >= lim) {
      return {
        enabled: true,
        reason_code: 'PLAN_LIMIT',
        message: REASON_MESSAGES.PLAN_LIMIT,
        cta: 'Faça upgrade para aumentar o limite',
        limit: lim,
        current: curr,
        remaining: 0,
      };
    }

    return {
      enabled: true,
      reason_code: 'OK',
      message: REASON_MESSAGES.OK,
      limit: lim,
      current: curr,
      remaining: rem ?? undefined,
    };
  };

  return {
    entitlements,
    isLoading,
    error,
    plan,
    usage,
    // Helpers
    has,
    limit,
    current,
    remaining,
    within,
    explain,
    getEntitlement,
  };
};

export default useEntitlementRegistry;
