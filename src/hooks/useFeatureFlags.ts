import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export interface FeatureFlag {
  id: string;
  flag_key: string;
  enabled: boolean;
  rollout_percentage: number;
  metadata: Record<string, any>;
}

// Feature flag keys
export const FEATURE_FLAGS = {
  COMMAND_PALETTE: 'command_palette',
  ANALYTICS_V2: 'analytics_v2',
  EMAIL_NOTIFICATIONS: 'email_notifications',
  ADVANCED_WEBHOOKS: 'advanced_webhooks',
  PEOPLE_ANALYTICS: 'people_analytics',
  AUTOMATIONS: 'automations',
  TEMPLATES: 'templates',
  AI_ESTIMATES: 'ai_estimates',
} as const;

export function useFeatureFlags() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get workspace-specific flags
      const { data: workspaceFlags, error: wsError } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      // Get global flags (workspace_id is null)
      const { data: globalFlags, error: gError } = await supabase
        .from('feature_flags')
        .select('*')
        .is('workspace_id', null);

      if (wsError) console.error('Error fetching workspace flags:', wsError);
      if (gError) console.error('Error fetching global flags:', gError);

      // Merge flags (workspace-specific override global)
      const flagMap = new Map<string, FeatureFlag>();
      
      globalFlags?.forEach((flag) => {
        flagMap.set(flag.flag_key, flag as FeatureFlag);
      });

      workspaceFlags?.forEach((flag) => {
        flagMap.set(flag.flag_key, flag as FeatureFlag);
      });

      return Array.from(flagMap.values());
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isEnabled = (flagKey: string): boolean => {
    const flag = flags?.find((f) => f.flag_key === flagKey);
    
    if (!flag) {
      // Default enabled flags
      const defaultEnabled = [
        FEATURE_FLAGS.COMMAND_PALETTE,
        FEATURE_FLAGS.EMAIL_NOTIFICATIONS,
        FEATURE_FLAGS.ADVANCED_WEBHOOKS,
      ];
      return defaultEnabled.includes(flagKey as any);
    }

    if (!flag.enabled) return false;

    // Check rollout percentage
    if (flag.rollout_percentage < 100 && user?.id) {
      // Use user ID to deterministically decide if feature is enabled
      const hash = user.id.split('').reduce((acc, char) => {
        return acc + char.charCodeAt(0);
      }, 0);
      const userPercentage = hash % 100;
      return userPercentage < flag.rollout_percentage;
    }

    return true;
  };

  const getFlag = (flagKey: string): FeatureFlag | undefined => {
    return flags?.find((f) => f.flag_key === flagKey);
  };

  return {
    flags: flags || [],
    isLoading,
    isEnabled,
    getFlag,
  };
}
