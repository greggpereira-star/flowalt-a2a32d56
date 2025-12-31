-- Update create_default_workflow function to include backward transition from planejamento to backlog
CREATE OR REPLACE FUNCTION public.create_default_workflow(p_workspace_id uuid, p_created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_workflow_id UUID;
  v_stage_backlog UUID;
  v_stage_planejamento UUID;
  v_stage_producao UUID;
  v_stage_revisao UUID;
  v_stage_aprovacao UUID;
  v_stage_concluido UUID;
BEGIN
  -- Criar workflow
  INSERT INTO public.workflows (workspace_id, name, description, is_default, created_by)
  VALUES (p_workspace_id, 'Workflow Padrão', 'Fluxo padrão do Flowalt conforme Blueprint v1.0', true, p_created_by)
  RETURNING id INTO v_workflow_id;

  -- Criar etapas
  INSERT INTO public.workflow_stages (workflow_id, name, slug, description, color, sort_order, is_initial, requires_briefing, requires_checklist, requires_no_dependencies, min_checklist_progress, sla_warning_hours, sla_critical_hours)
  VALUES 
    (v_workflow_id, 'Backlog', 'backlog', 'Ideias e demandas aguardando priorização', '#6b7280', 0, true, false, false, false, 0, NULL, NULL)
  RETURNING id INTO v_stage_backlog;

  INSERT INTO public.workflow_stages (workflow_id, name, slug, description, color, sort_order, is_initial, requires_briefing, requires_checklist, requires_no_dependencies, min_checklist_progress, sla_warning_hours, sla_critical_hours)
  VALUES 
    (v_workflow_id, 'A Fazer', 'a_fazer', 'Cards prontos para iniciar trabalho', '#eab308', 1, false, false, false, false, 0, 48, 120)
  RETURNING id INTO v_stage_planejamento;

  INSERT INTO public.workflow_stages (workflow_id, name, slug, description, color, sort_order, is_initial, requires_briefing, requires_checklist, requires_no_dependencies, min_checklist_progress, sla_warning_hours, sla_critical_hours)
  VALUES 
    (v_workflow_id, 'Em Produção', 'em_producao', 'Execução do trabalho', '#3b82f6', 2, false, true, true, true, 0, NULL, NULL)
  RETURNING id INTO v_stage_producao;

  INSERT INTO public.workflow_stages (workflow_id, name, slug, description, color, sort_order, is_initial, requires_briefing, requires_checklist, requires_no_dependencies, min_checklist_progress, sla_warning_hours, sla_critical_hours)
  VALUES 
    (v_workflow_id, 'Revisão', 'revisao', 'Verificação interna', '#8b5cf6', 3, false, true, true, true, 100, 24, 72)
  RETURNING id INTO v_stage_revisao;

  INSERT INTO public.workflow_stages (workflow_id, name, slug, description, color, sort_order, is_initial, requires_briefing, requires_checklist, requires_no_dependencies, min_checklist_progress, sla_warning_hours, sla_critical_hours)
  VALUES 
    (v_workflow_id, 'Aprovação', 'aprovacao', 'Validação pelo cliente', '#ec4899', 4, false, true, true, true, 100, 48, 120)
  RETURNING id INTO v_stage_aprovacao;

  INSERT INTO public.workflow_stages (workflow_id, name, slug, description, color, sort_order, is_initial, requires_briefing, requires_checklist, requires_no_dependencies, min_checklist_progress, sla_warning_hours, sla_critical_hours, is_final)
  VALUES 
    (v_workflow_id, 'Concluído', 'concluido', 'Trabalho finalizado', '#22c55e', 5, false, true, true, true, 100, NULL, NULL, true)
  RETURNING id INTO v_stage_concluido;

  -- Criar transições permitidas (avanço e retorno)
  INSERT INTO public.workflow_transitions (workflow_id, from_stage_id, to_stage_id, is_forward, is_backward) VALUES
    -- Avanços
    (v_workflow_id, v_stage_backlog, v_stage_planejamento, true, false),
    (v_workflow_id, v_stage_planejamento, v_stage_producao, true, false),
    (v_workflow_id, v_stage_producao, v_stage_revisao, true, false),
    (v_workflow_id, v_stage_revisao, v_stage_aprovacao, true, false),
    (v_workflow_id, v_stage_aprovacao, v_stage_concluido, true, false),
    -- Retornos
    (v_workflow_id, v_stage_planejamento, v_stage_backlog, false, true),
    (v_workflow_id, v_stage_revisao, v_stage_producao, false, true),
    (v_workflow_id, v_stage_aprovacao, v_stage_producao, false, true);

  RETURN v_workflow_id;
END;
$function$;