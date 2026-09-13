import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { computeClientMetrics } from './clientMetrics';
import { usePermissions } from './usePermissions';
import type { ClientFinancialState } from './useClientCards';

export interface ClientHealth {
  clientId: string;
  healthScore: number;
  financialState: ClientFinancialState;
  totalRevenue: number;
  totalHours: number;
  profitMargin: number;
}

/**
 * Saúde de todos os clientes da workspace, calculada na hora.
 *
 * Por que existe: `client_cards.health_score` é uma coluna com DEFAULT 100 que
 * só era reescrita quando alguém abria o relatório de um cliente específico.
 * Cliente nunca aberto ficava com 100 e liderava o dashboard como o mais
 * saudável — foi exatamente o caso de um cliente com 0 cards e 0 transações.
 * Recalcular ao abrir a tela é o único jeito de o número não depender de
 * alguém ter passado por lá antes.
 *
 * Faz 5 consultas no total, não 5 por cliente: puxa cards, apontamentos e
 * transações da workspace de uma vez e agrupa em memória. O cálculo em si é
 * `computeClientMetrics`, a mesma função que o relatório individual usa, para
 * que dashboard, lista e relatório nunca discordem.
 *
 * Nota de escala: depende do teto de linhas do PostgREST (1000 por padrão).
 * Nas ordens de grandeza atuais da workspace (centenas de cards e transações)
 * não há truncamento; se a base crescer uma ordem, isto precisa paginar.
 */
export const useClientsHealth = () => {
  const { currentWorkspace } = useWorkspace();
  const { canViewClientFinancials } = usePermissions();

  return useQuery({
    queryKey: ['clients-health', currentWorkspace?.id, canViewClientFinancials],
    queryFn: async (): Promise<Map<string, ClientHealth>> => {
      const result = new Map<string, ClientHealth>();
      if (!currentWorkspace?.id) return result;

      const { data: clients, error: clientsError } = await supabase
        .from('client_cards')
        .select('id, client_financials(contract_value, expected_margin)')
        .eq('workspace_id', currentWorkspace.id);

      if (clientsError) throw clientsError;
      if (!clients?.length) return result;

      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, client_id, status, due_date, estimated_hours')
        .eq('workspace_id', currentWorkspace.id)
        .not('client_id', 'is', null);

      if (cardsError) throw cardsError;

      const cardIds = (cards || []).map(c => c.id);
      const clientIdByCard = new Map((cards || []).map(c => [c.id, c.client_id as string]));

      const { data: timeEntries } = cardIds.length > 0
        ? await supabase
            .from('time_entries')
            .select('card_id, user_id, duration_seconds')
            .in('card_id', cardIds)
        : { data: [] };

      const { data: transactions } = await supabase
        .from('transactions')
        .select('client_id, card_id, type, status, amount')
        .eq('workspace_id', currentWorkspace.id);

      const userIds = [...new Set((timeEntries || []).map(e => e.user_id))];
      const profileRates: Record<string, number> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, hourly_rate')
          .in('id', userIds);
        profiles?.forEach(p => {
          profileRates[p.id] = p.hourly_rate || 50;
        });
      }

      // Agrupa por cliente. Uma transação conta para o cliente quando aponta
      // direto para ele (client_id) ou através de um card dele (card_id) — os
      // dois vínculos que o relatório individual considera.
      const cardsByClient = new Map<string, typeof cards>();
      for (const card of cards || []) {
        const key = card.client_id as string;
        if (!cardsByClient.has(key)) cardsByClient.set(key, []);
        cardsByClient.get(key)!.push(card);
      }

      const entriesByClient = new Map<string, Array<{ user_id: string; duration_seconds: number }>>();
      for (const entry of timeEntries || []) {
        const key = clientIdByCard.get(entry.card_id as string);
        if (!key) continue;
        if (!entriesByClient.has(key)) entriesByClient.set(key, []);
        entriesByClient.get(key)!.push(entry);
      }

      const txByClient = new Map<string, Array<{ type: string; status: string; amount: number }>>();
      for (const tx of transactions || []) {
        const key = (tx.client_id as string | null)
          ?? (tx.card_id ? clientIdByCard.get(tx.card_id as string) : undefined);
        if (!key) continue;
        if (!txByClient.has(key)) txByClient.set(key, []);
        txByClient.get(key)!.push(tx as any);
      }

      for (const client of clients) {
        const financials = Array.isArray(client.client_financials)
          ? client.client_financials[0]
          : client.client_financials;

        const metrics = computeClientMetrics({
          cards: cardsByClient.get(client.id) || [],
          timeEntries: entriesByClient.get(client.id) || [],
          transactions: txByClient.get(client.id) || [],
          profileRates,
          contractValue: financials?.contract_value ?? null,
          expectedMargin: financials?.expected_margin ?? null,
        });

        result.set(client.id, {
          clientId: client.id,
          healthScore: metrics.healthScore,
          financialState: metrics.financialState,
          totalRevenue: metrics.totalRevenue,
          totalHours: metrics.totalHours,
          profitMargin: metrics.profitMargin,
        });
      }

      return result;
    },
    // Só calcula para quem enxerga `transactions`. A RLS dessa tabela exige
    // admin, papel finance ou can_view_financials — 5 dos 11 membros desta
    // workspace não passam. Para eles a consulta voltaria sem transação
    // nenhuma, a margem daria 0 e TODO cliente apareceria como crítico. Sem
    // permissão, preferimos não exibir score a exibir um score falso.
    enabled: !!currentWorkspace?.id && canViewClientFinancials,
  });
};
