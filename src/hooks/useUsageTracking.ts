import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export type ModuleName = 
  | 'dashboard'
  | 'calendar'
  | 'coordination'
  | 'financial'
  | 'partners'
  | 'gamification'
  | 'analytics'
  | 'settings'
  | 'spaces'
  | 'cards'
  | 'time_tracking';

export type ActionName =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'import'
  | 'start_timer'
  | 'stop_timer'
  | 'complete'
  | 'archive';

export function useUsageTracking() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const trackUsage = useCallback(async (
    module: ModuleName,
    action: ActionName,
    metadata: Record<string, any> = {}
  ) => {
    if (!currentWorkspace?.id || !user?.id) return;

    try {
      await supabase.from('usage_metrics').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        module,
        action,
        metadata,
      });
    } catch (error) {
      // Silent fail - don't interrupt user flow for analytics
      console.debug('Usage tracking error:', error);
    }
  }, [currentWorkspace?.id, user?.id]);

  const trackPageView = useCallback((module: ModuleName) => {
    trackUsage(module, 'view');
  }, [trackUsage]);

  return {
    trackUsage,
    trackPageView,
  };
}
