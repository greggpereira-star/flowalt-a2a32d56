import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlementRegistry } from '@/hooks/useEntitlementRegistry';
import { toast } from 'sonner';
import type { SocialPlatform } from './useSocialPosts';
import { 
  computePlatformState, 
  getPlatformStateConfig, 
  type PlatformState, 
  type PlatformContext,
  type ProviderReadiness 
} from '@/lib/social/platform-state';
import { getGoxMessage, mapApiErrorToGox, type GoxMessage } from '@/lib/social/gox-messages';

export interface ConnectedPlatform {
  id: string;
  workspace_id: string;
  platform: SocialPlatform;
  account_name: string;
  account_id: string;
  account_type: string;
  platform_account_type?: string;
  profile_image_url: string | null;
  is_active: boolean;
  connection_status: 'disconnected' | 'pending_assets' | 'connected' | 'expiring' | 'expired' | 'error';
  last_sync_at: string | null;
  last_tested_at?: string | null;
  last_error: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Extended platform data with computed state
 */
export interface PlatformWithState extends ConnectedPlatform {
  computedState: PlatformState;
  stateConfig: ReturnType<typeof getPlatformStateConfig>;
}

export interface ConnectPlatformInput {
  platform: SocialPlatform;
  account_name: string;
  account_id: string;
  account_type?: string;
  profile_image_url?: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expires_at?: string;
  scopes?: string[];
}

/**
 * Fetch provider readiness status from edge function
 */
export const useProviderReadiness = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['provider-readiness', currentWorkspace?.id],
    queryFn: async (): Promise<Record<string, ProviderReadiness>> => {
      const { data, error } = await supabase.functions.invoke('social-provider-status', {
        body: {},
      });

      if (error) {
        console.error('Error fetching provider status:', error);
        // Return all as ready on error to not block users
        return {};
      }

      // Map response to ProviderReadiness format
      const readiness: Record<string, ProviderReadiness> = {};
      
      if (data?.providers) {
        for (const [key, provider] of Object.entries(data.providers as Record<string, any>)) {
          readiness[key] = {
            status: provider.status || 'not_configured',
            missingSecrets: provider.missingSecrets || [],
          };
        }
      }

      return readiness;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
};

/**
 * Main hook for social platforms with computed state
 */
export const useSocialPlatforms = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['social-platforms', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('platform', { ascending: true });

      if (error) throw error;
      return data as ConnectedPlatform[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

/**
 * Enhanced hook that returns platforms with computed states
 */
export const useSocialPlatformsWithState = () => {
  const { currentWorkspace } = useWorkspace();
  const { has, limit } = useEntitlementRegistry();
  const { data: providerReadiness } = useProviderReadiness();
  const { data: platforms, ...rest } = useSocialPlatforms();

  const hasSocialPublish = has('social_publish');
  const platformsLimit = limit('social_platforms_limit');
  const currentPlatformCount = platforms?.filter(p => p.is_active)?.length || 0;

  // Compute state for each platform
  const platformsWithState: PlatformWithState[] | undefined = platforms?.map(platform => {
    // Map platform to provider key
    const providerKey = mapPlatformToProvider(platform.platform);
    const providerStatus = providerReadiness?.[providerKey];

    const context: PlatformContext = {
      providerReadiness: providerStatus,
      hasSocialPublish,
      platformsLimit,
      currentPlatformCount,
      connection: platform,
    };

    const computedState = computePlatformState(context);
    const stateConfig = getPlatformStateConfig(computedState, {
      platform: platform.platform,
      limit: platformsLimit ?? undefined,
    });

    return {
      ...platform,
      computedState,
      stateConfig,
    };
  });

  return {
    ...rest,
    data: platformsWithState,
    providerReadiness,
    hasSocialPublish,
    platformsLimit,
    currentPlatformCount,
    canConnectMore: platformsLimit === null || currentPlatformCount < platformsLimit,
  };
};

/**
 * Compute state for a platform that doesn't exist yet
 */
export const useUnconnectedPlatformState = (platformId: string) => {
  const { has, limit } = useEntitlementRegistry();
  const { data: providerReadiness } = useProviderReadiness();
  const { data: platforms } = useSocialPlatforms();

  const hasSocialPublish = has('social_publish');
  const platformsLimit = limit('social_platforms_limit');
  const currentPlatformCount = platforms?.filter(p => p.is_active)?.length || 0;

  const providerKey = mapPlatformToProvider(platformId as SocialPlatform);
  const providerStatus = providerReadiness?.[providerKey];

  const context: PlatformContext = {
    providerReadiness: providerStatus,
    hasSocialPublish,
    platformsLimit,
    currentPlatformCount,
    connection: null,
  };

  const computedState = computePlatformState(context);
  const stateConfig = getPlatformStateConfig(computedState, {
    platform: platformId,
    limit: platformsLimit ?? undefined,
  });

  return {
    computedState,
    stateConfig,
    providerStatus,
    isReady: providerStatus?.status === 'ready',
    canConnect: computedState === 'DISCONNECTED',
  };
};

/**
 * Map platform ID to provider key for readiness check
 */
function mapPlatformToProvider(platform: SocialPlatform): string {
  const mapping: Record<SocialPlatform, string> = {
    instagram: 'meta',
    facebook: 'meta',
    linkedin: 'linkedin',
    tiktok: 'tiktok',
    youtube: 'google',
    twitter: 'twitter',
  };
  return mapping[platform] || platform;
}

export const useActivePlatforms = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['social-platforms-active', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true)
        .eq('connection_status', 'connected')
        .order('platform', { ascending: true });

      if (error) throw error;
      return data as ConnectedPlatform[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useConnectPlatform = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: ConnectPlatformInput) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase
        .from('social_platforms')
        .upsert({
          workspace_id: currentWorkspace.id,
          created_by: user?.id,
          connection_status: 'connected',
          is_active: true,
          ...input,
        }, {
          onConflict: 'workspace_id,platform,account_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as ConnectedPlatform;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
      toast.success(`${data.platform} conectado com sucesso`);
    },
    onError: (error) => {
      console.error('Error connecting platform:', error);
      toast.error('Erro ao conectar plataforma');
    },
  });
};

/**
 * Enterprise disconnect using edge function with audit
 */
export const useDisconnectPlatform = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ platformId, reason }: { platformId: string; reason?: string }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase.functions.invoke('social-disconnect', {
        body: {
          workspace_id: currentWorkspace.id,
          platform_connection_id: platformId,
          reason,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao desconectar plataforma');
      }

      if (!data.ok) {
        // Map error to GOX message
        const goxCode = mapApiErrorToGox(data.error_code);
        const goxMessage = getGoxMessage(goxCode, { isSuperAdmin: false });
        throw new Error(goxMessage.message);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
      toast.success(data.message || 'Plataforma desconectada');
    },
    onError: (error: Error) => {
      console.error('Error disconnecting platform:', error);
      toast.error(error.message || 'Erro ao desconectar plataforma');
    },
  });
};

