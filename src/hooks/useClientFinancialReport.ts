import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { ClientFinancialState } from './useClientCards';
import { computeClientMetrics } from './clientMetrics';

export interface ClientFinancialReport {
  clientId: string;
  clientName: string;
  clientColor: string | null;
  
  // Task metrics
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overduesTasks: number;
  taskCompletionRate: number;
  
  // Time metrics
  totalHours: number;
  estimatedHours: number;
  hoursEfficiency: number; // estimated vs actual
  
  // Financial metrics
  totalRevenue: number;
  totalExpenses: number;
  laborCost: number;
  profit: number;
  profitMargin: number;
  
  // Contract metrics
  contractValue: number | null;
  consumedValue: number; // How much of contract was consumed
  remainingValue: number | null;
  
  // Calculated state
  financialState: ClientFinancialState;
  healthScore: number;
  
  // Period breakdown
  monthlyBreakdown: {
    month: string;
    revenue: number;
    expenses: number;
    hours: number;
    tasksCompleted: number;
  }[];
}

// Hook to get comprehensive financial report for a client
export const useClientFinancialReport = (clientCardId: string | undefined) => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['client-financial-report', clientCardId],
    queryFn: async () => {
      if (!clientCardId || !currentWorkspace?.id) return null;

      // Fetch client card with financials
      const { data: clientCard, error: clientError } = await supabase
        .from('client_cards')
        .select('*, client_financials(*)')
        .eq('id', clientCardId)
        .single();

      if (clientError) throw clientError;

      // `cards.client_id` aponta para `client_cards.id` — é o vínculo real e
      // resolve os 172 cards com cliente. A busca anterior usava
      // `legacy_client_id`, que está NULO em todos os clientes, então a
      // condição virava `client_id.eq.null` e o relatório inteiro (receita,
      // horas, margem, health score) era calculado sobre ZERO cards. Um
      // cliente com 81 cards aparecia sem nenhum.
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('client_id', clientCard.id);

      if (cardsError) throw cardsError;

      // Integrações antigas podiam apontar para a tabela `clients` via
      // legacy_client_id. Só consulta quando esse campo existe de fato —
      // passar string vazia fazia o Postgres recusar a comparação com uuid.
      const legacyClientId = clientCard.legacy_client_id;
      const { data: legacyCards } = legacyClientId
        ? await supabase
            .from('cards')
            .select('*')
            .eq('workspace_id', currentWorkspace.id)
            .eq('client_id', legacyClientId)
        : { data: [] as typeof cards };

      const allCards = [...(cards || []), ...(legacyCards || [])];
      const cardIds = [...new Set(allCards.map(c => c.id))];

      // Get time entries for these cards
      const { data: timeEntries } = cardIds.length > 0 
        ? await supabase
            .from('time_entries')
            .select('*')
            .in('card_id', cardIds)
        : { data: [] };

      // `transactions.client_id` aponta para `client_cards.id` e é o vínculo que
      // o financeiro realmente preenche: das 254 transações da workspace, 40 têm
      // client_id e ZERO têm card_id. Buscar só por `card_id` fazia toda
      // transação ficar de fora, e o relatório dava receita 0 para todo mundo —
      // inclusive para clientes com R$ 46 mil pagos. Pior: esse zero era
      // persistido em client_cards.health_score, então o erro vazava do
      // relatório para o semáforo do dashboard (essa escrita já não existe).
      // Mantemos card_id no OR porque é vínculo válido no schema (transação
      // lançada a partir de um card), só não usado ainda.
      const orFilter = [
        `client_id.eq.${clientCard.id}`,
        ...(cardIds.length > 0 ? [`card_id.in.(${cardIds.join(',')})`] : []),
      ].join(',');

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .or(orFilter);

      // Get profiles for hourly rates
      const userIds = [...new Set((timeEntries || []).map(e => e.user_id))];
      let profileRates: Record<string, number> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, hourly_rate')
          .in('id', userIds);
        
        profiles?.forEach(p => {
          profileRates[p.id] = p.hourly_rate || 50;
        });
      }

      const financials = Array.isArray(clientCard.client_financials)
        ? clientCard.client_financials[0]
        : clientCard.client_financials;

      const {
        totalTasks,
        completedTasks,
        inProgressTasks,
        overduesTasks,
        taskCompletionRate,
        totalHours,
        estimatedHours,
        hoursEfficiency,
        totalRevenue,
        totalExpenses,
        laborCost,
        profit,
        profitMargin,
        contractValue,
        consumedValue,
        remainingValue,
        financialState,
        healthScore,
      } = computeClientMetrics({
        cards: allCards,
        timeEntries: timeEntries || [],
        transactions: transactions || [],
        profileRates,
        contractValue: financials?.contract_value ?? null,
        expectedMargin: financials?.expected_margin ?? null,
      });

      // Monthly breakdown (last 6 months)
      const months: { month: string; revenue: number; expenses: number; hours: number; tasksCompleted: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7); // YYYY-MM
        
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthTransactions = (transactions || []).filter(t => {
          const tDate = new Date(t.due_date);
          return tDate >= monthStart && tDate <= monthEnd;
        });

        const monthTimeEntries = (timeEntries || []).filter(e => {
          const eDate = new Date(e.started_at);
          return eDate >= monthStart && eDate <= monthEnd;
        });

        const monthCards = allCards.filter(c => {
          if (!c.completed_at) return false;
          const cDate = new Date(c.completed_at);
          return cDate >= monthStart && cDate <= monthEnd;
        });

        months.push({
          month: monthStr,
          revenue: monthTransactions
            .filter(t => t.type === 'income' && t.status === 'paid')
            .reduce((acc, t) => acc + Number(t.amount), 0),
          expenses: monthTransactions
            .filter(t => t.type === 'expense' && t.status === 'paid')
            .reduce((acc, t) => acc + Number(t.amount), 0),
          hours: monthTimeEntries.reduce((acc, e) => acc + (e.duration_seconds / 3600), 0),
          tasksCompleted: monthCards.length,
        });
      }

      // Nada é persistido de volta em client_cards. As colunas health_score e
      // financial_state eram um cache escrito exatamente aqui — o que fazia o
      // número existir apenas para clientes cujo relatório alguém tinha aberto,
      // e ficar no DEFAULT 100 para os demais. Dashboard, lista e este relatório
      // agora calculam pelo mesmo caminho (computeClientMetrics), então não há
      // segunda cópia para envelhecer.

      const report: ClientFinancialReport = {
        clientId: clientCardId,
        clientName: clientCard.name,
        clientColor: clientCard.color,
        
        totalTasks,
        completedTasks,
        inProgressTasks,
        overduesTasks,
        taskCompletionRate,
        
        totalHours,
        estimatedHours,
        hoursEfficiency,
        
        totalRevenue,
        totalExpenses,
        laborCost,
        profit,
        profitMargin,
        
        contractValue,
        consumedValue,
        remainingValue,
        
        financialState,
        healthScore,
        
        monthlyBreakdown: months,
      };

      return report;
    },
    enabled: !!clientCardId && !!currentWorkspace?.id,
  });
};

// Hook to update client financial state and health score in DB
export const useUpdateClientMetrics = () => {
  // This would be called after report is calculated to persist state
  // The actual update happens via the report hook
};
