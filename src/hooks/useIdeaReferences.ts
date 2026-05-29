import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

export type IdeaReferenceType =
  | 'image' | 'video' | 'link' | 'file' | 'document' | 'text'
  | 'copy' | 'ad' | 'layout' | 'moodboard' | 'competitor'
  | 'inspiration' | 'campaign';

export interface IdeaReference {
  id: string;
  workspace_id: string;
  board_id: string;
  type: IdeaReferenceType;
  title: string;
  description: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  file_url: string | null;
  file_name: string | null;
  tags: string[];
  category: string | null;
  client_id: string | null;
  created_by: string | null;
  is_favorite: boolean;
  ai_tags: string[] | null;
  ai_category: string | null;
  ai_summary: string | null;
  ai_suggestions: any;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type IdeaReferenceInput = Omit<
  Partial<IdeaReference>,
  'id' | 'workspace_id' | 'created_at' | 'updated_at'
> & { board_id: string; title: string; type: IdeaReferenceType };

export function useIdeaReferences(boardId?: string) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const { toast } = useToast();
  const workspaceId = currentWorkspace?.id;

  const list = useQuery({
    queryKey: ['idea-references', boardId],
    enabled: !!boardId && !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('idea_references')
        .select('*')
        .eq('board_id', boardId!)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as IdeaReference[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: IdeaReferenceInput) => {
      if (!workspaceId) throw new Error('Workspace ausente');
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await (supabase as any)
        .from('idea_references')
        .insert({
          workspace_id: workspaceId,
          created_by: user?.id,
          tags: input.tags || [],
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data as IdeaReference;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-references', boardId] });
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Referência adicionada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<IdeaReference> & { id: string }) => {
      const { error } = await (supabase as any).from('idea_references').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-references', boardId] }),
  });

  const toggleFavorite = useMutation({
    mutationFn: async (ref: IdeaReference) => {
      const { error } = await (supabase as any)
        .from('idea_references')
        .update({ is_favorite: !ref.is_favorite })
        .eq('id', ref.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-references', boardId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('idea_references').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-references', boardId] });
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Referência excluída' });
    },
  });

  const bulkMove = useMutation({
    mutationFn: async ({ ids, targetBoardId }: { ids: string[]; targetBoardId: string }) => {
      if (!ids.length) return;
      const { error } = await (supabase as any)
        .from('idea_references')
        .update({ board_id: targetBoardId })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['idea-references', boardId] });
      qc.invalidateQueries({ queryKey: ['idea-references', vars.targetBoardId] });
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Referências movidas' });
    },
    onError: (e: any) => toast({ title: 'Erro ao mover', description: e.message, variant: 'destructive' }),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await (supabase as any).from('idea_references').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-references', boardId] });
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Referências excluídas' });
    },
  });

  const bulkFavorite = useMutation({
    mutationFn: async ({ ids, value }: { ids: string[]; value: boolean }) => {
      if (!ids.length) return;
      const { error } = await (supabase as any)
        .from('idea_references')
        .update({ is_favorite: value })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-references', boardId] }),
  });

  async function uploadFile(file: File, boardIdArg: string): Promise<{ path: string; signedUrl: string }> {
    if (!workspaceId) throw new Error('Workspace ausente');
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${workspaceId}/${boardIdArg}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from('idea-references').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data: signed } = await supabase.storage
      .from('idea-references')
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return { path, signedUrl: signed?.signedUrl || '' };
  }

  return { ...list, references: list.data || [], create, update, remove, toggleFavorite, uploadFile, bulkMove, bulkDelete, bulkFavorite };
}
