-- =============================================
-- ALTCONTROL MODULE - Database Schema (Fixed)
-- =============================================

-- 1. Pricing Levels (Níveis de Precificação)
CREATE TABLE public.altcontrol_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  min_hours INTEGER NOT NULL,
  max_hours INTEGER NOT NULL,
  min_cost_per_hour NUMERIC(10,2) NOT NULL,
  max_cost_per_hour NUMERIC(10,2) NOT NULL,
  min_monthly_price NUMERIC(12,2) NOT NULL,
  max_monthly_price NUMERIC(12,2) NOT NULL,
  target_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 30,
  requires_reinforced_approval BOOLEAN NOT NULL DEFAULT false,
  block_pdf_before_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT altcontrol_valid_hours_range CHECK (min_hours <= max_hours),
  CONSTRAINT altcontrol_valid_cost_range CHECK (min_cost_per_hour <= max_cost_per_hour),
  CONSTRAINT altcontrol_valid_price_range CHECK (min_monthly_price <= max_monthly_price)
);

-- 2. Service Catalog (Catálogo de Serviços)
CREATE TABLE public.altcontrol_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_minimum_level BOOLEAN NOT NULL DEFAULT false,
  minimum_level_id UUID REFERENCES public.altcontrol_levels(id) ON DELETE SET NULL,
  suggested_min_hours INTEGER,
  suggested_max_hours INTEGER,
  service_type TEXT NOT NULL DEFAULT 'recurring',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Cost Parameters (Custos/Hora-Homem)
CREATE TABLE public.altcontrol_cost_params (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Padrão',
  base_hourly_cost NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  overhead_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. Approval Rules (Regras de Aprovação)
CREATE TABLE public.altcontrol_approval_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  min_level_order INTEGER NOT NULL DEFAULT 0,
  max_level_order INTEGER,
  required_approvers_count INTEGER NOT NULL DEFAULT 1,
  notify_by_email BOOLEAN NOT NULL DEFAULT true,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5. Approvers Pool (Pool de Aprovadores)
CREATE TABLE public.altcontrol_approvers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_senior BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(workspace_id, user_id)
);

-- 6. Proposals (Propostas)
CREATE TABLE public.altcontrol_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_number SERIAL,
  client_name TEXT NOT NULL,
  client_id UUID REFERENCES public.client_cards(id) ON DELETE SET NULL,
  seller_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  calculated_level_id UUID REFERENCES public.altcontrol_levels(id),
  total_hours INTEGER NOT NULL DEFAULT 0,
  suggested_min_price NUMERIC(12,2),
  suggested_max_price NUMERIC(12,2),
  final_price NUMERIC(12,2),
  estimated_cost NUMERIC(12,2),
  estimated_margin_percent NUMERIC(5,2),
  notes TEXT,
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approval_comment TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  won_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT altcontrol_valid_status CHECK (status IN ('draft', 'in_review', 'needs_adjustment', 'approved', 'sent', 'won', 'lost'))
);

-- 7. Proposal Items (Itens da Proposta)
CREATE TABLE public.altcontrol_proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.altcontrol_proposals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.altcontrol_services(id),
  hours_per_month INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Proposal History/Audit (Histórico/Auditoria)
CREATE TABLE public.altcontrol_proposal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.altcontrol_proposals(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 9. Approval Requests (Solicitações de Aprovação)
CREATE TABLE public.altcontrol_approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.altcontrol_proposals(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decision TEXT,
  comment TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT altcontrol_approval_valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'adjustment_requested'))
);

-- 10. Active Contracts (Contratos Ativos)
CREATE TABLE public.altcontrol_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.altcontrol_proposals(id),
  client_id UUID REFERENCES public.client_cards(id),
  client_name TEXT NOT NULL,
  level_id UUID REFERENCES public.altcontrol_levels(id),
  contracted_hours INTEGER NOT NULL,
  monthly_value NUMERIC(12,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT altcontrol_contract_valid_status CHECK (status IN ('active', 'paused', 'cancelled', 'completed'))
);

-- 11. Monthly Hours Tracking (Horas Realizadas Mensais)
CREATE TABLE public.altcontrol_monthly_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.altcontrol_contracts(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  realized_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(contract_id, year_month)
);

