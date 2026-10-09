import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

// As tabelas da Sala de Aprovacao ainda nao estao em integrations/supabase/types.ts; usamos um cliente sem tipos
// e declaramos aqui as formas que a tela consome.
const db = supabase as any;

export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'expired' | 'canceled';

export type EtapaDeAprovacao = 'tema' | 'conteudo' | 'midia' | 'legenda';
export const ETAPAS_DE_APROVACAO: { chave: EtapaDeAprovacao; rotulo: string; dica: string }[] = [
  { chave: 'tema', rotulo: 'Tema', dica: 'A ideia do post, em poucas linhas.' },
  { chave: 'conteudo', rotulo: 'Conteúdo', dica: 'Roteiro, texto da arte ou estrutura do carrossel.' },
  { chave: 'midia', rotulo: 'Mídia', dica: 'A arte, o vídeo ou as imagens prontas.' },
  { chave: 'legenda', rotulo: 'Legenda', dica: 'A legenda final, com hashtags.' },
];
export const rotuloDaEtapa = (e: EtapaDeAprovacao) => ETAPAS_DE_APROVACAO.find(x => x.chave === e)?.rotulo ?? e;

export interface ApprovalStageDecision {
  id: string;
  request_id: string;
  stage: EtapaDeAprovacao;
  status: 'pending' | 'approved' | 'changes_requested';
  decided_at: string | null;
  decided_by_name: string | null;
}

export interface ApprovalRequest {
  id: string;
  workspace_id: string;
  card_id: string;
  status: ApprovalStatus;
  mode: 'quick' | 'stages';
  round: number;
  title: string;
  message: string | null;
  client_name: string | null;
  client_email: string | null;
  requested_by: string;
  expires_at: string;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  decided_at: string | null;
  decided_by_name: string | null;
  certificate_hash: string | null;
  created_at: string;
}

export interface ApprovalItem {
  id: string;
  request_id: string;
  kind: 'image' | 'video' | 'document' | 'text' | 'link';
  stage: EtapaDeAprovacao | null;
  storage_path: string | null;
  file_name: string | null;
  body: string | null;
  caption: string | null;
  sort_order: number;
}

export interface ApprovalComment {
  id: string;
  request_id: string;
  author_kind: 'member' | 'client';
  author_name: string;
  body: string;
  created_at: string;
}

export interface ApprovalEvent {
  id: string;
  request_id: string;
  type: string;
  actor_kind: 'member' | 'client' | 'system';
  actor_label: string | null;
  created_at: string;
}

export interface ApprovalBundle {
  request: ApprovalRequest;
  items: ApprovalItem[];
  comments: ApprovalComment[];
  events: ApprovalEvent[];
  stages: ApprovalStageDecision[];
}

const keyDoCard = (cardId?: string) => ['approvals', cardId] as const;

/** Token com 32 bytes aleatorios em base64url; so o SHA-256 vai para o banco. */
export function gerarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const linkDeAprovacao = (token: string) => `${window.location.origin}/aprovacao/${token}`;

export function tipoDoArquivoDeAprovacao(tipo: string | null, nome: string): ApprovalItem['kind'] {
  return tipoDoArquivo(tipo, nome);
}

function tipoDoArquivo(tipo: string | null, nome: string): ApprovalItem['kind'] {
  const t = (tipo ?? '').toLowerCase();
  const n = nome.toLowerCase();
  if (t.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(n)) return 'image';
  if (t.startsWith('video/') || /\.(mp4|mov|webm)$/.test(n)) return 'video';
  return 'document';
}

