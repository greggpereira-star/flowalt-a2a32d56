/**
 * Platform State Machine
 * Enterprise-grade state computation for social media connections
 * 
 * States are computed based on:
 * - Provider readiness (configured by Super Admin)
 * - User entitlements (plan-based)
 * - Platform limits
 * - Connection status
 * - Token expiration
 * - Asset selection
 */

import type { ConnectedPlatform } from '@/hooks/useSocialPlatforms';
import { type GoxErrorCode, getGoxMessage, type GoxMessage } from './gox-messages';

/**
 * Canonical platform states - explicit state machine
 */
export type PlatformState =
  | 'PROVIDER_NOT_CONFIGURED'  // Provider OAuth not ready (Super Admin)
  | 'PLAN_REQUIRED'            // Entitlement off
  | 'LIMIT_REACHED'            // social_platforms_limit exceeded
  | 'DISCONNECTED'             // No connection exists
  | 'CONNECTING'               // OAuth in progress
  | 'ASSET_REQUIRED'           // Tokens OK, needs asset selection
  | 'CONNECTED'                // Fully operational
  | 'EXPIRING'                 // Token expiring soon
  | 'EXPIRED'                  // Token expired
  | 'ERROR';                   // API error

/**
 * State configuration for UI rendering
 */
export interface PlatformStateConfig {
  state: PlatformState;
  goxCode: GoxErrorCode;
  badgeVariant: 'default' | 'success' | 'warning' | 'error' | 'outline';
  badgeText: string;
  primaryCta: {
    label: string;
    action: 'connect' | 'select_asset' | 'test' | 'refresh' | 'reconnect' | 'upgrade' | 'none';
  };
  secondaryCtas: Array<{
    label: string;
    action: 'test' | 'disconnect' | 'refresh' | 'reconnect' | 'settings';
  }>;
  showLastSync: boolean;
  showAccountName: boolean;
}

/**
 * State definitions with UI configuration
 */
const STATE_CONFIGS: Record<PlatformState, Omit<PlatformStateConfig, 'state'>> = {
  PROVIDER_NOT_CONFIGURED: {
    goxCode: 'PROVIDER_NOT_CONFIGURED',
    badgeVariant: 'outline',
    badgeText: 'Em configuração',
    primaryCta: { label: 'Indisponível', action: 'none' },
    secondaryCtas: [],
    showLastSync: false,
    showAccountName: false,
  },
  PLAN_REQUIRED: {
    goxCode: 'PLAN_REQUIRED',
    badgeVariant: 'warning',
    badgeText: 'Premium',
    primaryCta: { label: 'Ver planos', action: 'upgrade' },
    secondaryCtas: [],
    showLastSync: false,
    showAccountName: false,
  },
  LIMIT_REACHED: {
    goxCode: 'LIMIT_REACHED',
    badgeVariant: 'warning',
    badgeText: 'Limite atingido',
    primaryCta: { label: 'Fazer upgrade', action: 'upgrade' },
    secondaryCtas: [],
    showLastSync: false,
    showAccountName: false,
  },
  DISCONNECTED: {
    goxCode: 'CONNECTION_FAILED',
    badgeVariant: 'outline',
    badgeText: 'Desconectado',
    primaryCta: { label: 'Conectar', action: 'connect' },
    secondaryCtas: [],
    showLastSync: false,
    showAccountName: false,
  },
  CONNECTING: {
    goxCode: 'INTEGRATION_IN_PROGRESS',
    badgeVariant: 'default',
    badgeText: 'Conectando...',
    primaryCta: { label: 'Conectando...', action: 'none' },
    secondaryCtas: [],
    showLastSync: false,
    showAccountName: false,
  },
  ASSET_REQUIRED: {
    goxCode: 'ASSET_REQUIRED',
    badgeVariant: 'warning',
    badgeText: 'Selecionar ativo',
    primaryCta: { label: 'Selecionar ativo', action: 'select_asset' },
    secondaryCtas: [{ label: 'Desconectar', action: 'disconnect' }],
    showLastSync: false,
    showAccountName: false,
  },
  CONNECTED: {
    goxCode: 'API_ERROR', // Not really used
    badgeVariant: 'success',
    badgeText: 'Conectado',
    primaryCta: { label: 'Testar conexão', action: 'test' },
    secondaryCtas: [
      { label: 'Atualizar token', action: 'refresh' },
      { label: 'Desconectar', action: 'disconnect' },
    ],
    showLastSync: true,
    showAccountName: true,
  },
  EXPIRING: {
    goxCode: 'TOKEN_EXPIRING_SOON',
    badgeVariant: 'warning',
    badgeText: 'Token expirando',
    primaryCta: { label: 'Renovar token', action: 'refresh' },
    secondaryCtas: [
      { label: 'Testar conexão', action: 'test' },
      { label: 'Desconectar', action: 'disconnect' },
    ],
    showLastSync: true,
    showAccountName: true,
  },
  EXPIRED: {
    goxCode: 'TOKEN_EXPIRED',
    badgeVariant: 'error',
    badgeText: 'Token expirado',
    primaryCta: { label: 'Reconectar', action: 'reconnect' },
    secondaryCtas: [
      { label: 'Renovar token', action: 'refresh' },
      { label: 'Desconectar', action: 'disconnect' },
    ],
    showLastSync: true,
    showAccountName: true,
  },
  ERROR: {
    goxCode: 'API_ERROR',
    badgeVariant: 'error',
    badgeText: 'Erro',
    primaryCta: { label: 'Reconectar', action: 'reconnect' },
    secondaryCtas: [
      { label: 'Testar conexão', action: 'test' },
      { label: 'Desconectar', action: 'disconnect' },
    ],
    showLastSync: true,
    showAccountName: true,
  },
};

