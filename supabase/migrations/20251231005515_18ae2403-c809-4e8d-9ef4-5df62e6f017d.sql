
-- =====================================================
-- FASE 1: BENEFÍCIOS, ENCARGOS CLT E FOLHA DE PAGAMENTO
-- =====================================================

-- Tabela de Benefícios do Colaborador
CREATE TABLE public.collaborator_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborator_details(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Vale Transporte
  vt_enabled BOOLEAN DEFAULT false,
  vt_value NUMERIC(10,2) DEFAULT 0,
  vt_discount_percentage NUMERIC(5,2) DEFAULT 6, -- 6% padrão CLT
  
  -- Vale Alimentação/Refeição
  va_enabled BOOLEAN DEFAULT false,
  va_value NUMERIC(10,2) DEFAULT 0,
  vr_enabled BOOLEAN DEFAULT false,
  vr_value NUMERIC(10,2) DEFAULT 0,
  
  -- Plano de Saúde
  health_plan_enabled BOOLEAN DEFAULT false,
  health_plan_value NUMERIC(10,2) DEFAULT 0,
  health_plan_employee_percentage NUMERIC(5,2) DEFAULT 0, -- % descontado do funcionário
  
  -- Plano Odontológico  
  dental_plan_enabled BOOLEAN DEFAULT false,
  dental_plan_value NUMERIC(10,2) DEFAULT 0,
  
  -- Outros benefícios
  gym_enabled BOOLEAN DEFAULT false,
  gym_value NUMERIC(10,2) DEFAULT 0,
  parking_enabled BOOLEAN DEFAULT false,
  parking_value NUMERIC(10,2) DEFAULT 0,
  
  -- Bônus e comissões
  bonus_enabled BOOLEAN DEFAULT false,
  bonus_type TEXT DEFAULT 'fixed', -- 'fixed', 'percentage', 'variable'
  bonus_value NUMERIC(10,2) DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Holerite/Folha de Pagamento
CREATE TABLE public.collaborator_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborator_details(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Período
  reference_month DATE NOT NULL, -- Primeiro dia do mês de referência
  payment_date DATE,
  
  -- Proventos (valores brutos)
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,
  overtime_value NUMERIC(10,2) DEFAULT 0,
  bonus NUMERIC(10,2) DEFAULT 0,
  commission NUMERIC(10,2) DEFAULT 0,
  
  -- Benefícios pagos
  vt_value NUMERIC(10,2) DEFAULT 0,
  va_value NUMERIC(10,2) DEFAULT 0,
  vr_value NUMERIC(10,2) DEFAULT 0,
  health_plan_value NUMERIC(10,2) DEFAULT 0,
  dental_plan_value NUMERIC(10,2) DEFAULT 0,
  other_benefits NUMERIC(10,2) DEFAULT 0,
  
  -- Descontos
  inss_value NUMERIC(10,2) DEFAULT 0,
  inss_percentage NUMERIC(5,2) DEFAULT 0,
  irrf_value NUMERIC(10,2) DEFAULT 0,
  irrf_base NUMERIC(12,2) DEFAULT 0,
  vt_discount NUMERIC(10,2) DEFAULT 0,
  health_plan_discount NUMERIC(10,2) DEFAULT 0,
  other_discounts NUMERIC(10,2) DEFAULT 0,
  other_discounts_description TEXT,
  
  -- Encargos patronais (para provisão)
  fgts_value NUMERIC(10,2) DEFAULT 0, -- 8%
  fgts_percentage NUMERIC(5,2) DEFAULT 8,
  inss_patronal NUMERIC(10,2) DEFAULT 0, -- ~28%
  provision_13th NUMERIC(10,2) DEFAULT 0, -- 1/12 do salário
  provision_vacation NUMERIC(10,2) DEFAULT 0, -- 1/12 + 1/3
  provision_vacation_13th NUMERIC(10,2) DEFAULT 0,
  
  -- Totais
  gross_salary NUMERIC(12,2) DEFAULT 0, -- Total de proventos
  total_discounts NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) DEFAULT 0, -- Salário líquido
  total_cost NUMERIC(12,2) DEFAULT 0, -- Custo total para empresa (inclui encargos)
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, pending, approved, paid
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Vínculo com transação
  transaction_id UUID REFERENCES public.transactions(id),
  
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_payroll_month UNIQUE(collaborator_id, reference_month)
);

