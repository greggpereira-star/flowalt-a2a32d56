import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

export interface ClientWorkflowMetric {
  clientId: string;
  clientName: string;
  clientColor: string | null;
  clientStatus: string;
  // Card counts
  totalCards: number;
  backlogCards: number;
  inProgressCards: number;
  deliveredCards: number;
  overdueCards: number;
  // Time metrics
  totalEstimatedHours: number;
  totalActualHours: number;
  hoursVariance: number; // positive = under, negative = over
  hoursVariancePercent: number;
  // Performance
  avgLeadTimeDays: number;
  avgCycleTimeDays: number;
  deliveryRate: number; // delivered / total
  onTimeDeliveryRate: number; // delivered on time / delivered
  // Health score (0-100)
  healthScore: number;
}

export interface ClientWorkflowSummary {
  totalClients: number;
  activeClients: number;
  avgHealthScore: number;
  totalCards: number;
  totalDelivered: number;
  totalOverdue: number;
  avgHoursVariance: number;
  clientMetrics: ClientWorkflowMetric[];
}

export const useClientWorkflowMetrics = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['client-workflow-metrics', currentWorkspace?.id],
    queryFn: async (): Promise<ClientWorkflowSummary | null> => {
      if (!currentWorkspace?.id) return null;

      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const now = new Date();

      // Fetch client cards
      const { data: clientCards, error: clientsError } = await supabase
        .from('client_cards')
        .select('id, name, color, status, legacy_client_id')
        .eq('workspace_id', currentWorkspace.id);

      if (clientsError) throw clientsError;

      // Also get legacy clients for mapping
      const { data: clients, error: legacyError } = await supabase
        .from('clients')
        .select('id, name, color')
        .eq('workspace_id', currentWorkspace.id);

      if (legacyError) throw legacyError;

      // Fetch all cards with client association
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, title, status, client_id, due_date, created_at, completed_at, estimated_hours, actual_hours, current_stage')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived');

      if (cardsError) throw cardsError;

      // Fetch time entries for the month
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('card_id, duration_seconds')
        .eq('workspace_id', currentWorkspace.id)
        .gte('started_at', monthStart.toISOString())
        .lte('started_at', monthEnd.toISOString());

      if (timeError) throw timeError;

      // Create time entries map by card
      const timeByCard: Record<string, number> = {};
      timeEntries?.forEach(entry => {
        timeByCard[entry.card_id] = (timeByCard[entry.card_id] || 0) + (entry.duration_seconds / 3600);
      });

      // Calculate metrics for each client
      const clientMetrics: ClientWorkflowMetric[] = [];

      // Process both client_cards and legacy clients
      const allClients = [
        ...clientCards.map(cc => ({
          id: cc.legacy_client_id || cc.id,
          name: cc.name,
          color: cc.color,
          status: cc.status,
          isClientCard: true,
        })),
        ...clients.filter(c => !clientCards.some(cc => cc.legacy_client_id === c.id)).map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          status: 'active',
          isClientCard: false,
        })),
      ];

      for (const client of allClients) {
        const clientCards = cards?.filter(c => c.client_id === client.id) || [];
        
        if (clientCards.length === 0) continue;

        const backlogCards = clientCards.filter(c => c.status === 'backlog').length;
        const inProgressCards = clientCards.filter(c => c.status === 'in_progress').length;
        const deliveredCards = clientCards.filter(c => c.status === 'delivered').length;
        const overdueCards = clientCards.filter(c => 
          c.due_date && new Date(c.due_date) < now && c.status !== 'delivered' && c.status !== 'approved'
        ).length;

        // Calculate hours
        const totalEstimatedHours = clientCards.reduce((sum, c) => sum + (c.estimated_hours || 0), 0);
        const totalActualHours = clientCards.reduce((sum, c) => {
          const cardTime = timeByCard[c.id] || 0;
          return sum + Math.max(c.actual_hours || 0, cardTime);
        }, 0);
        const hoursVariance = totalEstimatedHours - totalActualHours;
        const hoursVariancePercent = totalEstimatedHours > 0 
          ? Math.round((hoursVariance / totalEstimatedHours) * 100)
          : 0;

        // Calculate lead time and cycle time
        const completedCards = clientCards.filter(c => c.completed_at);
        const leadTimes: number[] = [];
        const cycleTimes: number[] = [];

        completedCards.forEach(card => {
          if (card.completed_at) {
            const leadTime = differenceInDays(new Date(card.completed_at), new Date(card.created_at));
            leadTimes.push(leadTime);
            // Cycle time approximation (would need stage history for exact)
            cycleTimes.push(Math.max(1, leadTime * 0.7));
          }
        });

        const avgLeadTimeDays = leadTimes.length > 0
          ? Math.round((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) * 10) / 10
          : 0;
        const avgCycleTimeDays = cycleTimes.length > 0
          ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
          : 0;

        // Delivery rates
        const deliveryRate = clientCards.length > 0
          ? Math.round((deliveredCards / clientCards.length) * 100)
          : 0;

        const onTimeDelivered = completedCards.filter(c => 
          c.due_date && c.completed_at && new Date(c.completed_at) <= new Date(c.due_date)
        ).length;
        const onTimeDeliveryRate = deliveredCards > 0
          ? Math.round((onTimeDelivered / deliveredCards) * 100)
          : 100;

        // Calculate health score (0-100)
        let healthScore = 100;
        
        // Penalize for overdue cards (up to -30)
        const overdueRatio = clientCards.length > 0 ? overdueCards / clientCards.length : 0;
        healthScore -= Math.min(30, overdueRatio * 100);
        
        // Penalize for hours over budget (up to -25)
        if (hoursVariancePercent < 0) {
          healthScore -= Math.min(25, Math.abs(hoursVariancePercent) / 2);
        }
        
        // Penalize for low on-time delivery (up to -25)
        if (deliveredCards > 0) {
          healthScore -= Math.max(0, (100 - onTimeDeliveryRate) / 4);
        }
        
        // Penalize for high lead time (up to -20)
        if (avgLeadTimeDays > 14) {
          healthScore -= Math.min(20, (avgLeadTimeDays - 14) * 2);
        }

        healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

        clientMetrics.push({
          clientId: client.id,
          clientName: client.name,
          clientColor: client.color,
          clientStatus: client.status,
          totalCards: clientCards.length,
          backlogCards,
          inProgressCards,
          deliveredCards,
          overdueCards,
          totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
          totalActualHours: Math.round(totalActualHours * 10) / 10,
          hoursVariance: Math.round(hoursVariance * 10) / 10,
          hoursVariancePercent,
          avgLeadTimeDays,
          avgCycleTimeDays,
          deliveryRate,
          onTimeDeliveryRate,
          healthScore,
        });
      }

      // Sort by health score (lowest first to highlight issues)
      clientMetrics.sort((a, b) => a.healthScore - b.healthScore);

      // Calculate summary
      const activeClients = clientMetrics.filter(c => c.clientStatus === 'active');
      
      return {
        totalClients: clientMetrics.length,
        activeClients: activeClients.length,
        avgHealthScore: clientMetrics.length > 0
          ? Math.round(clientMetrics.reduce((sum, c) => sum + c.healthScore, 0) / clientMetrics.length)
          : 100,
        totalCards: clientMetrics.reduce((sum, c) => sum + c.totalCards, 0),
        totalDelivered: clientMetrics.reduce((sum, c) => sum + c.deliveredCards, 0),
        totalOverdue: clientMetrics.reduce((sum, c) => sum + c.overdueCards, 0),
        avgHoursVariance: clientMetrics.length > 0
          ? Math.round(clientMetrics.reduce((sum, c) => sum + c.hoursVariancePercent, 0) / clientMetrics.length)
          : 0,
        clientMetrics,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });
};
