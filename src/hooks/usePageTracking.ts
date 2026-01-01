import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export type ModuleName = 
  | 'dashboard'
  | 'calendar'
  | 'coordination'
  | 'financial'
  | 'partners'
  | 'gamification'
  | 'analytics'
  | 'settings'
  | 'integrations'
  | 'spaces'
  | 'cards'
  | 'time_tracking'
  | 'people_analytics';

// Map routes to module names
const ROUTE_TO_MODULE: Record<string, ModuleName> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/calendar': 'calendar',
  '/coordination': 'coordination',
  '/financial': 'financial',
  '/partners': 'partners',
  '/gamification': 'gamification',
  '/analytics': 'analytics',
  '/settings': 'settings',
  '/integrations': 'integrations',
  '/people-analytics': 'people_analytics',
};

/**
 * Hook that automatically tracks page views.
 * Call this in any page component to track when users visit that page.
 */
export function usePageTracking(moduleName?: ModuleName) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const location = useLocation();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    async function trackPageView() {
      if (!currentWorkspace?.id || !user?.id) return;
      
      // Determine module from prop or route
      const module = moduleName || ROUTE_TO_MODULE[location.pathname];
      if (!module) return;
      
      // Avoid duplicate tracking for same page in same session
      const trackingKey = `${location.pathname}-${currentWorkspace.id}`;
      if (trackedRef.current === trackingKey) return;
      trackedRef.current = trackingKey;

      try {
        await supabase.from('module_usage').insert({
          workspace_id: currentWorkspace.id,
          user_id: user.id,
          module_name: module,
          action: 'view',
          metadata: {
            page_url: location.pathname,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        // Silent fail - don't interrupt user flow for analytics
        console.debug('Page tracking error:', error);
      }
    }

    trackPageView();
  }, [currentWorkspace?.id, user?.id, location.pathname, moduleName]);
}

/**
 * Track a specific action within a module.
 */
export function useActionTracking() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const trackAction = async (
    moduleName: ModuleName,
    action: string,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!currentWorkspace?.id || !user?.id) return;

    try {
      await supabase.from('module_usage').insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        module_name: moduleName,
        action,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.debug('Action tracking error:', error);
    }
  };

  return { trackAction };
}