-- Tabela de Férias e Ausências
CREATE TABLE public.collaborator_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborator_details(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  absence_type TEXT NOT NULL, -- 'vacation', 'sick_leave', 'maternity', 'paternity', 'unpaid', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  
  -- Específico para férias
  is_paid BOOLEAN DEFAULT true,
  vacation_bonus BOOLEAN DEFAULT false, -- Abono pecuniário (vende 10 dias)
  vacation_bonus_days INTEGER DEFAULT 0,
  
  -- Valores calculados (para férias)
  vacation_value NUMERIC(12,2) DEFAULT 0,
  vacation_third NUMERIC(12,2) DEFAULT 0, -- 1/3 constitucional
  total_value NUMERIC(12,2) DEFAULT 0,
  
  -- Documentação
  document_url TEXT,
  document_type TEXT, -- 'medical_certificate', 'vacation_request', 'other'
  
  -- Status e aprovação
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Controle de Férias
CREATE TABLE public.collaborator_vacation_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborator_details(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Período aquisitivo
  acquisition_start DATE NOT NULL,
  acquisition_end DATE NOT NULL,
  
  -- Período concessivo (12 meses após período aquisitivo)
  concession_start DATE NOT NULL,
  concession_end DATE NOT NULL,
  
  -- Saldo de dias
  total_days INTEGER DEFAULT 30,
  days_taken INTEGER DEFAULT 0,
  days_remaining INTEGER DEFAULT 30,
  days_sold INTEGER DEFAULT 0, -- Abono pecuniário
  
  -- Status
  status TEXT DEFAULT 'acquiring', -- acquiring, available, partial, exhausted, expired
  is_expired BOOLEAN DEFAULT false,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_vacation_period UNIQUE(collaborator_id, acquisition_start)
);

-- Tabela de Auditoria Financeira de Colaboradores
CREATE TABLE public.collaborator_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL REFERENCES public.collaborator_details(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL, -- 'salary_change', 'benefit_change', 'vacation_request', 'payroll_generated', etc.
  entity_type TEXT NOT NULL, -- 'collaborator_details', 'collaborator_benefits', 'collaborator_payroll', etc.
  entity_id UUID,
  
  old_data JSONB,
  new_data JSONB,
  changes JSONB, -- Campos que mudaram
  
  ip_address TEXT,
  user_agent TEXT,
  
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_benefits_collaborator ON public.collaborator_benefits(collaborator_id);
CREATE INDEX idx_payroll_collaborator ON public.collaborator_payroll(collaborator_id);
CREATE INDEX idx_payroll_month ON public.collaborator_payroll(reference_month);
CREATE INDEX idx_payroll_status ON public.collaborator_payroll(status);
CREATE INDEX idx_absences_collaborator ON public.collaborator_absences(collaborator_id);
CREATE INDEX idx_absences_dates ON public.collaborator_absences(start_date, end_date);
CREATE INDEX idx_absences_status ON public.collaborator_absences(status);
CREATE INDEX idx_vacation_balance_collaborator ON public.collaborator_vacation_balance(collaborator_id);
CREATE INDEX idx_vacation_balance_status ON public.collaborator_vacation_balance(status);
CREATE INDEX idx_collaborator_audit_collaborator ON public.collaborator_audit(collaborator_id);
CREATE INDEX idx_collaborator_audit_action ON public.collaborator_audit(action);

-- Enable RLS
ALTER TABLE public.collaborator_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_vacation_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view benefits" ON public.collaborator_benefits
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage benefits" ON public.collaborator_benefits
  FOR ALL USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view payroll" ON public.collaborator_payroll
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage payroll" ON public.collaborator_payroll
  FOR ALL USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view absences" ON public.collaborator_absences
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage absences" ON public.collaborator_absences
  FOR ALL USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view vacation balance" ON public.collaborator_vacation_balance
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage vacation balance" ON public.collaborator_vacation_balance
  FOR ALL USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view audit" ON public.collaborator_audit
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can insert audit" ON public.collaborator_audit
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

-- Triggers para updated_at
CREATE TRIGGER update_collaborator_benefits_updated_at
  BEFORE UPDATE ON public.collaborator_benefits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborator_payroll_updated_at
  BEFORE UPDATE ON public.collaborator_payroll
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborator_absences_updated_at
  BEFORE UPDATE ON public.collaborator_absences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborator_vacation_balance_updated_at
  BEFORE UPDATE ON public.collaborator_vacation_balance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular INSS progressivo 2024
CREATE OR REPLACE FUNCTION public.calculate_inss(p_salary NUMERIC)
RETURNS TABLE(inss_value NUMERIC, inss_percentage NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inss NUMERIC := 0;
  v_remaining NUMERIC := p_salary;
BEGIN
  -- Faixas INSS 2024
  -- Até R$ 1.412,00: 7,5%
  IF v_remaining > 0 THEN
    v_inss := v_inss + LEAST(v_remaining, 1412.00) * 0.075;
    v_remaining := v_remaining - 1412.00;
  END IF;
  
  -- De R$ 1.412,01 até R$ 2.666,68: 9%
  IF v_remaining > 0 THEN
    v_inss := v_inss + LEAST(v_remaining, 1254.68) * 0.09;
    v_remaining := v_remaining - 1254.68;
  END IF;
  
  -- De R$ 2.666,69 até R$ 4.000,03: 12%
  IF v_remaining > 0 THEN
    v_inss := v_inss + LEAST(v_remaining, 1333.35) * 0.12;
    v_remaining := v_remaining - 1333.35;
  END IF;
  
  -- De R$ 4.000,04 até R$ 7.786,02: 14%
  IF v_remaining > 0 THEN
    v_inss := v_inss + LEAST(v_remaining, 3785.99) * 0.14;
  END IF;
  
  -- Teto máximo do INSS 2024: R$ 908,85
  v_inss := LEAST(v_inss, 908.85);
  
  RETURN QUERY SELECT 
    ROUND(v_inss, 2),
    ROUND((v_inss / NULLIF(p_salary, 0)) * 100, 2);
END;
$$;

-- Função para calcular IRRF 2024
CREATE OR REPLACE FUNCTION public.calculate_irrf(p_base_salary NUMERIC, p_dependents INTEGER DEFAULT 0)
RETURNS TABLE(irrf_value NUMERIC, irrf_base NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base NUMERIC;
  v_irrf NUMERIC := 0;
  v_deduction_per_dependent NUMERIC := 189.59;
BEGIN
  -- Base de cálculo = salário - INSS - dedução por dependente
  v_base := p_base_salary - (SELECT inss_value FROM calculate_inss(p_base_salary));
  v_base := v_base - (p_dependents * v_deduction_per_dependent);
  
  -- Faixas IRRF 2024
  IF v_base <= 2259.20 THEN
    v_irrf := 0; -- Isento
  ELSIF v_base <= 2826.65 THEN
    v_irrf := (v_base * 0.075) - 169.44;
  ELSIF v_base <= 3751.05 THEN
    v_irrf := (v_base * 0.15) - 381.44;
  ELSIF v_base <= 4664.68 THEN
    v_irrf := (v_base * 0.225) - 662.77;
  ELSE
    v_irrf := (v_base * 0.275) - 896.00;
  END IF;
  
  -- IRRF não pode ser negativo
  v_irrf := GREATEST(v_irrf, 0);
  
  RETURN QUERY SELECT ROUND(v_irrf, 2), ROUND(v_base, 2);
END;
$$;

-- Função para gerar folha de pagamento mensal
CREATE OR REPLACE FUNCTION public.generate_payroll(
  p_workspace_id UUID,
  p_reference_month DATE,
  p_collaborator_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_collab RECORD;
  v_benefits RECORD;
  v_inss RECORD;
  v_irrf RECORD;
  v_gross NUMERIC;
  v_discounts NUMERIC;
  v_net NUMERIC;
  v_total_cost NUMERIC;
  v_count INTEGER := 0;
BEGIN
  FOR v_collab IN
    SELECT cd.*, wm.user_id
    FROM collaborator_details cd
    JOIN workspace_members wm ON wm.id = cd.member_id
    WHERE cd.workspace_id = p_workspace_id
    AND cd.is_active = true
    AND cd.base_salary > 0
    AND (p_collaborator_id IS NULL OR cd.id = p_collaborator_id)
  LOOP
    -- Get benefits
    SELECT * INTO v_benefits
    FROM collaborator_benefits
    WHERE collaborator_id = v_collab.id;
    
    -- Calculate INSS
    SELECT * INTO v_inss FROM calculate_inss(v_collab.base_salary);
    
    -- Calculate IRRF
    SELECT * INTO v_irrf FROM calculate_irrf(v_collab.base_salary, 0);
    
    -- Calculate gross salary
    v_gross := v_collab.base_salary;
    
    -- Calculate discounts
    v_discounts := v_inss.inss_value + v_irrf.irrf_value;
    
    -- VT discount (max 6% of salary)
    IF v_benefits.vt_enabled THEN
      v_discounts := v_discounts + LEAST(v_collab.base_salary * 0.06, v_benefits.vt_value);
    END IF;
    
    -- Health plan discount
    IF v_benefits.health_plan_enabled AND v_benefits.health_plan_employee_percentage > 0 THEN
      v_discounts := v_discounts + (v_benefits.health_plan_value * v_benefits.health_plan_employee_percentage / 100);
    END IF;
    
    -- Net salary
    v_net := v_gross - v_discounts;
    
    -- Total cost (salary + encargos + benefits)
    v_total_cost := v_collab.base_salary 
      + (v_collab.base_salary * 0.08) -- FGTS 8%
      + (v_collab.base_salary * 0.28) -- INSS Patronal ~28%
      + (v_collab.base_salary / 12) -- Provisão 13º
      + (v_collab.base_salary / 12 * 1.33) -- Provisão férias + 1/3
      + COALESCE(v_benefits.vt_value, 0)
      + COALESCE(v_benefits.va_value, 0)
      + COALESCE(v_benefits.vr_value, 0)
      + COALESCE(v_benefits.health_plan_value, 0)
      + COALESCE(v_benefits.dental_plan_value, 0);
    
    -- Insert or update payroll
    INSERT INTO collaborator_payroll (
      collaborator_id, workspace_id, reference_month,
      base_salary, 
      vt_value, va_value, vr_value, health_plan_value, dental_plan_value,
      inss_value, inss_percentage, irrf_value, irrf_base,
      vt_discount, health_plan_discount,
      fgts_value, fgts_percentage, inss_patronal,
      provision_13th, provision_vacation,
      gross_salary, total_discounts, net_salary, total_cost,
      status, created_by
    ) VALUES (
      v_collab.id, p_workspace_id, p_reference_month,
      v_collab.base_salary,
      COALESCE(v_benefits.vt_value, 0),
      COALESCE(v_benefits.va_value, 0),
      COALESCE(v_benefits.vr_value, 0),
      COALESCE(v_benefits.health_plan_value, 0),
      COALESCE(v_benefits.dental_plan_value, 0),
      v_inss.inss_value, v_inss.inss_percentage,
      v_irrf.irrf_value, v_irrf.irrf_base,
      CASE WHEN v_benefits.vt_enabled THEN LEAST(v_collab.base_salary * 0.06, v_benefits.vt_value) ELSE 0 END,
      CASE WHEN v_benefits.health_plan_enabled THEN v_benefits.health_plan_value * COALESCE(v_benefits.health_plan_employee_percentage, 0) / 100 ELSE 0 END,
      ROUND(v_collab.base_salary * 0.08, 2), 8,
      ROUND(v_collab.base_salary * 0.28, 2),
      ROUND(v_collab.base_salary / 12, 2),
      ROUND(v_collab.base_salary / 12 * 1.33, 2),
      v_gross, v_discounts, v_net, v_total_cost,
      'draft', auth.uid()
    )
    ON CONFLICT (collaborator_id, reference_month)
    DO UPDATE SET
      base_salary = EXCLUDED.base_salary,
      vt_value = EXCLUDED.vt_value,
      va_value = EXCLUDED.va_value,
      vr_value = EXCLUDED.vr_value,
      health_plan_value = EXCLUDED.health_plan_value,
      dental_plan_value = EXCLUDED.dental_plan_value,
      inss_value = EXCLUDED.inss_value,
      inss_percentage = EXCLUDED.inss_percentage,
      irrf_value = EXCLUDED.irrf_value,
      irrf_base = EXCLUDED.irrf_base,
      vt_discount = EXCLUDED.vt_discount,
      health_plan_discount = EXCLUDED.health_plan_discount,
      fgts_value = EXCLUDED.fgts_value,
      inss_patronal = EXCLUDED.inss_patronal,
      provision_13th = EXCLUDED.provision_13th,
      provision_vacation = EXCLUDED.provision_vacation,
      gross_salary = EXCLUDED.gross_salary,
      total_discounts = EXCLUDED.total_discounts,
      net_salary = EXCLUDED.net_salary,
      total_cost = EXCLUDED.total_cost,
      updated_at = now();
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Função para inicializar período de férias na admissão
CREATE OR REPLACE FUNCTION public.init_vacation_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.hire_date IS NOT NULL THEN
    INSERT INTO collaborator_vacation_balance (
      collaborator_id, workspace_id,
      acquisition_start, acquisition_end,
      concession_start, concession_end,
      status
    ) VALUES (
      NEW.id, NEW.workspace_id,
      NEW.hire_date,
      NEW.hire_date + INTERVAL '12 months' - INTERVAL '1 day',
      NEW.hire_date + INTERVAL '12 months',
      NEW.hire_date + INTERVAL '24 months' - INTERVAL '1 day',
      'acquiring'
    )
    ON CONFLICT (collaborator_id, acquisition_start) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER init_vacation_on_collaborator
  AFTER INSERT OR UPDATE OF hire_date ON public.collaborator_details
  FOR EACH ROW EXECUTE FUNCTION init_vacation_balance();
