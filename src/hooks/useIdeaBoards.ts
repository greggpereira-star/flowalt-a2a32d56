import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

export interface IdeaBoard {
  id: string;
  workspace_id: string;
  space_id: string | null;
  folder_id: string | null;
  name: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  is_public?: boolean;
  share_token?: string | null;
  share_expires_at?: string | null;
  reference_count?: number;
  preview_thumbs?: string[];
}

interface BoardInput {
  name: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  cover_url?: string | null;
  folder_id?: string | null;
  space_id?: string | null;
}

export function useIdeaBoards(opts?: { folderId?: string | null }) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const { toast } = useToast();
  const workspaceId = currentWorkspace?.id;

  const list = useQuery({
    queryKey: ['idea-boards', workspaceId, opts?.folderId ?? 'all'],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('idea_boards')
        .select('*, refs:idea_references(id,thumbnail_url,media_url)')
        .eq('workspace_id', workspaceId!)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });
      if (opts?.folderId) q = q.eq('folder_id', opts.folderId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((b: any) => {
        const refs = (b.refs || []).filter((r: any) => r.thumbnail_url || r.media_url);
        return {
          ...b,
          reference_count: (b.refs || []).length,
          preview_thumbs: refs.slice(0, 4).map((r: any) => r.thumbnail_url || r.media_url),
          refs: undefined,
        } as IdeaBoard;
      });
    },
  });

  const create = useMutation({
    mutationFn: async (input: BoardInput) => {
      if (!workspaceId) throw new Error('Workspace ausente');
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await (supabase as any)
        .from('idea_boards')
        .insert({
          workspace_id: workspaceId,
          created_by: user?.id,
          tags: input.tags || [],
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data as IdeaBoard;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Pasta criada' });
    },
    onError: (e: any) => toast({ title: 'Erro ao criar pasta', description: e.message, variant: 'destructive' }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<IdeaBoard> & { id: string }) => {
      const { error } = await (supabase as any).from('idea_boards').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] }),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('idea_boards')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Pasta arquivada' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('idea_boards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      toast({ title: 'Pasta excluída' });
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const enableShare = useMutation({
    mutationFn: async ({ boardId, expiresAt }: { boardId: string; expiresAt?: string | null }) => {
      const { data, error } = await (supabase as any).rpc('enable_idea_board_share', {
        _board_id: boardId,
        _expires_at: expiresAt ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      qc.invalidateQueries({ queryKey: ['idea-board'] });
    },
    onError: (e: any) => toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' }),
  });

  const disableShare = useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await (supabase as any).rpc('disable_idea_board_share', { _board_id: boardId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-boards', workspaceId] });
      qc.invalidateQueries({ queryKey: ['idea-board'] });
      toast({ title: 'Link público desativado' });
    },
  });

  return { ...list, boards: list.data || [], create, update, archive, remove, enableShare, disableShare };
}

export function useIdeaBoard(boardId?: string) {
  return useQuery({
    queryKey: ['idea-board', boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('idea_boards')
        .select('*')
        .eq('id', boardId!)
        .maybeSingle();
      if (error) throw error;
      return data as IdeaBoard | null;
    },
  });
}
