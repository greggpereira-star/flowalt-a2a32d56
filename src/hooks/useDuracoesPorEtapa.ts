import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { duracoesPorEtapa, type Transicao } from '@/lib/inteligencia/risco';

// Janela do histórico usado na mediana: seis meses cobrem o ritmo normal sem arrastar processos antigos.
const DIAS_HISTORICO = 180;

/** Tempo histórico em cada etapa (dias por passagem), para o radar de risco comparar o card com o normal. */
export function useDuracoesPorEtapa(ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['duracoes-etapa', wsId],
    enabled: ativo && !!wsId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - DIAS_HISTORICO * 86_400_000).toISOString();
      const linhas: Transicao[] = [];
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
      return duracoesPorEtapa(linhas);
    },
  });
}
