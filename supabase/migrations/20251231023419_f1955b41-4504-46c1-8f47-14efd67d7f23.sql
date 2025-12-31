
-- =====================================================
-- WORKFLOW BLUEPRINT v1.0 - SCHEMA DO BANCO DE DADOS
-- =====================================================

-- 1. TABELA DE WORKFLOWS (definição do fluxo)
CREATE TABLE public.workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. TABELA DE ETAPAS DO WORKFLOW
CREATE TABLE public.workflow_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- backlog, planejamento, em_producao, etc
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'circle',
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Configurações da etapa
  is_initial BOOLEAN DEFAULT false, -- Etapa de entrada
  is_final BOOLEAN DEFAULT false, -- Etapa de conclusão
  is_optional BOOLEAN DEFAULT false, -- Pode ser pulada
  -- Gates obrigatórios
  requires_briefing BOOLEAN DEFAULT false,
  requires_checklist BOOLEAN DEFAULT false,
  requires_no_dependencies BOOLEAN DEFAULT false, -- Todas dependências resolvidas
  min_checklist_progress INTEGER DEFAULT 0, -- 0-100%
  -- WIP Limits
  wip_limit INTEGER, -- Limite de cards na etapa
  wip_limit_per_person INTEGER, -- Limite por pessoa
  -- SLA
  sla_warning_hours INTEGER, -- Alerta após X horas
  sla_critical_hours INTEGER, -- Crítico após X horas
  -- Automações permitidas
  allow_auto_transition BOOLEAN DEFAULT false,
  allow_auto_checklist BOOLEAN DEFAULT true,
  allow_auto_assignment BOOLEAN DEFAULT true,
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(workflow_id, slug)
);

-- 3. TABELA DE TRANSIÇÕES PERMITIDAS
CREATE TABLE public.workflow_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  from_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  to_stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  -- Tipo de transição
  is_forward BOOLEAN DEFAULT true, -- Avanço normal
  is_backward BOOLEAN DEFAULT false, -- Retrocesso (requer justificativa)
  is_allowed BOOLEAN DEFAULT true,
  -- Validações adicionais
  requires_reason BOOLEAN DEFAULT false, -- Exige motivo
  requires_approval BOOLEAN DEFAULT false, -- Exige aprovação
  allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'coordinator', 'member'], -- Roles que podem fazer
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(workflow_id, from_stage_id, to_stage_id)
);

-- 4. TABELA DE TEMPLATES DE CHECKLIST POR ETAPA
CREATE TABLE public.stage_checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false, -- Item obrigatório para sair da etapa
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_assignee_role TEXT, -- Role padrão para atribuição
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. TABELA DE HISTÓRICO DE TRANSIÇÕES (Auditoria)
CREATE TABLE public.card_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE SET NULL,
  from_stage TEXT, -- NULL se é a primeira entrada
  to_stage TEXT NOT NULL,
  transition_type TEXT NOT NULL DEFAULT 'normal', -- normal, forced, auto
  triggered_by UUID, -- Usuário que fez a transição
  reason TEXT, -- Motivo (obrigatório para retrocesso/forçado)
  gates_passed TEXT[], -- Gates que passaram
  gates_failed TEXT[], -- Gates que falharam (se forçado)
  time_in_previous_stage INTERVAL, -- Quanto tempo ficou na etapa anterior
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. TABELA DE EVENTOS DO WORKFLOW (EDA)
CREATE TABLE public.workflow_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- card.entered_stage, stage.transition_blocked, etc
  entity_type TEXT NOT NULL, -- card, workflow, stage
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  triggered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. ADICIONAR workflow_id E stage AO CARD
ALTER TABLE public.cards 
  ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_stage TEXT, -- Slug da etapa atual
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMP WITH TIME ZONE; -- Quando entrou na etapa

