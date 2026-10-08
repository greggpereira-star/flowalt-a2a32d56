import React, { useCallback, useState } from 'react';
import { isBriefingSatisfied } from '@/components/cards/briefingDataUtils';
import { statusConfig } from '@/components/cards/CardBadges';
import { TransitionBlockedModal } from '@/components/cards/TransitionBlockedModal';
import { useUpdateCard } from '@/hooks/useCards';
import {
  useDefaultWorkflow,
  useCompleteWorkflow,
  validateTransition,
  useTransitionCard,
  mapStatusToStage,
  type TransitionValidationResult,
} from '@/hooks/useWorkflow';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

/**
 * Troca de etapa de um card com as MESMAS regras do quadro Kanban: valida os gates do fluxo (briefing, checklist,
 * dependências), registra a transição, mostra o aviso de bloqueio e permite forçar com justificativa quem tem papel para isso.
 * A lógica de `attemptTransition` é a mesma do KanbanBoard; qualquer mudança de regra precisa ser feita nos dois.
 */
export function useCardStatusTransition({ aoAbrirCard }: { aoAbrirCard: (card: Card) => void }) {
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const updateCard = useUpdateCard();
  const transitionCard = useTransitionCard();
  const { data: defaultWorkflow } = useDefaultWorkflow();
  const { stages, transitions } = useCompleteWorkflow(defaultWorkflow?.id);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    card: Card;
    fromStage: string;
    toStage: string;
    targetStatus: CardStatus;
    validation: TransitionValidationResult;
  } | null>(null);

  // Validate and attempt transition
  const attemptTransition = useCallback(async (
    card: Card, 
    targetStatus: CardStatus,
    forceReason?: string
  ) => {
    // If no workflow configured, use legacy behavior
    if (!defaultWorkflow || stages.length === 0) {
      await updateCard.mutateAsync({ id: card.id, status: targetStatus });
      toast({
        title: 'Card movido',
        description: `Movido para ${statusConfig[targetStatus].label}`,
      });
      return;
    }

    const fromStage = mapStatusToStage(card.status);
    const toStage = mapStatusToStage(targetStatus);

    // No-op: avoid validating/recording a transition to the same stage
    if (fromStage === toStage) return;

    // Get card checklist progress
    const { data: checklists } = await (await import('@/integrations/supabase/client')).supabase
      .from('checklists')
      .select('is_completed')
      .eq('card_id', card.id);

    const checklistProgress = checklists && checklists.length > 0
      ? Math.round((checklists.filter(c => c.is_completed).length / checklists.length) * 100)
      : 100;

    // Get card dependencies
    const { data: deps } = await (await import('@/integrations/supabase/client')).supabase
      .from('dependencies')
      .select('*, blocking_card:cards!dependencies_blocking_card_id_fkey(status)')
      .eq('dependent_card_id', card.id);

    const hasActiveDependencies = deps?.some(d => 
      (d.blocking_card as any)?.status !== 'delivered'
    ) ?? false;

    // Validate transition
    const validation = await validateTransition({
      cardId: card.id,
      fromStage,
      toStage,
      workflowId: defaultWorkflow.id,
      stages,
      transitions,
      // Deriva do conteúdo do briefing, não da flag. `briefing_completed` é
      // gravada sem nunca olhar o que foi escrito, então liberava para produção
      // card com a flag ligada e briefing vazio, e barrava card com briefing
      // escrito e flag desligada. A regra é a mesma que BriefingDialog cobra
      // para deixar concluir o briefing.
      briefingCompleted: isBriefingSatisfied(card),
      checklistProgress,
      hasActiveDependencies,
      userRole: currentRole || 'member',
    });

    // If forcing with reason, proceed
    if (forceReason && !validation.allowed) {
      await transitionCard.mutateAsync({
        cardId: card.id,
        cardTitle: card.title,
        fromStage,
        toStage,
        workflowId: defaultWorkflow.id,
        transitionType: 'forced',
        reason: forceReason,
        gatesPassed: validation.gates.map(g => g.gate),
        gatesFailed: validation.failedGates.map(g => g.gate),
      });

      // Also update legacy status
      await updateCard.mutateAsync({ id: card.id, status: targetStatus });
      
      toast({
        title: 'Transição forçada',
        description: `Card movido para ${statusConfig[targetStatus].label}`,
        variant: 'default',
      });
      return;
    }

    // If not allowed, show modal and emit blocked event
    if (!validation.allowed) {
      setPendingTransition({
        card,
        fromStage,
        toStage,
        targetStatus,
        validation,
      });
      setBlockModalOpen(true);
      
      // Emit stage.transition_blocked event for EDA
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('workflow_events')
        .insert({
          workspace_id: card.workspace_id,
          event_type: 'stage.transition_blocked',
          entity_type: 'card',
          entity_id: card.id,
          payload: {
            from_stage: fromStage,
            to_stage: toStage,
            failed_gates: validation.failedGates.map(g => ({ gate: g.gate, message: g.message })),
          },
          triggered_by: null, // Will be captured from auth context
        });
      
      return;
    }

    // Transition allowed - proceed
    await transitionCard.mutateAsync({
      cardId: card.id,
      cardTitle: card.title,
      fromStage,
      toStage,
      workflowId: defaultWorkflow.id,
      transitionType: 'normal',
      gatesPassed: validation.gates.map(g => g.gate),
    });

    // Also update legacy status for compatibility
    await updateCard.mutateAsync({ id: card.id, status: targetStatus });
    
    toast({
      title: 'Card movido',
      description: `Movido para ${statusConfig[targetStatus].label}`,
    });
  }, [defaultWorkflow, stages, transitions, currentRole, transitionCard, updateCard, toast]);

  const mudarEtapa = async (card: Card, novaEtapa: CardStatus) => {
    try {
      await attemptTransition(card, novaEtapa);
    } catch (error) {
      toast({ title: 'Erro ao atualizar', description: 'Não foi possível alterar a etapa.', variant: 'destructive' });
    }
  };

  const forcar = async (reason: string) => {
    if (!pendingTransition) return;
    try {
      await attemptTransition(pendingTransition.card, pendingTransition.targetStatus, reason);
    } catch (error) {
      toast({ title: 'Erro ao forçar transição', description: 'Não foi possível completar a transição.', variant: 'destructive' });
    }
  };

  const podeForcar = currentRole === 'owner' || currentRole === 'admin';

  const aviso = (
    <TransitionBlockedModal
      open={blockModalOpen}
      onOpenChange={setBlockModalOpen}
      fromStage={pendingTransition?.fromStage ?? ''}
      toStage={pendingTransition?.toStage ?? ''}
      validation={pendingTransition?.validation ?? null}
      onForceTransition={forcar}
      onFixGate={() => {
        if (pendingTransition) aoAbrirCard(pendingTransition.card);
      }}
      canForce={podeForcar}
    />
  );

  return { mudarEtapa, aviso };
}