/**
 * Legacy disconnect (direct DB update) - kept for backwards compatibility
 */
export const useDisconnectPlatformLegacy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformId: string) => {
      const { error } = await supabase
        .from('social_platforms')
        .update({
          is_active: false,
          connection_status: 'disconnected',
        })
        .eq('id', platformId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
      toast.success('Plataforma desconectada');
    },
    onError: (error) => {
      console.error('Error disconnecting platform:', error);
      toast.error('Erro ao desconectar plataforma');
    },
  });
};

export const useDeletePlatform = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformId: string) => {
      const { error } = await supabase
        .from('social_platforms')
        .delete()
        .eq('id', platformId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
      toast.success('Plataforma removida');
    },
    onError: (error) => {
      console.error('Error deleting platform:', error);
      toast.error('Erro ao remover plataforma');
    },
  });
};

export const useRefreshPlatformToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformId: string) => {
      // Call the real token refresh edge function
      const { data, error } = await supabase.functions.invoke('social-token-refresh', {
        body: { platform_id: platformId },
      });

      if (error) throw new Error(error.message);
      
      if (!data.success) {
        // Map to GOX message
        const goxCode = mapApiErrorToGox(data.error_code || 'API_ERROR');
        const goxMessage = getGoxMessage(goxCode, { isSuperAdmin: false });
        throw new Error(data.error_message || goxMessage.message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
      toast.success('Token atualizado com sucesso');
    },
    onError: (error: any) => {
      console.error('Error refreshing token:', error);
      if (error.message?.includes('reauthorization') || error.message?.includes('reconect')) {
        toast.error('Reconexão necessária', {
          description: 'O token expirou e precisa ser reautorizado.',
        });
      } else {
        toast.error(error.message || 'Erro ao atualizar token');
      }
    },
  });
};

/**
 * Test platform connection
 */
export const useTestPlatformConnection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformId: string) => {
      const { data, error } = await supabase.functions.invoke('social-connection-test', {
        body: { platform_id: platformId },
      });

      if (error) throw new Error(error.message);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      
      if (data.success) {
        toast.success('Conexão validada com sucesso!');
      } else {
        const goxCode = mapApiErrorToGox(data.error_code || 'API_ERROR');
        const goxMessage = getGoxMessage(goxCode, { isSuperAdmin: false });
        toast.error(goxMessage.title, {
          description: data.gox_message || goxMessage.message,
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error testing connection:', error);
      toast.error('Erro ao testar conexão', {
        description: error.message,
      });
    },
  });
};

export const usePlatformCount = () => {
  const { data: platforms } = useSocialPlatforms();
  return platforms?.filter(p => p.is_active).length || 0;
};

export const getPlatformInfo = (platform: SocialPlatform) => {
  const platformInfo: Record<SocialPlatform, { name: string; color: string; icon: string }> = {
    instagram: { name: 'Instagram', color: '#E4405F', icon: 'instagram' },
    facebook: { name: 'Facebook', color: '#1877F2', icon: 'facebook' },
    linkedin: { name: 'LinkedIn', color: '#0A66C2', icon: 'linkedin' },
    tiktok: { name: 'TikTok', color: '#000000', icon: 'tiktok' },
    youtube: { name: 'YouTube', color: '#FF0000', icon: 'youtube' },
    twitter: { name: 'X (Twitter)', color: '#000000', icon: 'twitter' },
  };
  return platformInfo[platform];
};

export const getContentTypeInfo = (contentType: string) => {
  const contentTypeInfo: Record<string, { name: string; description: string }> = {
    feed: { name: 'Feed', description: 'Postagem no feed principal' },
    story: { name: 'Story', description: 'Conteúdo temporário (24h)' },
    reels: { name: 'Reels', description: 'Vídeo curto vertical' },
    carousel: { name: 'Carrossel', description: 'Múltiplas imagens/vídeos' },
    video: { name: 'Vídeo', description: 'Vídeo longo' },
    short: { name: 'Short', description: 'Vídeo curto (YouTube Shorts)' },
    article: { name: 'Artigo', description: 'Artigo longo (LinkedIn)' },
  };
  return contentTypeInfo[contentType] || { name: contentType, description: '' };
};
