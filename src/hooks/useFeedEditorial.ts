import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { chaveMes, dataDoPost, situacaoDoPost, type AprovacaoDoPost, type SituacaoDoPost } from '@/lib/feed/situacao-do-post';

// O feed editorial se apoia nos CARDS e nos campos personalizados de social media (Data de Postagem, Plataforma,
// Tipo de Peca, Link do Post), que e onde a equipe realmente trabalha. O modulo antigo de posts sociais
// (social_posts, ligado a Meta) esta vazio e fica fora disto.
const db = supabase as any;

export type { SituacaoDoPost, AprovacaoDoPost };

export interface PostDoFeed {
  cardId: string;
  titulo: string;
  data: string | null; // YYYY-MM-DD
  plataforma: string | null;
  tipo: string | null;
  linkDoPost: string | null;
  situacao: SituacaoDoPost;
  etapa: string | null;
  aprovacao: AprovacaoDoPost;
  miniatura: string | null;
}

const CAMPOS = ['post_date', 'platform', 'piece_type', 'post_link'];

/**
 * Posts de um cliente: todos os cards abertos do cliente que tem algum campo social preenchido.
 * Separa quem tem data (entra no ciclo do mes) de quem nao tem (gaveta).
 */
export function useFeedEditorial(clienteId: string | null, ano: number, mes0: number) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const q = useQuery({
    queryKey: ['feed-editorial', wsId, clienteId],
    enabled: !!wsId && !!clienteId,
    staleTime: 30_000,
    queryFn: async (): Promise<PostDoFeed[]> => {
      const { data: cards, error } = await db
        .from('cards')
        .select('id, title, status, current_stage')
        .eq('workspace_id', wsId)
        .eq('client_id', clienteId)
        .neq('status', 'archived')
        .limit(400);
      if (error) throw error;
      const lista = (cards ?? []) as { id: string; title: string; status: string; current_stage: string | null }[];
      if (lista.length === 0) return [];
      const ids = lista.map(c => c.id);

      const [campos, anexos, aprovs] = await Promise.all([
        db.from('card_custom_fields').select('card_id, field_key, field_value').in('card_id', ids).in('field_key', CAMPOS),
        db.from('attachments').select('card_id, file_url, file_name, file_type, created_at').in('card_id', ids).order('created_at', { ascending: true }),
        db.from('approval_requests').select('card_id, status, round').in('card_id', ids).order('round', { ascending: false }),
      ]);
      for (const r of [campos, anexos, aprovs]) if (r.error) throw r.error;

      const porCard = new Map<string, Record<string, string>>();
      (campos.data ?? []).forEach((c: any) => {
        const v = (c.field_value ?? '').trim();
        if (!v) return;
        porCard.set(c.card_id, { ...(porCard.get(c.card_id) ?? {}), [c.field_key]: v });
      });

      // primeira imagem de cada card como miniatura
      const primeiraImagem = new Map<string, string>();
      (anexos.data ?? []).forEach((a: any) => {
        const ehImagem = (a.file_type ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(a.file_name ?? '');
        if (ehImagem && !primeiraImagem.has(a.card_id)) primeiraImagem.set(a.card_id, a.file_url);
      });
      const caminhos = [...new Set(primeiraImagem.values())];
      const assinadas = new Map<string, string>();
      if (caminhos.length) {
        const { data: urls } = await supabase.storage.from('attachments').createSignedUrls(caminhos, 3600);
        (urls ?? []).forEach((u: any) => u.path && u.signedUrl && assinadas.set(u.path, u.signedUrl));
      }

      // situacao de aprovacao do pedido mais recente de cada card
      const ultimaAprov = new Map<string, AprovacaoDoPost>();
      (aprovs.data ?? []).forEach((a: any) => {
        if (ultimaAprov.has(a.card_id)) return;
        ultimaAprov.set(a.card_id, a.status === 'pending' ? 'pendente' : a.status === 'approved' ? 'aprovado' : a.status === 'changes_requested' ? 'ajustes' : null);
      });

      return lista
        .filter(c => {
          const f = porCard.get(c.id);
          return !!f && (f.post_date || f.platform || f.piece_type);
        })
        .map(c => {
          const f = porCard.get(c.id)!;
          const aprov = ultimaAprov.get(c.id) ?? null;
          const caminho = primeiraImagem.get(c.id);
          return {
            cardId: c.id,
            titulo: c.title,
            data: dataDoPost(f.post_date),
            plataforma: f.platform ?? null,
            tipo: f.piece_type ?? null,
            linkDoPost: f.post_link ?? null,
            situacao: situacaoDoPost(c.status, c.current_stage, f.post_link ?? null, aprov),
            etapa: c.current_stage,
            aprovacao: aprov,
            miniatura: caminho ? assinadas.get(caminho) ?? null : null,
          } as PostDoFeed;
        });
    },
  });

  const chave = chaveMes(ano, mes0);
  const resultado = useMemo(() => {
    const todos = q.data ?? [];
    const doCiclo = todos.filter(p => p.data && p.data.startsWith(chave)).sort((a, b) => (b.data! < a.data! ? -1 : 1)); // mais novo primeiro, como no perfil
    const gaveta = todos.filter(p => !p.data);
    const contagem: Record<SituacaoDoPost, number> = { planejado: 0, em_producao: 0, em_aprovacao: 0, aprovado: 0, publicado: 0 };
    doCiclo.forEach(p => (contagem[p.situacao] += 1));
    return { doCiclo, gaveta, contagem, total: doCiclo.length };
  }, [q.data, chave]);

  return { ...resultado, carregando: q.isLoading, erro: q.error };
}

/** Clientes ativos para o seletor do feed. */
export function useClientesDoFeed() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['feed-clientes', wsId],
    enabled: !!wsId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('client_cards').select('id, name, logo_url, color').eq('workspace_id', wsId).eq('status', 'active').order('name');
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; logo_url: string | null; color: string | null }[];
    },
  });
}
