import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { toast } from 'sonner';

// Tabelas do chat ainda nao estao em integrations/supabase/types.ts; cliente sem tipos e formas declaradas aqui.
const db = supabase as any;

export type ChatKind = 'workspace' | 'space' | 'client' | 'private' | 'dm';

export interface ChatChannel {
  id: string;
  workspace_id: string;
  kind: ChatKind;
  ref_id: string | null;
  name: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface ChatReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  avatar: string | null;
}

/** Pessoas do workspace por id (nome e foto), vindas do hook de membros que o app ja usa. */
export function usePessoas() {
  const { data: membros } = useWorkspaceMembers() as { data?: any[] };
  return useMemo(() => {
    const mapa = new Map<string, Pessoa>();
    (membros ?? []).forEach((m: any) => {
      if (m.is_active === false) return;
      mapa.set(m.user_id, {
        id: m.user_id,
        nome: m.profile?.full_name || m.profile?.email?.split('@')[0] || 'Pessoa',
        avatar: m.profile?.avatar_url ?? null,
      });
    });
    return mapa;
  }, [membros]);
}

/** Canais do workspace; garante os canais automaticos (geral, espacos, clientes) ao abrir. */
export function useChatChannels(enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const wsId = currentWorkspace?.id;
  const pessoas = usePessoas();

  const q = useQuery({
    queryKey: ['chat-canais', wsId, user?.id],
    enabled: enabled && !!wsId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { error: e1 } = await db.rpc('chat_ensure_channels', { _workspace: wsId });
      if (e1) throw e1;
      const { data: canais, error } = await db
        .from('chat_channels').select('id, workspace_id, kind, ref_id, name, created_at').eq('workspace_id', wsId).order('name', { ascending: true });
      if (error) throw error;
      const lista = (canais ?? []) as ChatChannel[];

      // Quem e o outro lado de cada mensagem direta
      const dms = lista.filter(c => c.kind === 'dm').map(c => c.id);
      const outro = new Map<string, string>();
      if (dms.length) {
        const { data: ms } = await db.from('chat_members').select('channel_id, user_id').in('channel_id', dms);
        (ms ?? []).forEach((m: any) => {
          if (m.user_id !== user!.id) outro.set(m.channel_id, m.user_id);
        });
      }
      return { lista, outro };
    },
  });

  const canais = useMemo(() => {
    const base = q.data?.lista ?? [];
    return base.map(c => {
      if (c.kind !== 'dm') return { ...c, nomeExibido: c.name ?? 'Canal', outroId: null as string | null };
      const outroId = q.data?.outro.get(c.id) ?? null;
      return { ...c, nomeExibido: (outroId && pessoas.get(outroId)?.nome) || 'Mensagem direta', outroId };
    });
  }, [q.data, pessoas]);

  return { canais, isLoading: q.isLoading, erro: q.error, refetch: q.refetch };
}

/** Nao lidas por canal e o total (para o contador do menu). Atualiza em tempo real. */
export function useChatUnread(enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const wsId = currentWorkspace?.id;

  useRealtimeSubscription({
    table: 'chat_messages',
    filter: wsId ? `workspace_id=eq.${wsId}` : undefined,
    queryKeys: [['chat-nao-lidas', wsId, user?.id]],
    enabled: enabled && !!wsId && !!user?.id,
  });

  const q = useQuery({
    queryKey: ['chat-nao-lidas', wsId, user?.id],
    enabled: enabled && !!wsId && !!user?.id,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await db.rpc('chat_unread_counts', { _workspace: wsId });
      if (error) throw error;
      const mapa = new Map<string, { unread: number; mentions: number }>();
      (data ?? []).forEach((r: any) => mapa.set(r.channel_id, { unread: Number(r.unread), mentions: Number(r.mentions) }));
      return mapa;
    },
  });

  const total = useMemo(() => {
    let n = 0;
    q.data?.forEach(v => (n += v.unread));
    return n;
  }, [q.data]);

  return { porCanal: q.data ?? new Map<string, { unread: number; mentions: number }>(), total };
}

/** Mensagens de um canal (mais recentes primeiro no banco; devolvidas em ordem de leitura), com reacoes. */
export function useChatMessages(channelId: string | null, limite = 80) {
  useRealtimeSubscription({
    table: 'chat_messages',
    filter: channelId ? `channel_id=eq.${channelId}` : undefined,
    queryKeys: [['chat-mensagens', channelId]],
    enabled: !!channelId,
  });
  useRealtimeSubscription({
    table: 'chat_reactions',
    queryKeys: [['chat-mensagens', channelId]],
    enabled: !!channelId,
  });

  return useQuery({
    queryKey: ['chat-mensagens', channelId, limite],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await db
        .from('chat_messages')
        .select('id, channel_id, author_id, body, mentions, reply_to, created_at, edited_at, deleted_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limite + 1);
      if (error) throw error;
      const todas = (data ?? []) as ChatMessage[];
      const temMais = todas.length > limite;
      const mensagens = todas.slice(0, limite).reverse();

      let reacoes: ChatReaction[] = [];
      if (mensagens.length) {
        const { data: r, error: er } = await db.from('chat_reactions').select('message_id, user_id, emoji').in('message_id', mensagens.map(m => m.id));
        if (er) throw er;
        reacoes = (r ?? []) as ChatReaction[];
      }
      return { mensagens, reacoes, temMais };
    },
  });
}

export function useMarcarComoLido() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useCallback(
    async (channelId: string) => {
      const { error } = await db.rpc('chat_mark_read', { _channel: channelId });
      if (!error) qc.invalidateQueries({ queryKey: ['chat-nao-lidas', currentWorkspace?.id, user?.id] });
    },
    [qc, currentWorkspace?.id, user?.id],
  );
}

export function useEnviarMensagem() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, body, mentions, replyTo }: { channelId: string; body: string; mentions: string[]; replyTo?: string | null }) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('Sessão expirada.');
      const { error } = await db.from('chat_messages').insert({
        channel_id: channelId, workspace_id: currentWorkspace.id, author_id: user.id,
        body: body.trim(), mentions, reply_to: replyTo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ['chat-mensagens', v.channelId] }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível enviar a mensagem.'),
  });
}

export function useApagarMensagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; channelId: string }) => {
      const { error } = await db.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ['chat-mensagens', v.channelId] }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível apagar.'),
  });
}

export function useAlternarReacao() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, emoji, jaReagiu }: { messageId: string; emoji: string; jaReagiu: boolean; channelId: string }) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('Sessão expirada.');
      if (jaReagiu) {
        const { error } = await db.from('chat_reactions').delete().eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
        if (error) throw error;
      } else {
        const { error } = await db.from('chat_reactions').insert({ message_id: messageId, user_id: user.id, workspace_id: currentWorkspace.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ['chat-mensagens', v.channelId] }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível reagir.'),
  });
}

export function useAbrirMensagemDireta() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (outroId: string) => {
      const { data, error } = await db.rpc('chat_get_or_create_dm', { _workspace: currentWorkspace?.id, _other: outroId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-canais'] }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível abrir a conversa.'),
  });
}

export function useCriarCanalPrivado() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, membros }: { nome: string; membros: string[] }) => {
      const { data, error } = await db.rpc('chat_create_private', { _workspace: currentWorkspace?.id, _name: nome, _members: membros });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-canais'] }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível criar o canal.'),
  });
}
