import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { executeStageAutomations } from '@/lib/automationEngine';
import type { Json } from '@/integrations/supabase/types';

// =====================================================
// WORKFLOW BLUEPRINT v1.0 - CORE HOOK
// =====================================================

// Types
export interface Workflow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  version: number;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStage {
  id: string;
  workflow_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  // Configurações
  is_initial: boolean;
  is_final: boolean;
  is_optional: boolean;
  // Gates
  requires_briefing: boolean;
  requires_checklist: boolean;
  requires_no_dependencies: boolean;
  min_checklist_progress: number;
  // WIP Limits
  wip_limit: number | null;
  wip_limit_per_person: number | null;
  // SLA
  sla_warning_hours: number | null;
  sla_critical_hours: number | null;
  // Automações
  allow_auto_transition: boolean;
  allow_auto_checklist: boolean;
  allow_auto_assignment: boolean;
  // Metadados
  created_at: string;
  updated_at: string;
}

export interface WorkflowTransition {
  id: string;
  workflow_id: string;
  from_stage_id: string;
  to_stage_id: string;
  is_forward: boolean;
  is_backward: boolean;
  is_allowed: boolean;
  requires_reason: boolean;
  requires_approval: boolean;
  allowed_roles: string[];
  created_at: string;
}

export interface StageChecklistTemplate {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  default_assignee_role: string | null;
  created_at: string;
}

export interface CardStageHistory {
  id: string;
  card_id: string;
  workflow_id: string;
  from_stage: string | null;
  to_stage: string;
  transition_type: 'normal' | 'forced' | 'auto';
  triggered_by: string | null;
  reason: string | null;
  gates_passed: string[];
  gates_failed: string[];
  time_in_previous_stage: string | null;
  created_at: string;
}

export interface WorkflowEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Json;
  triggered_by: string | null;
  created_at: string;
}

// Gate validation result
export interface GateValidationResult {
  passed: boolean;
  gate: string;
  message: string;
}

export interface TransitionValidationResult {
  allowed: boolean;
  gates: GateValidationResult[];
  failedGates: GateValidationResult[];
  requiresReason: boolean;
  isBackward: boolean;
}

// =====================================================
// HOOKS
// =====================================================

// Fetch all workflows for workspace
export const useWorkflows = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workflows', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Workflow[];
    },
    enabled: !!currentWorkspace?.id,
  });
};

// Fetch default workflow for workspace
export const useDefaultWorkflow = () => {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['workflow', 'default', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as Workflow | null;
    },
    enabled: !!currentWorkspace?.id,
  });
};

// Fetch single workflow
export const useWorkflow = (workflowId: string | undefined) => {
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: async () => {
      if (!workflowId) return null;

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .maybeSingle();

      if (error) throw error;
      return data as Workflow | null;
    },
    enabled: !!workflowId,
  });
};

// Fetch stages for a workflow
export const useWorkflowStages = (workflowId: string | undefined) => {
  return useQuery({
    queryKey: ['workflow-stages', workflowId],
    queryFn: async () => {
      if (!workflowId) return [];

      const { data, error } = await supabase
        .from('workflow_stages')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as WorkflowStage[];
    },
    enabled: !!workflowId,
  });
};

// Fetch transitions for a workflow
export const useWorkflowTransitions = (workflowId: string | undefined) => {
  return useQuery({
    queryKey: ['workflow-transitions', workflowId],
    queryFn: async () => {
      if (!workflowId) return [];

      const { data, error } = await supabase
        .from('workflow_transitions')
        .select('*')
        .eq('workflow_id', workflowId);

      if (error) throw error;
      return data as WorkflowTransition[];
    },
    enabled: !!workflowId,
  });
};

// Fetch stage history for a card
export const useCardStageHistory = (cardId: string | undefined) => {
  return useQuery({
    queryKey: ['card-stage-history', cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from('card_stage_history')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CardStageHistory[];
    },
    enabled: !!cardId,
  });
};

// =====================================================
// GATE VALIDATION
// =====================================================

interface ValidateTransitionParams {
  cardId: string;
  fromStage: string | null;
  toStage: string;
  workflowId: string;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  briefingCompleted: boolean;
  checklistProgress: number; // 0-100
  hasActiveDependencies: boolean;
  userRole: string;
}