/** Pedidos de aprovacao de um card, com pecas, conversa e trilha. Atualiza em tempo real. */
export function useCardApprovals(cardId: string | undefined, enabled = true) {
  const { currentWorkspace } = useWorkspace();

  useRealtimeSubscription({
    table: 'approval_requests',
    filter: cardId ? `card_id=eq.${cardId}` : undefined,
    queryKeys: [keyDoCard(cardId)],
    enabled: enabled && !!cardId,
  });
  useRealtimeSubscription({
    table: 'approval_stage_decisions',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [keyDoCard(cardId)],
    enabled: enabled && !!cardId && !!currentWorkspace?.id,
  });
  useRealtimeSubscription({
    table: 'approval_comments',
    filter: currentWorkspace?.id ? `workspace_id=eq.${currentWorkspace.id}` : undefined,
    queryKeys: [keyDoCard(cardId)],
    enabled: enabled && !!cardId && !!currentWorkspace?.id,
  });

  return useQuery({
    queryKey: keyDoCard(cardId),
    enabled: enabled && !!cardId,
    queryFn: async (): Promise<ApprovalBundle[]> => {
      const { data: pedidos, error } = await db
        .from('approval_requests')
        .select('id, workspace_id, card_id, status, mode, round, title, message, client_name, client_email, requested_by, expires_at, view_count, first_viewed_at, last_viewed_at, decided_at, decided_by_name, certificate_hash, created_at')
        .eq('card_id', cardId)
        .order('round', { ascending: false });
      if (error) throw error;
      const lista = (pedidos ?? []) as ApprovalRequest[];
      if (lista.length === 0) return [];
      const ids = lista.map(p => p.id);

      const [itens, conversa, eventos, etapas] = await Promise.all([
        db.from('approval_items').select('id, request_id, kind, stage, storage_path, file_name, body, caption, sort_order').in('request_id', ids).order('sort_order'),
        db.from('approval_comments').select('id, request_id, author_kind, author_name, body, created_at').in('request_id', ids).order('created_at'),
        db.from('approval_events').select('id, request_id, type, actor_kind, actor_label, created_at').in('request_id', ids).order('created_at'),
        db.from('approval_stage_decisions').select('id, request_id, stage, status, decided_at, decided_by_name').in('request_id', ids),
      ]);
      for (const r of [itens, conversa, eventos, etapas]) if (r.error) throw r.error;
      const ordem = ETAPAS_DE_APROVACAO.map(e => e.chave);

      return lista.map(request => ({
        request,
        items: ((itens.data ?? []) as ApprovalItem[]).filter(i => i.request_id === request.id),
        comments: ((conversa.data ?? []) as ApprovalComment[]).filter(c => c.request_id === request.id),
        events: ((eventos.data ?? []) as ApprovalEvent[]).filter(e => e.request_id === request.id),
        stages: ((etapas.data ?? []) as ApprovalStageDecision[])
          .filter(e => e.request_id === request.id)
          .sort((a, b) => ordem.indexOf(a.stage) - ordem.indexOf(b.stage)),
      }));
    },
  });
}

export interface NovoPedido {
  cardId: string;
  workspaceId: string;
  title: string;
  message?: string;
  clientName?: string;
  clientEmail?: string;
  clientId?: string | null;
  anexos: { file_url: string; file_name: string; file_type: string | null }[];
  texto?: string;
  expiraEmDias?: number;
  /** Modo por etapas: so as etapas enviadas entram no pedido. Se vier, `anexos` e `texto` sao ignorados. */
  etapas?: { stage: EtapaDeAprovacao; texto?: string; anexos?: { file_url: string; file_name: string; file_type: string | null }[] }[];
}