-- 8. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_workflow_stages_workflow ON public.workflow_stages(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow ON public.workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_card_stage_history_card ON public.card_stage_history(card_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_workspace ON public.workflow_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_entity ON public.workflow_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cards_workflow ON public.cards(workflow_id);
CREATE INDEX IF NOT EXISTS idx_cards_stage ON public.cards(current_stage);

-- 9. RLS POLICIES
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

-- Workflows: Membros do workspace podem visualizar
CREATE POLICY "Workspace members can view workflows"
  ON public.workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workflows.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

-- Workflows: Admins podem criar/editar
CREATE POLICY "Admins can manage workflows"
  ON public.workflows FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = workflows.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Stages: Herdam do workflow
CREATE POLICY "Workspace members can view stages"
  ON public.workflow_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.workspace_members wm ON wm.workspace_id = w.workspace_id
      WHERE w.id = workflow_stages.workflow_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

CREATE POLICY "Admins can manage stages"
  ON public.workflow_stages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.user_roles ur ON ur.workspace_id = w.workspace_id
      WHERE w.id = workflow_stages.workflow_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Transitions: Herdam do workflow
CREATE POLICY "Workspace members can view transitions"
  ON public.workflow_transitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.workspace_members wm ON wm.workspace_id = w.workspace_id
      WHERE w.id = workflow_transitions.workflow_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

CREATE POLICY "Admins can manage transitions"
  ON public.workflow_transitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      JOIN public.user_roles ur ON ur.workspace_id = w.workspace_id
      WHERE w.id = workflow_transitions.workflow_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Templates de checklist: Herdam do stage
CREATE POLICY "Workspace members can view checklist templates"
  ON public.stage_checklist_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_stages ws
      JOIN public.workflows w ON w.id = ws.workflow_id
      JOIN public.workspace_members wm ON wm.workspace_id = w.workspace_id
      WHERE ws.id = stage_checklist_templates.stage_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

CREATE POLICY "Admins can manage checklist templates"
  ON public.stage_checklist_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_stages ws
      JOIN public.workflows w ON w.id = ws.workflow_id
      JOIN public.user_roles ur ON ur.workspace_id = w.workspace_id
      WHERE ws.id = stage_checklist_templates.stage_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Histórico de etapas: Membros podem ver de seus cards
CREATE POLICY "Members can view card stage history"
  ON public.card_stage_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = card_stage_history.card_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

CREATE POLICY "System can insert stage history"
  ON public.card_stage_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = card_stage_history.card_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

-- Eventos: Membros podem ver eventos do workspace
CREATE POLICY "Members can view workflow events"
  ON public.workflow_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workflow_events.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

CREATE POLICY "Members can insert workflow events"
  ON public.workflow_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workflow_events.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

-- 10. TRIGGER PARA ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION public.update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workflow_updated_at();

CREATE TRIGGER update_workflow_stages_updated_at
  BEFORE UPDATE ON public.workflow_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workflow_updated_at();

-- 11. FUNÇÃO PARA CRIAR WORKFLOW PADRÃO
CREATE OR REPLACE FUNCTION public.create_default_workflow(p_workspace_id UUID, p_created_by UUID)
RETURNS UUID AS $$
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
    (v_workflow_id, 'Planejamento', 'planejamento', 'Definição de escopo, contexto e expectativas', '#eab308', 1, false, false, false, false, 0, 48, 120)
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

  -- Criar transições permitidas (avanço)
  INSERT INTO public.workflow_transitions (workflow_id, from_stage_id, to_stage_id, is_forward, is_backward) VALUES
    (v_workflow_id, v_stage_backlog, v_stage_planejamento, true, false),
    (v_workflow_id, v_stage_planejamento, v_stage_producao, true, false),
    (v_workflow_id, v_stage_producao, v_stage_revisao, true, false),
    (v_workflow_id, v_stage_revisao, v_stage_aprovacao, true, false),
    (v_workflow_id, v_stage_revisao, v_stage_producao, false, true), -- Retorno para correções
    (v_workflow_id, v_stage_aprovacao, v_stage_concluido, true, false),
    (v_workflow_id, v_stage_aprovacao, v_stage_producao, false, true); -- Retorno para ajustes

  RETURN v_workflow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 12. REALTIME para workflow_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_events;
