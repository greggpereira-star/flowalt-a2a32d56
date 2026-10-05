import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buscarCards } from '@/hooks/home/useInicioDados';
import type { OpcaoPeriodo } from '@/lib/analytics/metrics';
import {
  calcularCoordenacao,
  type EtapaMin,
  type TransicaoEtapa,
} from '@/lib/dashboard/coordenacao-metrics';

export type PeriodoCoordenacao = Extract<OpcaoPeriodo, '7d' | '30d'>;

export interface PessoaDoTime {
  nome: string;
  avatar: string | null;
}

// Janela do histórico de etapas: período atual (até 30 d) + folga para o tempo em etapa de quem entrou antes.
const DIAS_HISTORICO = 75;

/**
 * Dados do Dashboard da coordenação. Todos os cálculos moram em lib/dashboard/coordenacao-metrics (puros e
 * testados); aqui só se busca: cards (os mesmos do Início), transições de etapa, etapas e pessoas ativas.
 */
export function useDashboardCoordenacao(periodo: PeriodoCoordenacao, espacoId?: string) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  const cardsQ = useQuery({
    queryKey: ['coord-cards', wsId],
    queryFn: () => buscarCards(wsId!),
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const historicoQ = useQuery({
    queryKey: ['coord-historico', wsId],
    enabled: !!wsId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - DIAS_HISTORICO * 86_400_000).toISOString();
      const linhas: TransicaoEtapa[] = [];
      const PAGINA = 1000;
      for (let inicio = 0; ; inicio += PAGINA) {
        const { data, error } = await supabase
          .from('card_stage_history')
          .select('card_id, from_stage, to_stage, created_at, cards!inner(workspace_id)')
          .eq('cards.workspace_id', wsId!)
          .gte('created_at', desde)
          .order('created_at', { ascending: true })
          .range(inicio, inicio + PAGINA - 1);
        if (error) throw error;
        (data ?? []).forEach(l =>
          linhas.push({ card_id: l.card_id, from_stage: l.from_stage, to_stage: l.to_stage, created_at: l.created_at })
        );
        if (!data || data.length < PAGINA) break;
      }
      return linhas;
    },
  });

  const apoioQ = useQuery({
    queryKey: ['coord-apoio', wsId],
    enabled: !!wsId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: etapas }, { data: membros }] = await Promise.all([
        supabase
          .from('workflow_stages')
          .select('slug, name, sort_order, is_final, workflows!inner(workspace_id)')
          .eq('workflows.workspace_id', wsId!),
        supabase.from('workspace_members').select('user_id').eq('workspace_id', wsId!).eq('is_active', true),
      ]);
      const ids = (membros ?? []).map(m => m.user_id);
      const { data: perfis } = ids.length
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
        : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
      const porSlug = new Map<string, EtapaMin>();
      (etapas ?? []).forEach((e: any) => {
        if (!porSlug.has(e.slug)) porSlug.set(e.slug, { slug: e.slug, name: e.name, sort_order: e.sort_order, is_final: !!e.is_final });
      });
      return {
        etapas: [...porSlug.values()],
        pessoas: new Map(
          (perfis ?? []).map(p => [p.id, { nome: p.full_name || 'Membro', avatar: p.avatar_url }] as [string, PessoaDoTime])
        ),
      };
    },
  });

  const resultado = useMemo(() => {
    if (!cardsQ.data || !historicoQ.data || !apoioQ.data) return null;
    return calcularCoordenacao({
      todos: cardsQ.data,
      historico: historicoQ.data,
      etapas: apoioQ.data.etapas,
      agora: new Date(),
      periodo,
      espacoId,
    });
  }, [cardsQ.data, historicoQ.data, apoioQ.data, periodo, espacoId]);

  return {
    resultado,
    pessoas: apoioQ.data?.pessoas ?? new Map<string, PessoaDoTime>(),
    carregando: cardsQ.isLoading || historicoQ.isLoading || apoioQ.isLoading,
    erro: cardsQ.error ?? historicoQ.error ?? apoioQ.error ?? null,
  };
}
