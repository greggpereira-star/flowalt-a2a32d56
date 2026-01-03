import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { SocialPlatform } from './useSocialPosts';

export interface ConnectedPlatform {
  id: string;
  workspace_id: string;
  platform: SocialPlatform;
  account_name: string;
  account_id: string;
  account_type: string;
  profile_image_url: string | null;
  is_active: boolean;
  connection_status: 'connected' | 'expired' | 'error';
  last_sync_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export const useDisconnectPlatform = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (platformId: string) => {
      const { error } = await supabase
        .from('social_platforms')
        .update({
          is_active: false,
          connection_status: 'error',
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
      // This would call an edge function to refresh the OAuth token
      // For now, we just update the last_sync_at
      const { data, error } = await supabase
        .from('social_platforms')
        .update({
          last_sync_at: new Date().toISOString(),
          connection_status: 'connected',
          last_error: null,
        })
        .eq('id', platformId)
        .select()
        .single();

      if (error) throw error;
      return data as ConnectedPlatform;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
      queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
      toast.success('Token atualizado');
    },
    onError: (error) => {
      console.error('Error refreshing token:', error);
      toast.error('Erro ao atualizar token');
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