-- 12. Contract Services (Serviços do Contrato)
CREATE TABLE public.altcontrol_contract_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.altcontrol_contracts(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.altcontrol_services(id),
  hours_allocated INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_altcontrol_levels_workspace ON public.altcontrol_levels(workspace_id);
CREATE INDEX idx_altcontrol_services_workspace ON public.altcontrol_services(workspace_id);
CREATE INDEX idx_altcontrol_proposals_workspace ON public.altcontrol_proposals(workspace_id);
CREATE INDEX idx_altcontrol_proposals_status ON public.altcontrol_proposals(status);
CREATE INDEX idx_altcontrol_proposals_seller ON public.altcontrol_proposals(seller_id);
CREATE INDEX idx_altcontrol_contracts_workspace ON public.altcontrol_contracts(workspace_id);
CREATE INDEX idx_altcontrol_contracts_status ON public.altcontrol_contracts(status);
CREATE INDEX idx_altcontrol_approval_requests_approver ON public.altcontrol_approval_requests(approver_id);
CREATE INDEX idx_altcontrol_approval_requests_status ON public.altcontrol_approval_requests(status);

-- =============================================
-- RLS POLICIES (Using user_roles table for role checks)
-- =============================================
ALTER TABLE public.altcontrol_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_cost_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_proposal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_monthly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.altcontrol_contract_services ENABLE ROW LEVEL SECURITY;

-- Helper function to check user workspace membership
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.user_is_workspace_admin(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE workspace_id = ws_id AND user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Levels policies
CREATE POLICY "altcontrol_levels_select" ON public.altcontrol_levels
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_levels_insert" ON public.altcontrol_levels
  FOR INSERT WITH CHECK (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_levels_update" ON public.altcontrol_levels
  FOR UPDATE USING (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_levels_delete" ON public.altcontrol_levels
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Services policies
CREATE POLICY "altcontrol_services_select" ON public.altcontrol_services
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_services_insert" ON public.altcontrol_services
  FOR INSERT WITH CHECK (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_services_update" ON public.altcontrol_services
  FOR UPDATE USING (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_services_delete" ON public.altcontrol_services
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Cost params policies
CREATE POLICY "altcontrol_cost_params_select" ON public.altcontrol_cost_params
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_cost_params_insert" ON public.altcontrol_cost_params
  FOR INSERT WITH CHECK (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_cost_params_update" ON public.altcontrol_cost_params
  FOR UPDATE USING (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_cost_params_delete" ON public.altcontrol_cost_params
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Approval rules policies
CREATE POLICY "altcontrol_approval_rules_select" ON public.altcontrol_approval_rules
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_approval_rules_insert" ON public.altcontrol_approval_rules
  FOR INSERT WITH CHECK (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_approval_rules_update" ON public.altcontrol_approval_rules
  FOR UPDATE USING (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_approval_rules_delete" ON public.altcontrol_approval_rules
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Approvers policies
CREATE POLICY "altcontrol_approvers_select" ON public.altcontrol_approvers
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_approvers_insert" ON public.altcontrol_approvers
  FOR INSERT WITH CHECK (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_approvers_update" ON public.altcontrol_approvers
  FOR UPDATE USING (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "altcontrol_approvers_delete" ON public.altcontrol_approvers
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Proposals policies
CREATE POLICY "altcontrol_proposals_select" ON public.altcontrol_proposals
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_proposals_insert" ON public.altcontrol_proposals
  FOR INSERT WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_proposals_update" ON public.altcontrol_proposals
  FOR UPDATE USING (
    seller_id = auth.uid() 
    OR public.user_is_workspace_admin(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE workspace_id = altcontrol_proposals.workspace_id 
      AND user_id = auth.uid() 
      AND role = 'coordinator'
    )
  );

CREATE POLICY "altcontrol_proposals_delete" ON public.altcontrol_proposals
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Proposal items policies
CREATE POLICY "altcontrol_proposal_items_select" ON public.altcontrol_proposal_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

CREATE POLICY "altcontrol_proposal_items_insert" ON public.altcontrol_proposal_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

CREATE POLICY "altcontrol_proposal_items_update" ON public.altcontrol_proposal_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

CREATE POLICY "altcontrol_proposal_items_delete" ON public.altcontrol_proposal_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

-- Proposal history policies
CREATE POLICY "altcontrol_proposal_history_select" ON public.altcontrol_proposal_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

CREATE POLICY "altcontrol_proposal_history_insert" ON public.altcontrol_proposal_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

-- Approval requests policies
CREATE POLICY "altcontrol_approval_requests_select" ON public.altcontrol_approval_requests
  FOR SELECT USING (
    approver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

CREATE POLICY "altcontrol_approval_requests_insert" ON public.altcontrol_approval_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_has_workspace_access(p.workspace_id)
    )
  );

CREATE POLICY "altcontrol_approval_requests_update" ON public.altcontrol_approval_requests
  FOR UPDATE USING (
    approver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.altcontrol_proposals p
      WHERE p.id = proposal_id AND public.user_is_workspace_admin(p.workspace_id)
    )
  );

-- Contracts policies
CREATE POLICY "altcontrol_contracts_select" ON public.altcontrol_contracts
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "altcontrol_contracts_insert" ON public.altcontrol_contracts
  FOR INSERT WITH CHECK (
    public.user_is_workspace_admin(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE workspace_id = altcontrol_contracts.workspace_id 
      AND user_id = auth.uid() 
      AND role = 'coordinator'
    )
  );

CREATE POLICY "altcontrol_contracts_update" ON public.altcontrol_contracts
  FOR UPDATE USING (
    public.user_is_workspace_admin(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE workspace_id = altcontrol_contracts.workspace_id 
      AND user_id = auth.uid() 
      AND role = 'coordinator'
    )
  );

CREATE POLICY "altcontrol_contracts_delete" ON public.altcontrol_contracts
  FOR DELETE USING (public.user_is_workspace_admin(workspace_id));

-- Monthly hours policies
CREATE POLICY "altcontrol_monthly_hours_select" ON public.altcontrol_monthly_hours
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND public.user_has_workspace_access(c.workspace_id)
    )
  );

CREATE POLICY "altcontrol_monthly_hours_insert" ON public.altcontrol_monthly_hours
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND public.user_has_workspace_access(c.workspace_id)
    )
  );

CREATE POLICY "altcontrol_monthly_hours_update" ON public.altcontrol_monthly_hours
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND public.user_has_workspace_access(c.workspace_id)
    )
  );

CREATE POLICY "altcontrol_monthly_hours_delete" ON public.altcontrol_monthly_hours
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND public.user_is_workspace_admin(c.workspace_id)
    )
  );

-- Contract services policies
CREATE POLICY "altcontrol_contract_services_select" ON public.altcontrol_contract_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND public.user_has_workspace_access(c.workspace_id)
    )
  );