export const validateTransition = async (
  params: ValidateTransitionParams
): Promise<TransitionValidationResult> => {
  const {
    fromStage,
    toStage,
    stages,
    transitions,
    briefingCompleted,
    checklistProgress,
    hasActiveDependencies,
    userRole,
  } = params;

  const gates: GateValidationResult[] = [];
  const failedGates: GateValidationResult[] = [];

  // Find target stage
  const targetStage = stages.find(s => s.slug === toStage);
  if (!targetStage) {
    return {
      allowed: false,
      gates: [],
      failedGates: [{ passed: false, gate: 'stage_exists', message: 'Etapa não encontrada no workflow' }],
      requiresReason: false,
      isBackward: false,
    };
  }

  // Find source stage
  const sourceStage = fromStage ? stages.find(s => s.slug === fromStage) : null;

  // Check if transition is allowed
  let transition: WorkflowTransition | undefined;
  if (sourceStage) {
    transition = transitions.find(
      t => t.from_stage_id === sourceStage.id && t.to_stage_id === targetStage.id
    );
  }

  const isBackward = transition?.is_backward ?? false;
  const requiresReason = transition?.requires_reason ?? isBackward;

  // Check if transition exists and is allowed
  if (sourceStage && !transition) {
    failedGates.push({
      passed: false,
      gate: 'transition_allowed',
      message: `Transição de "${sourceStage.name}" para "${targetStage.name}" não é permitida`,
    });
  } else if (transition && !transition.is_allowed) {
    failedGates.push({
      passed: false,
      gate: 'transition_allowed',
      message: `Transição de "${sourceStage?.name}" para "${targetStage.name}" está bloqueada`,
    });
  } else {
    gates.push({
      passed: true,
      gate: 'transition_allowed',
      message: 'Transição permitida',
    });
  }

  // Check role permission
  if (transition && transition.allowed_roles.length > 0) {
    if (transition.allowed_roles.includes(userRole)) {
      gates.push({
        passed: true,
        gate: 'role_permission',
        message: 'Permissão de role válida',
      });
    } else {
      failedGates.push({
        passed: false,
        gate: 'role_permission',
        message: `Seu papel (${userRole}) não tem permissão para esta transição`,
      });
    }
  }

  // Gate: Briefing
  if (targetStage.requires_briefing) {
    if (briefingCompleted) {
      gates.push({
        passed: true,
        gate: 'briefing_completed',
        message: 'Briefing completo',
      });
    } else {
      failedGates.push({
        passed: false,
        gate: 'briefing_completed',
        message: 'Complete o briefing antes de avançar para esta etapa',
      });
    }
  }

  // Gate: Checklist
  if (targetStage.requires_checklist && targetStage.min_checklist_progress > 0) {
    if (checklistProgress >= targetStage.min_checklist_progress) {
      gates.push({
        passed: true,
        gate: 'checklist_progress',
        message: `Checklist ${checklistProgress}% completo`,
      });
    } else {
      failedGates.push({
        passed: false,
        gate: 'checklist_progress',
        message: `Checklist precisa estar ${targetStage.min_checklist_progress}% completo (atual: ${checklistProgress}%)`,
      });
    }
  }

  // Gate: Dependencies
  if (targetStage.requires_no_dependencies) {
    if (!hasActiveDependencies) {
      gates.push({
        passed: true,
        gate: 'no_dependencies',
        message: 'Sem dependências ativas',
      });
    } else {
      failedGates.push({
        passed: false,
        gate: 'no_dependencies',
        message: 'Existem dependências bloqueando este card',
      });
    }
  }

  return {
    allowed: failedGates.length === 0,
    gates,
    failedGates,
    requiresReason,
    isBackward,
  };
};

// =====================================================
// MUTATIONS
// =====================================================

// Create default workflow for workspace
export const useCreateDefaultWorkflow = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .rpc('create_default_workflow', {
          p_workspace_id: currentWorkspace.id,
          p_created_by: user.id,
        });

      if (error) throw error;
      
      const workflowId = data as string;
      
      // Emit workflow.created event
      await supabase
        .from('workflow_events')
        .insert({
          workspace_id: currentWorkspace.id,
          event_type: 'workflow.created',
          entity_type: 'workflow',
          entity_id: workflowId,
          payload: { created_by: user.id, is_default: true },
          triggered_by: user.id,
        });
      
      return workflowId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow', 'default'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-events'] });
    },
  });
};