/** Cria o pedido da proxima rodada e devolve o link (o token so existe aqui, na hora de criar). */
export function useCreateApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: NovoPedido) => {
      if (!user?.id) throw new Error('Sessão expirada. Entre novamente.');
      const porEtapas = !!p.etapas;
      if (porEtapas) {
        if (p.etapas!.length === 0) throw new Error('Marque pelo menos uma etapa para enviar.');
        const vazia = p.etapas!.find(e => !e.texto?.trim() && !(e.anexos?.length));
        if (vazia) throw new Error(`A etapa ${rotuloDaEtapa(vazia.stage)} está vazia. Preencha ou desmarque.`);
      } else if (p.anexos.length === 0 && !p.texto?.trim()) {
        throw new Error('Escolha pelo menos uma peça ou escreva o texto a aprovar.');
      }

      const { data: ultimo } = await db
        .from('approval_requests').select('round').eq('card_id', p.cardId).order('round', { ascending: false }).limit(1).maybeSingle();
      const round = (ultimo?.round ?? 0) + 1;

      const token = gerarToken();
      const token_hash = await sha256Hex(token);
      const dias = p.expiraEmDias ?? 14;

      const { data: pedido, error } = await db
        .from('approval_requests')
        .insert({
          workspace_id: p.workspaceId,
          card_id: p.cardId,
          client_id: p.clientId ?? null,
          token_hash,
          round,
          mode: porEtapas ? 'stages' : 'quick',
          title: p.title.trim(),
          message: p.message?.trim() || null,
          client_name: p.clientName?.trim() || null,
          client_email: p.clientEmail?.trim() || null,
          requested_by: user.id,
          expires_at: new Date(Date.now() + dias * 86_400_000).toISOString(),
        })
        .select('id')
        .single();
      if (error) {
        if (String(error.message).includes('uq_approval_requests_aberto')) {
          throw new Error('Este card já tem um pedido em aberto. Cancele ou aguarde a resposta do cliente.');
        }
        throw error;
      }

      const itensDasEtapas = (p.etapas ?? []).flatMap((e, ei) => [
        ...(e.anexos ?? []).map((a, i) => ({
          request_id: pedido.id,
          workspace_id: p.workspaceId,
          stage: e.stage,
          kind: tipoDoArquivo(a.file_type, a.file_name),
          bucket: 'attachments',
          storage_path: a.file_url,
          file_name: a.file_name,
          sort_order: ei * 100 + i,
        })),
        ...(e.texto?.trim()
          ? [{ request_id: pedido.id, workspace_id: p.workspaceId, stage: e.stage, kind: 'text', body: e.texto.trim(), sort_order: ei * 100 + 99 }]
          : []),
      ]);
      const itens = porEtapas ? itensDasEtapas : [
        ...p.anexos.map((a, i) => ({
          request_id: pedido.id,
          workspace_id: p.workspaceId,
          kind: tipoDoArquivo(a.file_type, a.file_name),
          bucket: 'attachments',
          storage_path: a.file_url,
          file_name: a.file_name,
          sort_order: i,
        })),
        ...(p.texto?.trim()
          ? [{ request_id: pedido.id, workspace_id: p.workspaceId, kind: 'text', body: p.texto.trim(), sort_order: p.anexos.length }]
          : []),
      ];
      const { error: erroItens } = await db.from('approval_items').insert(itens);
      let erroEtapas: any = null;
      if (!erroItens && porEtapas) {
        const r = await db.from('approval_stage_decisions').insert(
          p.etapas!.map(e => ({ request_id: pedido.id, workspace_id: p.workspaceId, stage: e.stage })),
        );
        erroEtapas = r.error;
      }
      if (erroItens || erroEtapas) {
        await db.from('approval_requests').update({ status: 'canceled' }).eq('id', pedido.id);
        throw erroItens ?? erroEtapas;
      }

      await db.from('approval_events').insert({
        request_id: pedido.id, workspace_id: p.workspaceId, type: 'sent', actor_kind: 'member', actor_label: user.email ?? null,
      });

      return { token, link: linkDeAprovacao(token), round, requestId: pedido.id as string };
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: keyDoCard(vars.cardId) }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível criar o pedido.'),
  });
}

/** Gera um link novo para um pedido em aberto (o anterior deixa de funcionar). */
export function useRenewApprovalLink() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request }: { request: ApprovalRequest }) => {
      const token = gerarToken();
      const token_hash = await sha256Hex(token);
      const { error } = await db
        .from('approval_requests')
        .update({ token_hash, token_enc: null, expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString() })
        .eq('id', request.id).eq('status', 'pending');
      if (error) throw error;
      await db.from('approval_events').insert({
        request_id: request.id, workspace_id: request.workspace_id, type: 'link_renewed', actor_kind: 'member', actor_label: user?.email ?? null,
      });
      return { link: linkDeAprovacao(token), token, requestId: request.id };
    },
    onSuccess: (_r, { request }) => qc.invalidateQueries({ queryKey: keyDoCard(request.card_id) }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível gerar o novo link.'),
  });
}

export function useCancelApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request }: { request: ApprovalRequest }) => {
      const { error } = await db.from('approval_requests').update({ status: 'canceled' }).eq('id', request.id).eq('status', 'pending');
      if (error) throw error;
      await db.from('approval_events').insert({
        request_id: request.id, workspace_id: request.workspace_id, type: 'canceled', actor_kind: 'member', actor_label: user?.email ?? null,
      });
    },
    onSuccess: (_r, { request }) => {
      qc.invalidateQueries({ queryKey: keyDoCard(request.card_id) });
      toast.success('Pedido cancelado. O link deixou de funcionar.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível cancelar.'),
  });
}

/** Resposta da equipe na conversa do pedido (o cliente ve na pagina do link). */
export function useReplyApproval() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, body, authorName }: { request: ApprovalRequest; body: string; authorName: string }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      const { error } = await db.from('approval_comments').insert({
        request_id: request.id, workspace_id: request.workspace_id, author_kind: 'member', user_id: user.id,
        author_name: authorName, body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_r, { request }) => qc.invalidateQueries({ queryKey: keyDoCard(request.card_id) }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível enviar.'),
  });
}

