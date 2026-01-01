import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDefaultWorkflow, useWorkflowStages } from './useWorkflow';
import { differenceInHours, differenceInDays, startOfWeek, endOfWeek } from 'date-fns';

export interface StageMetrics {
  stageId: string;
  stageName: string;
  stageSlug: string;
  stageColor: string;
  sortOrder: number;
  // Counts
  currentCount: number;
  completedThisWeek: number;
  // Time metrics
  avgTimeInStageHours: number;
  avgTimeInStageDays: number;
  medianTimeInStageHours: number;
  // SLA
  withinSLA: number;
  breachedSLA: number;
  slaCompliancePercent: number;
  // WIP
  wipLimit: number | null;
  isOverWip: boolean;
}

export interface WorkflowMetricsSummary {
  totalCards: number;
  totalCompletedThisWeek: number;
  avgCycleTimeDays: number;
  avgLeadTimeDays: number;
  throughputPerWeek: number;
  wipTotal: number;
  blockedCount: number;
  stageMetrics: StageMetrics[];
}

export const useWorkflowMetrics = () => {
  const { currentWorkspace } = useWorkspace();
  const { data: defaultWorkflow } = useDefaultWorkflow();
  const { data: stages } = useWorkflowStages(defaultWorkflow?.id);

  return useQuery({
    queryKey: ['workflow-metrics', currentWorkspace?.id, defaultWorkflow?.id],
    queryFn: async (): Promise<WorkflowMetricsSummary | null> => {
      if (!currentWorkspace?.id || !defaultWorkflow?.id || !stages?.length) {
        return null;
      }

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

      // Fetch all active cards
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, status, current_stage, stage_entered_at, created_at, completed_at, workflow_id')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived');

      if (cardsError) throw cardsError;

      // Fetch stage history for time calculations
      const { data: stageHistory, error: historyError } = await supabase
        .from('card_stage_history')
        .select('*')
        .eq('workflow_id', defaultWorkflow.id)
        .order('created_at', { ascending: true });

      if (historyError) throw historyError;

      // Calculate stage metrics
      const stageMetrics: StageMetrics[] = stages.map(stage => {
        // Cards currently in this stage
        const cardsInStage = cards?.filter(c => 
          c.current_stage === stage.slug || 
          (c.current_stage === stage.id)
        ) || [];

        // Transitions out of this stage (completed)
        const transitionsOut = stageHistory?.filter(h => 
          h.from_stage === stage.slug
        ) || [];

        // Time in stage calculations
        const timeInStageValues: number[] = [];
        
        // For completed transitions, calculate time spent
        transitionsOut.forEach(transition => {
          // Find when this card entered this stage
          const entryTransition = stageHistory?.find(h => 
            h.card_id === transition.card_id && 
            h.to_stage === stage.slug &&
            new Date(h.created_at) < new Date(transition.created_at)
          );
          
          if (entryTransition) {
            const entryTime = new Date(entryTransition.created_at);
            const exitTime = new Date(transition.created_at);
            const hoursInStage = differenceInHours(exitTime, entryTime);
            if (hoursInStage > 0) {
              timeInStageValues.push(hoursInStage);
            }
          }
        });

        // For cards still in stage, calculate time so far
        cardsInStage.forEach(card => {
          if (card.stage_entered_at) {
            const entryTime = new Date(card.stage_entered_at);
            const hoursInStage = differenceInHours(new Date(), entryTime);
            if (hoursInStage > 0) {
              timeInStageValues.push(hoursInStage);
            }
          }
        });

        // Calculate averages
        const avgTimeInStageHours = timeInStageValues.length > 0
          ? timeInStageValues.reduce((a, b) => a + b, 0) / timeInStageValues.length
          : 0;

        // Calculate median
        const sortedTimes = [...timeInStageValues].sort((a, b) => a - b);
        const medianTimeInStageHours = sortedTimes.length > 0
          ? sortedTimes[Math.floor(sortedTimes.length / 2)]
          : 0;

        // SLA calculations
        let withinSLA = 0;
        let breachedSLA = 0;

        if (stage.sla_critical_hours) {
          cardsInStage.forEach(card => {
            if (card.stage_entered_at) {
              const hoursInStage = differenceInHours(new Date(), new Date(card.stage_entered_at));
              if (hoursInStage > stage.sla_critical_hours!) {
                breachedSLA++;
              } else {
                withinSLA++;
              }
            }
          });
        } else {
          withinSLA = cardsInStage.length;
        }

        const slaCompliancePercent = cardsInStage.length > 0
          ? Math.round((withinSLA / cardsInStage.length) * 100)
          : 100;

        // Completed this week (transitioned out this week)
        const completedThisWeek = transitionsOut.filter(t => {
          const transitionDate = new Date(t.created_at);
          return transitionDate >= weekStart && transitionDate <= weekEnd;
        }).length;

        return {
          stageId: stage.id,
          stageName: stage.name,
          stageSlug: stage.slug,
          stageColor: stage.color,
          sortOrder: stage.sort_order,
          currentCount: cardsInStage.length,
          completedThisWeek,
          avgTimeInStageHours: Math.round(avgTimeInStageHours * 10) / 10,
          avgTimeInStageDays: Math.round((avgTimeInStageHours / 24) * 10) / 10,
          medianTimeInStageHours: Math.round(medianTimeInStageHours * 10) / 10,
          withinSLA,
          breachedSLA,
          slaCompliancePercent,
          wipLimit: stage.wip_limit,
          isOverWip: stage.wip_limit ? cardsInStage.length > stage.wip_limit : false,
        };
      }).sort((a, b) => a.sortOrder - b.sortOrder);

      // Calculate summary metrics
      const completedCards = cards?.filter(c => c.status === 'delivered' && c.completed_at) || [];
      const completedThisWeek = completedCards.filter(c => {
        const completedDate = new Date(c.completed_at!);
        return completedDate >= weekStart && completedDate <= weekEnd;
      });

      // Cycle time: time from "in_progress" to "delivered"
      const cycleTimeDays: number[] = [];
      completedCards.forEach(card => {
        // Find when card entered in_progress
        const inProgressEntry = stageHistory?.find(h => 
          h.card_id === card.id && h.to_stage === 'em_producao'
        );
        if (inProgressEntry && card.completed_at) {
          const days = differenceInDays(new Date(card.completed_at), new Date(inProgressEntry.created_at));
          if (days >= 0) cycleTimeDays.push(days);
        }
      });

      const avgCycleTimeDays = cycleTimeDays.length > 0
        ? Math.round((cycleTimeDays.reduce((a, b) => a + b, 0) / cycleTimeDays.length) * 10) / 10
        : 0;

      // Lead time: time from creation to delivery
      const leadTimeDays: number[] = [];
      completedCards.forEach(card => {
        if (card.completed_at) {
          const days = differenceInDays(new Date(card.completed_at), new Date(card.created_at));
          if (days >= 0) leadTimeDays.push(days);
        }
      });

      const avgLeadTimeDays = leadTimeDays.length > 0
        ? Math.round((leadTimeDays.reduce((a, b) => a + b, 0) / leadTimeDays.length) * 10) / 10
        : 0;

      // WIP: cards that are not backlog and not delivered
      const wipCards = cards?.filter(c => 
        c.status !== 'backlog' && c.status !== 'delivered'
      ) || [];

      // Blocked count (cards with dependencies blocking them)
      const { data: deps } = await supabase
        .from('dependencies')
        .select('dependent_card_id, blocking_card_id')
        .eq('workspace_id', currentWorkspace.id);

      const blockedCardIds = new Set<string>();
      deps?.forEach(dep => {
        const blockingCard = cards?.find(c => c.id === dep.blocking_card_id);
        if (blockingCard && blockingCard.status !== 'delivered') {
          blockedCardIds.add(dep.dependent_card_id!);
        }
      });

      return {
        totalCards: cards?.length || 0,
        totalCompletedThisWeek: completedThisWeek.length,
        avgCycleTimeDays,
        avgLeadTimeDays,
        throughputPerWeek: completedThisWeek.length,
        wipTotal: wipCards.length,
        blockedCount: blockedCardIds.size,
        stageMetrics,
      };
    },
    enabled: !!currentWorkspace?.id && !!defaultWorkflow?.id && !!stages?.length,
    refetchInterval: 60000, // Refresh every minute
  });
};

// Hook to get cards that need workflow association
export const useCardsWithoutWorkflow = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['cards-without-workflow', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('cards')
        .select('id, title, status')
        .eq('workspace_id', currentWorkspace.id)
        .neq('status', 'archived')
        .is('workflow_id', null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });
};
