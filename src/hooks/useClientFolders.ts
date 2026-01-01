import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useClientsSpace } from './useClientsSpace';
import type { Folder } from './useFolders';

// Fetch the folder associated with a specific client card
export const useClientFolder = (clientId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();
  const { data: clientsSpace } = useClientsSpace();

  return useQuery({
    queryKey: ['client-folder', clientId],
    queryFn: async () => {
      if (!clientId || !currentWorkspace?.id || !clientsSpace?.id) return null;

      // Look for a folder with client_card_id matching this client
      // We'll use folder description to store the client_card_id reference
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('space_id', clientsSpace.id)
        .ilike('description', `%client_card_id:${clientId}%`)
        .eq('is_archived', false)
        .maybeSingle();

      if (error) throw error;
      return data as Folder | null;
    },
    enabled: !!clientId && !!currentWorkspace?.id && !!clientsSpace?.id,
  });
};

// Create a folder for a client
export const useCreateClientFolder = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { data: clientsSpace } = useClientsSpace();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      clientName, 
      clientColor 
    }: { 
      clientId: string; 
      clientName: string; 
      clientColor?: string; 
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');
      if (!clientsSpace?.id) throw new Error('Clients space not found');

      // Check if folder already exists
      const { data: existing } = await supabase
        .from('folders')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('space_id', clientsSpace.id)
        .ilike('description', `%client_card_id:${clientId}%`)
        .eq('is_archived', false)
        .maybeSingle();

      if (existing) {
        return existing;
      }

      // Create new folder for client
      const { data, error } = await supabase
        .from('folders')
        .insert({
          workspace_id: currentWorkspace.id,
          space_id: clientsSpace.id,
          name: clientName,
          description: `Pasta do cliente | client_card_id:${clientId}`,
          color: clientColor || '#6366f1',
          icon: 'building-2',
          is_personal: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['client-folder'] });
    },
  });
};

// Get all client folders
export const useClientFolders = () => {
  const { currentWorkspace } = useWorkspace();
  const { data: clientsSpace } = useClientsSpace();

  return useQuery({
    queryKey: ['client-folders', currentWorkspace?.id, clientsSpace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id || !clientsSpace?.id) return [];

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('space_id', clientsSpace.id)
        .ilike('description', '%client_card_id:%')
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Parse client_card_id from description
      return (data || []).map(folder => ({
        ...folder,
        client_card_id: folder.description?.match(/client_card_id:([a-f0-9-]+)/)?.[1] || null,
      }));
    },
    enabled: !!currentWorkspace?.id && !!clientsSpace?.id,
  });
};

// Sync folder with client data (name, color)
export const useSyncClientFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      folderId, 
      clientName, 
      clientColor 
    }: { 
      folderId: string; 
      clientName: string; 
      clientColor?: string; 
    }) => {
      const { data, error } = await supabase
        .from('folders')
        .update({
          name: clientName,
          color: clientColor,
        })
        .eq('id', folderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['client-folder'] });
    },
  });
};