// Transition card to new stage
export const useTransitionCard = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      cardTitle,
      fromStage,
      toStage,
      workflowId,
      transitionType = 'normal',
      reason,
      gatesPassed = [],
      gatesFailed = [],
    }: {
      cardId: string;
      cardTitle?: string;
      fromStage: string | null;
      toStage: string;
      workflowId: string;
      transitionType?: 'normal' | 'forced' | 'auto';
      reason?: string;
      gatesPassed?: string[];
      gatesFailed?: string[];
    }) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Not authenticated');

      // Update card stage
      const { error: updateError } = await supabase
        .from('cards')
        .update({
          current_stage: toStage,
          stage_entered_at: new Date().toISOString(),
          workflow_id: workflowId,
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Record history
      const { error: historyError } = await supabase
        .from('card_stage_history')
        .insert({
          card_id: cardId,
          workflow_id: workflowId,
          from_stage: fromStage,
          to_stage: toStage,
          transition_type: transitionType,
          triggered_by: user.id,
          reason,
          gates_passed: gatesPassed,
          gates_failed: gatesFailed,
        });

      if (historyError) throw historyError;

      // Emit workflow event
      const { error: eventError } = await supabase
        .from('workflow_events')
        .insert({
          workspace_id: currentWorkspace.id,
          event_type: 'card.entered_stage',
          entity_type: 'card',
          entity_id: cardId,
          payload: {
            from_stage: fromStage,
            to_stage: toStage,
            transition_type: transitionType,
            gates_passed: gatesPassed,
            gates_failed: gatesFailed,
          },
          triggered_by: user.id,
        });

      if (eventError) console.error('Failed to emit workflow event:', eventError);

      // Execute automations (EDA)
      try {
        const automationResults = await executeStageAutomations({
          cardId,
          cardTitle: cardTitle || 'Card',
          previousStage: fromStage,
          currentStage: toStage,
          triggeredBy: user.id,
          workspaceId: currentWorkspace.id,
        });

        console.log('[WorkflowTransition] Automation results:', automationResults);
      } catch (automationError) {
        // Don't fail the transition if automations fail
        console.error('[WorkflowTransition] Automation execution failed:', automationError);
      }

      return { cardId, toStage };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['card', data.cardId] });
      queryClient.invalidateQueries({ queryKey: ['card-stage-history', data.cardId] });
      queryClient.invalidateQueries({ queryKey: ['workflow-events'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
    },
  });
};

// Emit workflow event
export const useEmitWorkflowEvent = () => {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      eventType,
      entityType,
      entityId,
      payload = {},
    }: {
      eventType: string;
      entityType: string;
      entityId: string;
      payload?: Record<string, unknown>;
    }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      const { data, error } = await supabase
        .from('workflow_events')
        .insert([{
          workspace_id: currentWorkspace.id,
          event_type: eventType,
          entity_type: entityType,
          entity_id: entityId,
          payload: payload as Json,
          triggered_by: user?.id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as WorkflowEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-events'] });
    },
  });
};

// =====================================================
// HELPER HOOKS
// =====================================================

// Get complete workflow data (workflow + stages + transitions)
export const useCompleteWorkflow = (workflowId: string | undefined) => {
  const workflow = useWorkflow(workflowId);
  const stages = useWorkflowStages(workflowId);
  const transitions = useWorkflowTransitions(workflowId);

  return {
    workflow: workflow.data,
    stages: stages.data ?? [],
    transitions: transitions.data ?? [],
    isLoading: workflow.isLoading || stages.isLoading || transitions.isLoading,
    error: workflow.error || stages.error || transitions.error,
  };
};

// Map old status to new stage slug
export const mapStatusToStage = (status: string): string => {
  const statusToStageMap: Record<string, string> = {
    backlog: 'backlog',
    briefing: 'planejamento',
    todo: 'planejamento',
    in_progress: 'em_producao',
    review: 'revisao',
    approved: 'aprovacao',
    delivered: 'concluido',
  };

  return statusToStageMap[status] || 'backlog';
};

// Map stage slug to legacy status
export const mapStageToStatus = (stage: string): string => {
  const stageToStatusMap: Record<string, string> = {
    backlog: 'backlog',
    planejamento: 'briefing',
    em_producao: 'in_progress',
    revisao: 'review',
    aprovacao: 'approved',
    concluido: 'delivered',
  };

  return stageToStatusMap[stage] || 'backlog';
};
