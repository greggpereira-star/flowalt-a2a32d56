import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentCorrelationId, getSessionId } from '@/lib/correlationId';

export type AccessType = 
  | 'page_view'
  | 'financial_view'
  | 'partners_view'
  | 'admin_action'
  | 'sensitive_data_access'
  | 'export_data'
  | 'api_key_view'
  | 'audit_log_view';

/**
 * Hook para registrar acessos a áreas sensíveis do sistema
 * Usado para compliance, segurança e auditoria
 */
export function useAccessLogging() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const logAccess = useCallback(async (
    accessType: AccessType,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!currentWorkspace?.id || !user?.id) return;

    try {
      await supabase.from('access_logs').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        access_type: accessType,
        user_agent: navigator.userAgent,
        metadata: {
          ...metadata,
          correlation_id: getCurrentCorrelationId(),
          session_id: getSessionId(),
          page_url: window.location.pathname,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Silent fail - don't interrupt user flow for logging
      console.debug('Access logging error:', error);
    }
  }, [currentWorkspace?.id, user?.id]);

  const logFinancialAccess = useCallback((action: string) => {
    logAccess('financial_view', { action });
  }, [logAccess]);

  const logPartnersAccess = useCallback((action: string) => {
    logAccess('partners_view', { action });
  }, [logAccess]);

  const logAdminAction = useCallback((action: string, entityType?: string, entityId?: string) => {
    logAccess('admin_action', { action, entityType, entityId });
  }, [logAccess]);

  const logSensitiveDataAccess = useCallback((dataType: string) => {
    logAccess('sensitive_data_access', { dataType });
  }, [logAccess]);

  const logExport = useCallback((exportType: string, recordCount?: number) => {
    logAccess('export_data', { exportType, recordCount });
  }, [logAccess]);

  return {
    logAccess,
    logFinancialAccess,
    logPartnersAccess,
    logAdminAction,
    logSensitiveDataAccess,
    logExport,
  };
}
