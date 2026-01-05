import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';
export type SocialContentType = 'feed' | 'story' | 'reels' | 'carousel' | 'video' | 'short' | 'article';
export type SocialPostStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'archived';
export type ContentPillar = 'educational' | 'sales' | 'entertainment' | 'relationship' | 'institutional' | 'other';
export type FunnelStage = 'tofu' | 'mofu' | 'bofu';

export interface SocialPost {
  id: string;
  workspace_id: string;
  card_id: string | null; // Optional - posts can be created without a card
  client_id: string | null;
  platform_connection_id: string | null; // Link to social_platforms
  caption: string | null;
  hashtags: string[];
  media_urls: unknown; // JSON type from DB
  first_comment: string | null;
  platform: SocialPlatform;
  content_type: SocialContentType;
  scheduled_at: string | null;
  published_at: string | null;
  timezone: string;
  status: SocialPostStatus;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  metrics: Record<string, number>;
  metrics_updated_at: string | null;
  platform_post_id: string | null;
  platform_url: string | null;
  content_pillar: ContentPillar | null;
  funnel_stage: FunnelStage | null;
  campaign_name: string | null;
  utm_params: Record<string, string> | null;
  ab_test_group: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  // New hardening fields
  content_fingerprint: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  job_id: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
}

export interface CreateSocialPostInput {
  card_id?: string | null; // Optional - posts can be created without a card
  client_id?: string | null;
  platform_connection_id: string; // Required - must link to a connected account
  caption?: string;
  hashtags?: string[];
  media_urls?: { url: string; type: 'image' | 'video'; order: number }[];
  first_comment?: string;
  platform: SocialPlatform;
  content_type: SocialContentType;
  scheduled_at?: string;
  timezone?: string;
  content_pillar?: ContentPillar;
  funnel_stage?: FunnelStage;
  campaign_name?: string;
  utm_params?: Record<string, string>;
}

export interface UpdateSocialPostInput extends Partial<Omit<CreateSocialPostInput, 'card_id'>> {
  status?: SocialPostStatus;
  approved_by?: string;
  approved_at?: string;
}

export const useSocialPosts = (filters?: {
  status?: SocialPostStatus | SocialPostStatus[];
  platform?: SocialPlatform;
  clientId?: string;
  cardId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['social-posts', currentWorkspace?.id, filters],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('scheduled_at', { ascending: true, nullsFirst: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.platform) {
        query = query.eq('platform', filters.platform);
      }

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.cardId) {
        query = query.eq('card_id', filters.cardId);
      }

      if (filters?.startDate) {
        query = query.gte('scheduled_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('scheduled_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as SocialPost[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useSocialPost = (postId: string | null) => {
  return useQuery({
    queryKey: ['social-post', postId],
    queryFn: async () => {
      if (!postId) return null;

      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;
      return data as unknown as SocialPost;
    },
    enabled: !!postId,
  });
};

export const useCreateSocialPost = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateSocialPostInput) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (!input.platform_connection_id) throw new Error('Selecione uma conta conectada');

      // Determine status based on whether there's a scheduled time
      const status = input.scheduled_at ? 'scheduled' : 'draft';

      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          card_id: input.card_id || null,
          client_id: input.client_id || null,
          platform_connection_id: input.platform_connection_id,
          caption: input.caption,
          hashtags: input.hashtags,
          media_urls: input.media_urls,
          first_comment: input.first_comment,
          platform: input.platform,
          content_type: input.content_type,
          scheduled_at: input.scheduled_at,
          timezone: input.timezone,
          status,
          content_pillar: input.content_pillar,
          funnel_stage: input.funnel_stage,
          campaign_name: input.campaign_name,
          utm_params: input.utm_params,
        })
        .select()
        .single();

      if (error) {
        // Handle RLS violations with user-friendly messages
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          throw new Error('Você não tem permissão para criar posts neste card');
        }
        throw error;
      }
      return data as unknown as SocialPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Postagem criada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating social post:', error);
      toast.error(error.message || 'Erro ao criar postagem');
    },
  });
};

export const useUpdateSocialPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, input }: { postId: string; input: UpdateSocialPostInput }) => {
      const { data, error } = await supabase
        .from('social_posts')
        .update(input)
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SocialPost;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-post', data.id] });
      toast.success('Postagem atualizada');
    },
    onError: (error) => {
      console.error('Error updating social post:', error);
      toast.error('Erro ao atualizar postagem');
    },
  });
};

export const useDeleteSocialPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast.success('Postagem excluída');
    },
    onError: (error) => {
      console.error('Error deleting social post:', error);
      toast.error('Erro ao excluir postagem');
    },
  });
};

export const useScheduleSocialPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      const { data, error } = await supabase
        .from('social_posts')
        .update({
          scheduled_at: scheduledAt,
          status: 'scheduled',
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SocialPost;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-post', data.id] });
      toast.success('Postagem agendada');
    },
    onError: (error) => {
      console.error('Error scheduling social post:', error);
      toast.error('Erro ao agendar postagem');
    },
  });
};

export const useApproveSocialPost = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from('social_posts')
        .update({
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SocialPost;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-post', data.id] });
      toast.success('Postagem aprovada');
    },
    onError: (error) => {
      console.error('Error approving social post:', error);
      toast.error('Erro ao aprovar postagem');
    },
  });
};

export const useSocialPostsByCard = (cardId: string | null) => {
  return useSocialPosts({ cardId: cardId || undefined });
};

export const useSocialPostsByClient = (clientId: string | null) => {
  return useSocialPosts({ clientId: clientId || undefined });
};

export const useCalendarPosts = (startDate: string, endDate: string) => {
  return useSocialPosts({
    startDate,
    endDate,
    status: ['scheduled', 'published', 'failed'],
  });
};
