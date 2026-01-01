import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export type PlanTier = 'free' | 'pro' | 'enterprise';
export type PlanStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export interface WorkspacePlan {
  id: string;
  workspace_id: string;
  plan_tier: PlanTier;
  status: PlanStatus;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  provider: 'manual' | 'stripe';
  seats_limit: number;
  spaces_limit: number;
  storage_mb_limit: number;
  webhooks_limit: number;
  api_keys_limit: number;
}

export interface Entitlement {
  key: string;
  value: {
    enabled?: boolean;
    value?: number;
    tier?: string;
  };
}

export interface WorkspaceUsage {
  seats_used: number;
  spaces_used: number;
  storage_mb_used: number;
  api_keys_used: number;
  webhooks_used: number;
}

export const useWorkspacePlan = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace-plan', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('workspace_plans')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .maybeSingle();

      if (error) throw error;
      return data as WorkspacePlan | null;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useEntitlements = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace-entitlements', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('workspace_entitlements')
        .select('key, value')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return data as Entitlement[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useHasEntitlement = (key: string): boolean => {
  const { data: entitlements } = useEntitlements();
  const entitlement = entitlements?.find(e => e.key === key);
  return entitlement?.value?.enabled === true;
};

export const useWorkspaceUsage = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workspace-usage', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('workspace_usage')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as WorkspaceUsage | null;
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useWithinLimit = (metric: 'seats' | 'spaces' | 'api_keys' | 'webhooks') => {
  const { data: plan } = useWorkspacePlan();
  const { data: usage } = useWorkspaceUsage();

  if (!plan || !usage) return true;

  const limitMap = {
    seats: { limit: plan.seats_limit, used: usage.seats_used },
    spaces: { limit: plan.spaces_limit, used: usage.spaces_used },
    api_keys: { limit: plan.api_keys_limit, used: usage.api_keys_used },
    webhooks: { limit: plan.webhooks_limit, used: usage.webhooks_used },
  };

  const { limit, used } = limitMap[metric];
  return used < limit;
};
