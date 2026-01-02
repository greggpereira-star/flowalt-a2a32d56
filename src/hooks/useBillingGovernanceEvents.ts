import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export type BillingEventType =
  | 'billing.paywall.viewed'
  | 'billing.limit.warning_shown'
  | 'billing.limit.blocked_action'
  | 'billing.upgrade.intent_clicked'
  | 'billing.plan_changed'
  | 'billing.entitlement_enforced'
  | 'billing.request_upgrade_sent';

interface BillingEventMetadata {
  resource_type?: string;
  current_usage?: number;
  limit?: number;
  plan_tier?: string;
  target_tier?: string;
  action_attempted?: string;
  entitlement_key?: string;
  block_reason?: string;
  [key: string]: unknown;
}

export const useBillingGovernanceEvents = () => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const logEvent = useCallback(async (
    eventType: BillingEventType,
    metadata: BillingEventMetadata = {}
  ) => {
    if (!currentWorkspace?.id) return;

    try {
      await supabase.from('audit_logs').insert({
        workspace_id: currentWorkspace.id,
        user_id: user?.id || null,
        action: eventType,
        entity_type: 'billing',
        entity_id: currentWorkspace.id,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to log billing event:', error);
    }
  }, [currentWorkspace?.id, user?.id]);

  const logPaywallViewed = useCallback((resourceType: string, planTier: string) => {
    return logEvent('billing.paywall.viewed', { resource_type: resourceType, plan_tier: planTier });
  }, [logEvent]);

  const logLimitWarning = useCallback((resourceType: string, currentUsage: number, limit: number) => {
    return logEvent('billing.limit.warning_shown', { resource_type: resourceType, current_usage: currentUsage, limit });
  }, [logEvent]);

  const logLimitBlocked = useCallback((resourceType: string, currentUsage: number, limit: number, actionAttempted: string) => {
    return logEvent('billing.limit.blocked_action', { 
      resource_type: resourceType, 
      current_usage: currentUsage, 
      limit, 
      action_attempted: actionAttempted 
    });
  }, [logEvent]);

  const logUpgradeIntent = useCallback((targetTier: string, source: string) => {
    return logEvent('billing.upgrade.intent_clicked', { target_tier: targetTier, source });
  }, [logEvent]);

  const logPlanChanged = useCallback((oldTier: string, newTier: string) => {
    return logEvent('billing.plan_changed', { plan_tier: oldTier, target_tier: newTier });
  }, [logEvent]);

  const logEntitlementEnforced = useCallback((entitlementKey: string, actionAttempted: string) => {
    return logEvent('billing.entitlement_enforced', { entitlement_key: entitlementKey, action_attempted: actionAttempted });
  }, [logEvent]);

  const logRequestUpgradeSent = useCallback((targetUserId?: string) => {
    return logEvent('billing.request_upgrade_sent', { target_user_id: targetUserId });
  }, [logEvent]);

  return {
    logEvent,
    logPaywallViewed,
    logLimitWarning,
    logLimitBlocked,
    logUpgradeIntent,
    logPlanChanged,
    logEntitlementEnforced,
    logRequestUpgradeSent,
  };
};
