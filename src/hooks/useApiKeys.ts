import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useApiKeys() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['api-keys', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Use safe view to avoid exposing key_hash
      const { data, error } = await supabase
        .from('api_keys_safe')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ApiKey[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; permissions: string[]; expires_at?: string }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // Generate a random API key
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const apiKey = 'lv_' + Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const keyPrefix = apiKey.substring(0, 8);
      
      // Hash the key
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { data: result, error } = await supabase
        .from('api_keys')
        .insert({
          workspace_id: currentWorkspace.id,
          name: data.name,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          permissions: data.permissions,
          expires_at: data.expires_at || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Return both the key (for display) and the record
      return { ...result, full_key: apiKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar API Key', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; permissions?: string[]; is_active?: boolean }) => {
      const { error } = await supabase
        .from('api_keys')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar API Key', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key excluída' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir API Key', description: error.message, variant: 'destructive' });
    },
  });
}