CREATE POLICY "altcontrol_contract_services_insert" ON public.altcontrol_contract_services
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND (
        public.user_is_workspace_admin(c.workspace_id)
        OR EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE workspace_id = c.workspace_id 
          AND user_id = auth.uid() 
          AND role = 'coordinator'
        )
      )
    )
  );

CREATE POLICY "altcontrol_contract_services_delete" ON public.altcontrol_contract_services
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.altcontrol_contracts c
      WHERE c.id = contract_id AND public.user_is_workspace_admin(c.workspace_id)
    )
  );

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================
CREATE TRIGGER update_altcontrol_levels_updated_at
  BEFORE UPDATE ON public.altcontrol_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_services_updated_at
  BEFORE UPDATE ON public.altcontrol_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_cost_params_updated_at
  BEFORE UPDATE ON public.altcontrol_cost_params
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_approval_rules_updated_at
  BEFORE UPDATE ON public.altcontrol_approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_proposals_updated_at
  BEFORE UPDATE ON public.altcontrol_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_proposal_items_updated_at
  BEFORE UPDATE ON public.altcontrol_proposal_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_contracts_updated_at
  BEFORE UPDATE ON public.altcontrol_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_altcontrol_monthly_hours_updated_at
  BEFORE UPDATE ON public.altcontrol_monthly_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();