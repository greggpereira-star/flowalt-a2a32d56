import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type HashtagCategory = 'niche' | 'trending' | 'branded' | 'local' | 'campaign';

export interface HashtagLibrary {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  hashtags: string[];
  category: HashtagCategory | null;
  description: string | null;
  usage_count: number;
  avg_engagement_boost: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHashtagLibraryInput {
  name: string;
  hashtags: string[];
  client_id?: string | null;
  category?: HashtagCategory;
  description?: string;
}

export interface UpdateHashtagLibraryInput extends Partial<CreateHashtagLibraryInput> {}

export const useSocialHashtags = (clientId?: string | null) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['social-hashtags', currentWorkspace?.id, clientId],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('social_hashtag_library')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('usage_count', { ascending: false });

      if (clientId) {
        query = query.or(`client_id.eq.${clientId},client_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as HashtagLibrary[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

export const useCreateHashtagLibrary = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateHashtagLibraryInput) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não selecionado');

      const { data, error } = await supabase
        .from('social_hashtag_library')
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: user?.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as HashtagLibrary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-hashtags'] });
      toast.success('Grupo de hashtags criado');
    },
    onError: (error) => {
      console.error('Error creating hashtag library:', error);
      toast.error('Erro ao criar grupo de hashtags');
    },
  });
};

export const useUpdateHashtagLibrary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateHashtagLibraryInput }) => {
      const { data, error } = await supabase
        .from('social_hashtag_library')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as HashtagLibrary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-hashtags'] });
      toast.success('Grupo de hashtags atualizado');
    },
    onError: (error) => {
      console.error('Error updating hashtag library:', error);
      toast.error('Erro ao atualizar grupo de hashtags');
    },
  });
};

export const useDeleteHashtagLibrary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_hashtag_library')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-hashtags'] });
      toast.success('Grupo de hashtags excluído');
    },
    onError: (error) => {
      console.error('Error deleting hashtag library:', error);
      toast.error('Erro ao excluir grupo de hashtags');
    },
  });
};

export const useIncrementHashtagUsage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: current, error: fetchError } = await supabase
        .from('social_hashtag_library')
        .select('usage_count')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { data, error } = await supabase
        .from('social_hashtag_library')
        .update({ usage_count: (current.usage_count || 0) + 1 })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as HashtagLibrary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-hashtags'] });
    },
  });
};

export const getCategoryInfo = (category: HashtagCategory | null) => {
  const categoryInfo: Record<HashtagCategory, { name: string; description: string; color: string }> = {
    niche: { name: 'Nicho', description: 'Hashtags específicas do segmento', color: 'bg-blue-100 text-blue-800' },
    trending: { name: 'Trending', description: 'Hashtags em alta', color: 'bg-purple-100 text-purple-800' },
    branded: { name: 'Marca', description: 'Hashtags da marca/cliente', color: 'bg-green-100 text-green-800' },
    local: { name: 'Local', description: 'Hashtags de localização', color: 'bg-orange-100 text-orange-800' },
    campaign: { name: 'Campanha', description: 'Hashtags de campanhas específicas', color: 'bg-pink-100 text-pink-800' },
  };
  return category ? categoryInfo[category] : { name: 'Sem categoria', description: '', color: 'bg-gray-100 text-gray-800' };
};
