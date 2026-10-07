import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { contarRodadas } from '@/lib/inteligencia/risco';

// approval_requests ainda não está nos tipos gerados; mesmo contorno de hooks/useApprovals.
const db = supabase as any;

/**
 * Rodadas de ajuste já usadas por card e limite contratado por cliente, para o radar de risco.
 * Só busca o histórico se algum cliente tiver limite definido (hoje nenhum tem: nesse caso não custa nada).
 */
export function useRodadasDeAjuste(ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  return useQuery({
    queryKey: ['rodadas-ajuste', wsId],
    enabled: ativo && !!wsId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: clientes, error } = await supabase
        .from('client_cards')
        .select('id, revision_rounds_limit')
        .eq('workspace_id', wsId!)
        .not('revision_rounds_limit', 'is', null);
      if (error) throw error;
      const limitePorCliente = new Map<string, number>((clientes ?? []).map(c => [c.id, c.revision_rounds_limit as number]));
      if (limitePorCliente.size === 0) return { limitePorCliente, rodadas: new Map<string, number>() };

      const [voltasR, ajustesR] = await Promise.all([
        supabase
          .from('card_stage_history')
          .select('card_id, cards!inner(workspace_id)')
          .eq('cards.workspace_id', wsId!)
          .in('from_stage', ['revisao', 'aprovacao'])
          .in('to_stage', ['em_producao', 'planejamento'])
          .limit(1000),
        db
          .from('approval_requests')
          .select('card_id')
          .eq('workspace_id', wsId!)
          .eq('status', 'changes_requested')
          .limit(1000),
      ]);
      if (voltasR.error) throw voltasR.error;
      if (ajustesR.error) throw ajustesR.error;
      return {
        limitePorCliente,
        rodadas: contarRodadas((voltasR.data ?? []) as { card_id: string }[], (ajustesR.data ?? []) as { card_id: string }[]),
      };
    },
  });
}
