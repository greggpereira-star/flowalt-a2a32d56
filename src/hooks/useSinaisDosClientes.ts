import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRodadasDeAjuste } from '@/hooks/useRodadasDeAjuste';
import { STATUS_ENCERRADOS } from '@/lib/metrics/definicoes';
import { sinaisPorCliente, type AprovacaoDoCliente, type CardDoCliente } from '@/lib/inteligencia/saude-operacional';

// approval_requests ainda não está nos tipos gerados; mesmo contorno de hooks/useApprovals.
const db = supabase as any;

/** Sinais de operação por cliente (aprovações, rodadas, entregas), para a lista de Clientes. Regras em lib/inteligencia. */
export function useSinaisDosClientes(ativo: boolean) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  const { data: ajustes } = useRodadasDeAjuste(ativo);

  return useQuery({
    queryKey: ['sinais-clientes', wsId, ajustes?.rodadas.size ?? 0, ajustes?.limitePorCliente.size ?? 0],
    enabled: ativo && !!wsId && !!ajustes,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [cardsR, aprovR] = await Promise.all([
        supabase
          .from('cards')
          .select('id, client_id, status, completed_at')
          .eq('workspace_id', wsId!)
          .not('client_id', 'is', null)
          .limit(1000),
        db
          .from('approval_requests')
          .select('client_id, card_id, status, created_at, decided_at')
          .eq('workspace_id', wsId!)
          .limit(1000),
      ]);
      if (cardsR.error) throw cardsR.error;
      if (aprovR.error) throw aprovR.error;
      return sinaisPorCliente({
        agora: new Date(),
        cards: (cardsR.data ?? []) as CardDoCliente[],
        aprovacoes: (aprovR.data ?? []) as AprovacaoDoCliente[],
        rodadas: ajustes!.rodadas,
        limitePorCliente: ajustes!.limitePorCliente,
        encerrados: STATUS_ENCERRADOS,
      });
    },
  });
}
