import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import type { IdeaReference } from '@/hooks/useIdeaReferences';

export type StatusAnalise = 'para_analisar' | 'analisado' | 'usar';

export const STATUS_ANALISE: { value: StatusAnalise; label: string }[] = [
  { value: 'para_analisar', label: 'Para analisar' },
  { value: 'analisado', label: 'Analisado' },
  { value: 'usar', label: 'Usar em campanha' },
];

export const rotuloStatus = (s?: string | null) =>
  STATUS_ANALISE.find(x => x.value === s)?.label ?? 'Para analisar';

export type FiltroPlataforma = 'todas' | 'tiktok' | 'instagram' | 'youtube' | 'outros';

export interface FiltrosFeed {
  busca: string;
  plataforma: FiltroPlataforma;
  boardId: string | 'todas';
  autorId: string | 'todos';
  status: StatusAnalise | 'todos';
  favoritas: boolean;
}

export const FILTROS_PADRAO: FiltrosFeed = {
  busca: '',
  plataforma: 'todas',
  boardId: 'todas',
  autorId: 'todos',
  status: 'todos',
  favoritas: false,
};

export interface PessoaFeed {
  id: string;
  nome: string;
  avatar: string | null;
}

const TAMANHO_PAGINA = 36;

/**
 * Feed de referências: tudo o que a equipe salvou, de todas as pastas, do mais novo para o mais antigo.
 *
 * Os filtros rodam no banco (com paginação), então o feed continua leve quando crescer. Quem salvou
 * vem de uma segunda consulta a `profiles`: created_by aponta para auth.users, não para profiles,
 * então o PostgREST não consegue embutir a relação.
 */
export function useIdeaFeed(f: FiltrosFeed) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const lista = useInfiniteQuery({
    queryKey: ['idea-feed', workspaceId, f],
    enabled: !!workspaceId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = (supabase as any)
        .from('idea_references')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + TAMANHO_PAGINA - 1);

      if (f.plataforma === 'outros') q = q.is('platform', null);
      else if (f.plataforma !== 'todas') q = q.eq('platform', f.plataforma);
      if (f.boardId !== 'todas') q = q.eq('board_id', f.boardId);
      if (f.autorId !== 'todos') q = q.eq('created_by', f.autorId);
      if (f.status !== 'todos') q = q.eq('review_status', f.status);
      if (f.favoritas) q = q.eq('is_favorite', true);

      const termo = f.busca.trim().replace(/[%,()]/g, ' ');
      if (termo) {
        q = q.or(`title.ilike.%${termo}%,description.ilike.%${termo}%,author_name.ilike.%${termo}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as IdeaReference[];
    },
    getNextPageParam: (ultima, todas) =>
      ultima.length < TAMANHO_PAGINA ? undefined : todas.length * TAMANHO_PAGINA,
  });

  const itens = (lista.data?.pages ?? []).flat();

  // Quem salvou cada item (nome e foto), numa consulta só para os autores presentes na tela.
  const idsAutores = [...new Set(itens.map(i => i.created_by).filter(Boolean) as string[])].sort();
  const pessoas = useQuery({
    queryKey: ['idea-feed-pessoas', idsAutores.join(',')],
    enabled: idsAutores.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, email').in('id', idsAutores);
      const mapa: Record<string, PessoaFeed> = {};
      (data ?? []).forEach((p: any) => {
        mapa[p.id] = { id: p.id, nome: p.full_name || p.email || 'Membro', avatar: p.avatar_url ?? null };
      });
      return mapa;
    },
  });

  return { ...lista, itens, pessoas: pessoas.data ?? {} };
}

/** Totais por plataforma e status para os atalhos do topo (uma consulta leve, sem trazer o conteúdo). */
export function useIdeaFeedTotais() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['idea-feed-totais', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('idea_references')
        .select('platform, review_status, is_favorite, created_by')
        .eq('workspace_id', workspaceId!)
        .is('archived_at', null)
        .limit(5000);
      if (error) throw error;
      const linhas = (data ?? []) as { platform: string | null; review_status: string; is_favorite: boolean; created_by: string | null }[];
      return {
        total: linhas.length,
        favoritas: linhas.filter(l => l.is_favorite).length,
        porStatus: {
          para_analisar: linhas.filter(l => l.review_status === 'para_analisar').length,
          analisado: linhas.filter(l => l.review_status === 'analisado').length,
          usar: linhas.filter(l => l.review_status === 'usar').length,
        } as Record<StatusAnalise, number>,
        porPlataforma: {
          tiktok: linhas.filter(l => l.platform === 'tiktok').length,
          instagram: linhas.filter(l => l.platform === 'instagram').length,
          youtube: linhas.filter(l => l.platform === 'youtube').length,
          outros: linhas.filter(l => !l.platform).length,
        },
        autores: [...new Set(linhas.map(l => l.created_by).filter(Boolean) as string[])],
      };
    },
  });
}

/** Troca o status de análise de uma referência e atualiza feed, totais e a pasta de origem. */
export function useMudarStatusAnalise() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusAnalise }) => {
      const { error } = await (supabase as any).from('idea_references').update({ review_status: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-feed'] });
      qc.invalidateQueries({ queryKey: ['idea-feed-totais'] });
      qc.invalidateQueries({ queryKey: ['idea-references'] });
    },
    onError: (e: any) => toast({ title: 'Não foi possível mudar o status', description: e.message, variant: 'destructive' }),
  });
}