/**
 * Provider readiness status from social-provider-status edge function
 */
export interface ProviderReadiness {
  status: 'ready' | 'partial' | 'not_configured';
  missingSecrets?: string[];
}

/**
 * Context for computing platform state
 */
export interface PlatformContext {
  /** Provider OAuth readiness (from edge function) */
  providerReadiness?: ProviderReadiness;
  /** Whether social_publish entitlement is enabled */
  hasSocialPublish: boolean;
  /** Platform limit from entitlements */
  platformsLimit: number | null;
  /** Current active platform count */
  currentPlatformCount: number;
  /** Existing connection data (if any) */
  connection?: ConnectedPlatform | null;
  /** Whether user is a super admin */
  isSuperAdmin?: boolean;
}

/**
 * Compute the canonical state for a platform
 * Priority order matches enterprise requirements
 */
export function computePlatformState(ctx: PlatformContext): PlatformState {
  // 1. Provider not configured (Super Admin issue)
  if (ctx.providerReadiness?.status === 'not_configured' || ctx.providerReadiness?.status === 'partial') {
    return 'PROVIDER_NOT_CONFIGURED';
  }

  // 2. Plan required (Entitlement check)
  if (!ctx.hasSocialPublish) {
    return 'PLAN_REQUIRED';
  }

  // 3. No existing connection
  if (!ctx.connection) {
    // Check limit before allowing connection
    if (ctx.platformsLimit !== null && ctx.currentPlatformCount >= ctx.platformsLimit) {
      return 'LIMIT_REACHED';
    }
    return 'DISCONNECTED';
  }

  // 4. Connection exists - check status
  const conn = ctx.connection;

  // Inactive connection = disconnected
  if (!conn.is_active) {
    return 'DISCONNECTED';
  }

  // Map connection_status to state
  switch (conn.connection_status) {
    case 'pending_assets':
      return 'ASSET_REQUIRED';
    case 'connected':
      // Check if asset is actually selected
      if (!conn.account_id || !conn.account_name || conn.account_name.includes('account_')) {
        return 'ASSET_REQUIRED';
      }
      return 'CONNECTED';
    case 'expiring':
      return 'EXPIRING';
    case 'expired':
      return 'EXPIRED';
    case 'error':
      return 'ERROR';
    case 'disconnected':
      return 'DISCONNECTED';
    default:
      // Unknown status - treat as error
      return 'ERROR';
  }
}

/**
 * Get full state configuration including GOX message
 */
export function getPlatformStateConfig(
  state: PlatformState,
  context: { isSuperAdmin?: boolean; platform?: string; limit?: number }
): PlatformStateConfig & { goxMessage: GoxMessage } {
  const config = STATE_CONFIGS[state];
  const goxMessage = getGoxMessage(config.goxCode, {
    isSuperAdmin: context.isSuperAdmin ?? false,
    platform: context.platform,
    limit: context.limit,
  });

  return {
    state,
    ...config,
    goxMessage,
  };
}

/**
 * Get all states with their configurations
 */
export function getAllStateConfigs(): PlatformStateConfig[] {
  return Object.entries(STATE_CONFIGS).map(([state, config]) => ({
    state: state as PlatformState,
    ...config,
  }));
}

/**
 * Check if a state allows actions (not blocked)
 */
export function isStateActionable(state: PlatformState): boolean {
  return !['PROVIDER_NOT_CONFIGURED', 'PLAN_REQUIRED', 'LIMIT_REACHED', 'CONNECTING'].includes(state);
}

/**
 * Check if state requires user attention
 */
export function isStateAttentionRequired(state: PlatformState): boolean {
  return ['ASSET_REQUIRED', 'EXPIRING', 'EXPIRED', 'ERROR'].includes(state);
}

/**
 * Map connection_status from DB to PlatformState
 */
export function mapConnectionStatusToState(
  connectionStatus: ConnectedPlatform['connection_status'],
  hasAsset: boolean
): PlatformState {
  switch (connectionStatus) {
    case 'connected':
      return hasAsset ? 'CONNECTED' : 'ASSET_REQUIRED';
    case 'pending_assets':
      return 'ASSET_REQUIRED';
    case 'expiring':
      return 'EXPIRING';
    case 'expired':
      return 'EXPIRED';
    case 'error':
      return 'ERROR';
    case 'disconnected':
    default:
      return 'DISCONNECTED';
  }
}
