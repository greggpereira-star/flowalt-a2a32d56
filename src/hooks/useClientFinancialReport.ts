import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ClientFinancialState } from './useClientCards';

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

// Calculate financial state based on margins and profitability
function calculateFinancialState(
  profitMargin: number,
  expectedMargin: number | null,
  hoursEfficiency: number
): ClientFinancialState {
  const targetMargin = expectedMargin || 30; // Default 30% margin
  
  if (profitMargin >= targetMargin) {
    return 'healthy';
  } else if (profitMargin >= targetMargin * 0.7) {
    return 'attention';
  } else if (profitMargin >= 0) {
    return 'critical';
  }
  return 'loss';
}

// Calculate health score (0-100)
function calculateHealthScore(
  taskCompletionRate: number,
  hoursEfficiency: number,
  profitMargin: number,
  expectedMargin: number | null
): number {
  const targetMargin = expectedMargin || 30;
  
  // Weights for each component
  const taskWeight = 0.25;
  const hoursWeight = 0.25;
  const marginWeight = 0.50;
  
  // Task completion score (0-100)
  const taskScore = Math.min(taskCompletionRate, 100);
  
  // Hours efficiency score (100 = on budget, less is better but cap at 50)
  const hoursScore = hoursEfficiency <= 100 
    ? 100 - Math.abs(100 - hoursEfficiency) * 0.5
    : Math.max(0, 100 - (hoursEfficiency - 100));
  
  // Margin score (based on target margin)
  let marginScore = 0;
  if (profitMargin >= targetMargin) {
    marginScore = 100;
  } else if (profitMargin >= 0) {
    marginScore = (profitMargin / targetMargin) * 100;
  } else {
    marginScore = Math.max(0, 50 + profitMargin); // Negative margins drop score fast
  }
  
  const finalScore = (taskScore * taskWeight) + (hoursScore * hoursWeight) + (marginScore * marginWeight);
  
  return Math.round(Math.min(100, Math.max(0, finalScore)));
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

      // Get cards linked to this client (via legacy_client or direct)
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .or(`client_id.eq.${clientCard.legacy_client_id || 'null'}`);

      // Also try matching by client name in older integrations
      const { data: legacyCards } = await supabase
        .from('cards')
        .select('*, clients!inner(id)')
        .eq('workspace_id', currentWorkspace.id)
        .eq('clients.id', clientCard.legacy_client_id || '');

      const allCards = [...(cards || []), ...(legacyCards || [])];
      const cardIds = [...new Set(allCards.map(c => c.id))];

      // Get time entries for these cards
      const { data: timeEntries } = cardIds.length > 0 
        ? await supabase
            .from('time_entries')
            .select('*')
            .in('card_id', cardIds)
        : { data: [] };

      // Get transactions for these cards
      const { data: transactions } = cardIds.length > 0
        ? await supabase
            .from('transactions')
            .select('*')
            .in('card_id', cardIds)
        : { data: [] };

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

      // Calculate metrics
      const now = new Date();
      const totalTasks = allCards.length;
      const completedTasks = allCards.filter(c => c.status === 'delivered').length;
      const inProgressTasks = allCards.filter(c => c.status === 'todo' || c.status === 'review').length;
      const overduesTasks = allCards.filter(c => 
        c.due_date && new Date(c.due_date) < now && c.status !== 'delivered' && c.status !== 'archived'
      ).length;
      const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Time metrics
      const totalHours = (timeEntries || []).reduce((acc, e) => acc + (e.duration_seconds / 3600), 0);
      const estimatedHours = allCards.reduce((acc, c) => acc + (c.estimated_hours || 0), 0);
      const hoursEfficiency = estimatedHours > 0 ? (totalHours / estimatedHours) * 100 : 100;

      // Financial metrics
      const totalRevenue = (transactions || [])
        .filter(t => t.type === 'income' && t.status === 'paid')
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const totalExpenses = (transactions || [])
        .filter(t => t.type === 'expense' && t.status === 'paid')
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const laborCost = (timeEntries || []).reduce((acc, e) => {
        const rate = profileRates[e.user_id] || 50;
        return acc + (e.duration_seconds / 3600) * rate;
      }, 0);

      const profit = totalRevenue - totalExpenses - laborCost;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      // Contract metrics
      const financials = Array.isArray(clientCard.client_financials) 
        ? clientCard.client_financials[0] 
        : clientCard.client_financials;
      const contractValue = financials?.contract_value || null;
      const consumedValue = totalExpenses + laborCost;
      const remainingValue = contractValue ? contractValue - consumedValue : null;

      // Calculate states
      const financialState = calculateFinancialState(
        profitMargin, 
        financials?.expected_margin, 
        hoursEfficiency
      );
      
      const healthScore = calculateHealthScore(
        taskCompletionRate,
        hoursEfficiency,
        profitMargin,
        financials?.expected_margin
      );

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

      // Update client card with calculated metrics
      await supabase
        .from('client_cards')
        .update({ 
          health_score: healthScore, 
          financial_state: financialState 
        })
        .eq('id', clientCardId);

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
