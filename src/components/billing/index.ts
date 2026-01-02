// Billing Components - GOX Enterprise
export { LimitGuard, useLimitCheck } from './LimitGuard';
export { OverLimitBanner } from './OverLimitBanner';
export { ManageUsageModal } from './ManageUsageModal';
export { UpgradeImpactSimulator } from './UpgradeImpactSimulator';
export { PlanGate, PaywallState, withPlanGate } from './PlanGate';
export { IntegrationsPaywall } from './IntegrationsPaywall';
export { BillingPlanPage } from './BillingPlanPage';
export { EntitlementGate, withEntitlementGate } from './EntitlementGate';

// Hooks
export { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
export type { 
  EffectiveEntitlement, 
  EntitlementExplanation, 
  ReasonCode, 
  EntitlementType, 
  UIVisibility 
} from '@/hooks/useEntitlementRegistry';