/** Edita um pedido em aberto (texto, midia e etapas ainda nao respondidas) sem trocar o link. Tudo ou nada, validado no banco. */
export function useEditarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { request: ApprovalRequest; title: string; message: string; stages: unknown[]; notify: string | null }) => {
      const { error } = await db.rpc('approval_editar_pedido', {
        p_request: p.request.id, p_title: p.title, p_message: p.message, p_stages: p.stages, p_notify: p.notify,
      });
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: keyDoCard(v.request.card_id) });
      toast.success('Pedido atualizado. O link continua o mesmo.');
    },
    onError: (e: any) => {
      const m = String(e?.message ?? '');
      if (m.includes('ja foi respondida')) toast.error('O cliente acabou de responder uma etapa que você alterou. Atualize a tela e confira.');
      else if (m.includes('so pedidos em aberto')) toast.error('Este pedido já foi respondido e não pode mais ser editado. Envie uma nova rodada.');
      else if (m.includes('sem permissao')) toast.error('Você não tem permissão para editar este pedido.');
      else toast.error(m || 'Não foi possível salvar as alterações.');
    },
  });
}

/** Envia o link por e-mail ao cliente (funcao de borda confere o hash do token, o workspace e o limite de envios). */
export function useSendApprovalEmail() {
  return useMutation({
    mutationFn: async ({ requestId, token, to }: { requestId: string; token: string; to: string }) => {
      const { data, error } = await supabase.functions.invoke('approval-send-email', { body: { request_id: requestId, token, to } });
      if (error) {
        let msg = 'Não foi possível enviar o e-mail agora.';
        try {
          const corpo = await (error as any).context?.json?.();
          if (corpo?.error) msg = corpo.error;
        } catch {
          /* mantem a mensagem padrao */
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; to: string };
    },
  });
}

/** Pedidos aguardando o cliente (Início e Coordenacao). */
export function usePendingApprovals(enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['approvals-pendentes', wsId],
    enabled: enabled && !!wsId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from('approval_requests')
        .select('id, card_id, title, round, status, client_name, created_at, last_viewed_at, view_count, expires_at, cards(title)')
        .eq('workspace_id', wsId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as (Pick<ApprovalRequest, 'id' | 'card_id' | 'title' | 'round' | 'status' | 'client_name' | 'created_at' | 'last_viewed_at' | 'view_count' | 'expires_at'> & { cards: { title: string } | null })[];
    },
  });
}

/** Visao de acompanhamento (Coordenacao): ultimo pedido de cada card que ainda depende de alguem. */
export function useApprovalsOverview(enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['approvals-visao', wsId],
    enabled: enabled && !!wsId,
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const { data, error } = await db
        .from('approval_requests')
        .select('id, card_id, title, round, status, client_name, created_at, decided_at, view_count, last_viewed_at, reminder_count, expires_at, cards(title)')
        .eq('workspace_id', wsId)
        .gte('created_at', desde)
        .order('created_at', { ascending: false });
      if (error) throw error;
      type Linha = Pick<ApprovalRequest, 'id' | 'card_id' | 'title' | 'round' | 'status' | 'client_name' | 'created_at' | 'decided_at' | 'view_count' | 'last_viewed_at' | 'expires_at'> & { reminder_count: number; cards: { title: string } | null };
      const ultimoPorCard = new Map<string, Linha>();
      for (const l of (data ?? []) as Linha[]) if (!ultimoPorCard.has(l.card_id)) ultimoPorCard.set(l.card_id, l);
      const todos = [...ultimoPorCard.values()];
      const agora = Date.now();
      const diasDesde = (iso: string) => Math.floor((agora - new Date(iso).getTime()) / 86_400_000);
      const aguardando = todos.filter(l => l.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
      const ajustes = todos.filter(l => l.status === 'changes_requested').sort((a, b) => (b.decided_at ?? '').localeCompare(a.decided_at ?? ''));
      const aprovados7d = todos.filter(l => l.status === 'approved' && l.decided_at && agora - new Date(l.decided_at).getTime() < 7 * 86_400_000).length;
      return {
        aguardando,
        ajustes,
        aprovados7d,
        naoVistos: aguardando.filter(l => l.view_count === 0).length,
        semRespostaHa2Dias: aguardando.filter(l => diasDesde(l.created_at) >= 2).length,
      };
    },
  });
}
