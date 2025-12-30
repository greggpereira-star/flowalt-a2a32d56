-- =============================================================
-- FASE 1: Tabela de Notas Fiscais (Invoices) com vínculo a transações
-- =============================================================

CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Dados da NF
  invoice_number TEXT NOT NULL,
  invoice_series TEXT,
  invoice_type TEXT NOT NULL DEFAULT 'nfse', -- nfse, nfe, nfce
  access_key TEXT, -- Chave de acesso da NF-e (44 dígitos)
  
  -- Valores
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Impostos detalhados
  taxes JSONB DEFAULT '{}',
  
  -- Datas
  issue_date DATE NOT NULL,
  due_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'emitida', -- emitida, cancelada, substituida, pendente
  
  -- Relacionamentos
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  
  -- Dados do tomador/destinatário
  recipient_name TEXT,
  recipient_document TEXT,
  recipient_email TEXT,
  
  -- Descrição do serviço/produto
  description TEXT,
  service_code TEXT,
  
  -- Arquivos
  pdf_url TEXT,
  xml_url TEXT,
  
  -- Origem dos dados
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_workspace ON public.invoices(workspace_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_transaction ON public.invoices(transaction_id);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE UNIQUE INDEX idx_invoices_number_workspace ON public.invoices(workspace_id, invoice_number, invoice_series) WHERE status != 'cancelada';

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoices"
  ON public.invoices FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members with financial access can manage invoices"
  ON public.invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = invoices.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.can_view_financials = true
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

-- =============================================================
-- FASE 2: Centro de Custos
-- =============================================================

CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  budget_monthly NUMERIC DEFAULT 0,
  budget_yearly NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_centers_workspace ON public.cost_centers(workspace_id);
CREATE INDEX idx_cost_centers_parent ON public.cost_centers(parent_id);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cost centers"
  ON public.cost_centers FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage cost centers"
  ON public.cost_centers FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

-- Adicionar cost_center_id à tabela transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_cost_center ON public.transactions(cost_center_id);

-- =============================================================
-- FASE 3: Conciliação Bancária
-- =============================================================

CREATE TABLE public.bank_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bank_statement_date DATE NOT NULL,
  bank_statement_description TEXT,
  bank_statement_amount NUMERIC NOT NULL,
  bank_statement_type TEXT NOT NULL,
  bank_account_id TEXT,
  bank_name TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  match_confidence NUMERIC,
  match_reason TEXT,
  difference_amount NUMERIC DEFAULT 0,
  difference_reason TEXT,
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  reconciled_by UUID,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_reconciliations_workspace ON public.bank_reconciliations(workspace_id);
CREATE INDEX idx_bank_reconciliations_date ON public.bank_reconciliations(bank_statement_date);
CREATE INDEX idx_bank_reconciliations_status ON public.bank_reconciliations(status);
CREATE INDEX idx_bank_reconciliations_transaction ON public.bank_reconciliations(transaction_id);

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with financial access can view reconciliations"
  ON public.bank_reconciliations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = bank_reconciliations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.can_view_financials = true
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "Members with financial access can manage reconciliations"
  ON public.bank_reconciliations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = bank_reconciliations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.can_view_financials = true
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

-- =============================================================
-- FASE 4: Auditoria Avançada de Transações Financeiras
-- =============================================================

CREATE TABLE public.financial_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changes JSONB,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_status TEXT,
  is_anomaly BOOLEAN DEFAULT false,
  anomaly_type TEXT,
  anomaly_score NUMERIC,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_audit_workspace ON public.financial_audit_trail(workspace_id);
CREATE INDEX idx_financial_audit_entity ON public.financial_audit_trail(entity_type, entity_id);
CREATE INDEX idx_financial_audit_user ON public.financial_audit_trail(user_id);
CREATE INDEX idx_financial_audit_created ON public.financial_audit_trail(created_at);
CREATE INDEX idx_financial_audit_anomaly ON public.financial_audit_trail(is_anomaly) WHERE is_anomaly = true;

ALTER TABLE public.financial_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view financial audit trail"
  ON public.financial_audit_trail FOR SELECT
  USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "System can insert audit trail"
  ON public.financial_audit_trail FOR INSERT
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- =============================================================
-- FASE 5: Relatórios Contábeis (DRE Snapshots)
-- =============================================================

CREATE TABLE public.financial_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  previous_period_data JSONB,
  variation_percentage NUMERIC,
  status TEXT DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  generated_by UUID,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_reports_workspace ON public.financial_reports(workspace_id);
CREATE INDEX idx_financial_reports_type ON public.financial_reports(report_type);
CREATE INDEX idx_financial_reports_period ON public.financial_reports(period_start, period_end);

ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with financial access can view reports"
  ON public.financial_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = financial_reports.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.can_view_financials = true
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "Admins can manage reports"
  ON public.financial_reports FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

-- =============================================================
-- FASE 6: Alertas Inteligentes e Previsões
-- =============================================================

CREATE TABLE public.financial_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  data JSONB DEFAULT '{}',
  suggested_actions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_alerts_workspace ON public.financial_alerts(workspace_id);
CREATE INDEX idx_financial_alerts_type ON public.financial_alerts(alert_type);
CREATE INDEX idx_financial_alerts_status ON public.financial_alerts(status);
CREATE INDEX idx_financial_alerts_severity ON public.financial_alerts(severity);

ALTER TABLE public.financial_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members with financial access can view alerts"
  ON public.financial_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = financial_alerts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.can_view_financials = true
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "Members with financial access can manage alerts"
  ON public.financial_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = financial_alerts.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.can_view_financials = true
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

-- =============================================================
-- Triggers para updated_at
-- =============================================================

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_reconciliations_updated_at
  BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime para alertas
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_alerts;