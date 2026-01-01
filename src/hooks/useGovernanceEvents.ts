import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export type GovernanceEventType = 
  | 'access.denied'
  | 'access.granted'
  | 'visibility.changed'
  | 'permission.granted'
  | 'permission.revoked'
  | 'restricted.content.viewed'
  | 'admin.override';

interface GovernanceEventMetadata {
  entity_type: 'card' | 'folder' | 'space' | 'member' | 'webhook' | 'api_key' | 'financial';
  entity_id: string;
  entity_name?: string;
  reason?: string;
  old_value?: string;
  new_value?: string;
  denied_action?: string;
  required_role?: string;
  current_role?: string;
  [key: string]: unknown;
}

export function useGovernanceEvents() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const emitEvent = useCallback(async (
    eventType: GovernanceEventType,
    metadata: GovernanceEventMetadata
  ) => {
    if (!user?.id || !currentWorkspace?.id) {
      console.warn('[Governance] Cannot emit event: no user or workspace');
      return;
    }

    try {
      // Log to access_logs table for audit trail
      await supabase.from('access_logs').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        access_type: eventType,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
        },
      });
    } catch (error) {
      // Silently fail - governance events should not block user actions
      console.error('[Governance] Failed to emit event:', error);
    }
  }, [user?.id, currentWorkspace?.id]);

  // Convenience methods for common events
  const trackAccessDenied = useCallback((
    entityType: GovernanceEventMetadata['entity_type'],
    entityId: string,
    deniedAction: string,
    requiredRole?: string,
    currentRole?: string
  ) => {
    return emitEvent('access.denied', {
      entity_type: entityType,
      entity_id: entityId,
      denied_action: deniedAction,
      required_role: requiredRole,
      current_role: currentRole,
      reason: `User does not have ${requiredRole || 'required'} permission`,
    });
  }, [emitEvent]);

  const trackVisibilityChange = useCallback((
    entityType: GovernanceEventMetadata['entity_type'],
    entityId: string,
    oldValue: string,
    newValue: string,
    entityName?: string
  ) => {
    return emitEvent('visibility.changed', {
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_value: oldValue,
      new_value: newValue,
    });
  }, [emitEvent]);

  const trackPermissionGranted = useCallback((
    entityType: GovernanceEventMetadata['entity_type'],
    entityId: string,
    permission: string,
    targetUserId?: string
  ) => {
    return emitEvent('permission.granted', {
      entity_type: entityType,
      entity_id: entityId,
      new_value: permission,
      target_user_id: targetUserId,
    });
  }, [emitEvent]);

  const trackPermissionRevoked = useCallback((
    entityType: GovernanceEventMetadata['entity_type'],
    entityId: string,
    permission: string,
    targetUserId?: string
  ) => {
    return emitEvent('permission.revoked', {
      entity_type: entityType,
      entity_id: entityId,
      old_value: permission,
      target_user_id: targetUserId,
    });
  }, [emitEvent]);

  const trackRestrictedContentViewed = useCallback((
    entityType: GovernanceEventMetadata['entity_type'],
    entityId: string,
    entityName?: string
  ) => {
    return emitEvent('restricted.content.viewed', {
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
    });
  }, [emitEvent]);

  const trackAdminOverride = useCallback((
    entityType: GovernanceEventMetadata['entity_type'],
    entityId: string,
    action: string,
    reason?: string
  ) => {
    return emitEvent('admin.override', {
      entity_type: entityType,
      entity_id: entityId,
      denied_action: action,
      reason: reason || 'Admin override',
    });
  }, [emitEvent]);

  return {
    emitEvent,
    trackAccessDenied,
    trackVisibilityChange,
    trackPermissionGranted,
    trackPermissionRevoked,
    trackRestrictedContentViewed,
    trackAdminOverride,
  };
}
