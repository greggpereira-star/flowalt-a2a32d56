
-- Remover tabela se criada parcialmente
DROP TABLE IF EXISTS tax_settings CASCADE;

-- Tabela de configuração fiscal do workspace
CREATE TABLE public.tax_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Regime tributário
  tax_regime TEXT NOT NULL DEFAULT 'simples_nacional' CHECK (tax_regime IN ('simples_nacional', 'lucro_presumido', 'lucro_real')),
  
  -- Configurações Simples Nacional
  simples_anexo TEXT DEFAULT 'anexo_iii' CHECK (simples_anexo IN ('anexo_iii', 'anexo_iv', 'anexo_v')),
  simples_faixa INTEGER DEFAULT 1 CHECK (simples_faixa BETWEEN 1 AND 6),
  simples_aliquota_efetiva DECIMAL(5,2) DEFAULT 6.00,
  
  -- Configurações Lucro Presumido
  lp_presuncao_servicos DECIMAL(5,2) DEFAULT 32.00,
  lp_irpj_aliquota DECIMAL(5,2) DEFAULT 15.00,
  lp_irpj_adicional DECIMAL(5,2) DEFAULT 10.00,
  lp_csll_aliquota DECIMAL(5,2) DEFAULT 9.00,
  lp_pis_aliquota DECIMAL(5,2) DEFAULT 0.65,
  lp_cofins_aliquota DECIMAL(5,2) DEFAULT 3.00,
  
  -- Configurações Lucro Real
  lr_irpj_aliquota DECIMAL(5,2) DEFAULT 15.00,
  lr_irpj_adicional DECIMAL(5,2) DEFAULT 10.00,
  lr_csll_aliquota DECIMAL(5,2) DEFAULT 9.00,
  lr_pis_aliquota DECIMAL(5,2) DEFAULT 1.65,
  lr_cofins_aliquota DECIMAL(5,2) DEFAULT 7.60,
  
  -- ISS Municipal
  iss_aliquota DECIMAL(5,2) DEFAULT 5.00,
  iss_retido_na_fonte BOOLEAN DEFAULT false,
  
  -- Retenções na fonte (quando tomador de serviço)
  retencao_irrf_aliquota DECIMAL(5,2) DEFAULT 1.50,
  retencao_pis_aliquota DECIMAL(5,2) DEFAULT 0.65,
  retencao_cofins_aliquota DECIMAL(5,2) DEFAULT 3.00,
  retencao_csll_aliquota DECIMAL(5,2) DEFAULT 1.00,
  retencao_inss_aliquota DECIMAL(5,2) DEFAULT 11.00,
  
  -- Metadados
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX idx_tax_settings_workspace ON tax_settings(workspace_id);
CREATE INDEX idx_tax_settings_effective ON tax_settings(workspace_id, effective_from DESC);

-- RLS
ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tax settings of their workspace"
  ON tax_settings FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users with financial access can manage tax settings"
  ON tax_settings FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members 
    WHERE user_id = auth.uid() AND can_view_financials = true
  ));

-- Trigger para updated_at
CREATE TRIGGER update_tax_settings_updated_at
  BEFORE UPDATE ON tax_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular impostos baseado no regime
CREATE OR REPLACE FUNCTION public.calculate_taxes(
  p_workspace_id UUID,
  p_gross_revenue DECIMAL,
  p_reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings RECORD;
  v_result JSON;
  v_base_calculo DECIMAL;
  v_irpj DECIMAL := 0;
  v_csll DECIMAL := 0;
  v_pis DECIMAL := 0;
  v_cofins DECIMAL := 0;
  v_iss DECIMAL := 0;
  v_das DECIMAL := 0;
  v_total_impostos DECIMAL := 0;
BEGIN
  -- Buscar configuração vigente
  SELECT * INTO v_settings
  FROM tax_settings
  WHERE workspace_id = p_workspace_id
    AND effective_from <= p_reference_date
  ORDER BY effective_from DESC
  LIMIT 1;
  
  -- Se não houver configuração, usar padrões do Simples
  IF v_settings IS NULL THEN
    v_das := p_gross_revenue * 0.06;
    v_total_impostos := v_das;
  ELSE
    CASE v_settings.tax_regime
      WHEN 'simples_nacional' THEN
        v_das := p_gross_revenue * (v_settings.simples_aliquota_efetiva / 100);
        v_total_impostos := v_das;
        
      WHEN 'lucro_presumido' THEN
        v_base_calculo := p_gross_revenue * (v_settings.lp_presuncao_servicos / 100);
        v_irpj := v_base_calculo * (v_settings.lp_irpj_aliquota / 100);
        -- Adicional de 10% sobre lucro que excede R$20.000/mês
        IF v_base_calculo > 20000 THEN
          v_irpj := v_irpj + ((v_base_calculo - 20000) * (v_settings.lp_irpj_adicional / 100));
        END IF;
        v_csll := v_base_calculo * (v_settings.lp_csll_aliquota / 100);
        v_pis := p_gross_revenue * (v_settings.lp_pis_aliquota / 100);
        v_cofins := p_gross_revenue * (v_settings.lp_cofins_aliquota / 100);
        v_iss := p_gross_revenue * (v_settings.iss_aliquota / 100);
        v_total_impostos := v_irpj + v_csll + v_pis + v_cofins + v_iss;
        
      WHEN 'lucro_real' THEN
        v_irpj := p_gross_revenue * (v_settings.lr_irpj_aliquota / 100);
        v_csll := p_gross_revenue * (v_settings.lr_csll_aliquota / 100);
        v_pis := p_gross_revenue * (v_settings.lr_pis_aliquota / 100);
        v_cofins := p_gross_revenue * (v_settings.lr_cofins_aliquota / 100);
        v_iss := p_gross_revenue * (v_settings.iss_aliquota / 100);
        v_total_impostos := v_irpj + v_csll + v_pis + v_cofins + v_iss;
    END CASE;
  END IF;
  
  v_result := json_build_object(
    'regime', COALESCE(v_settings.tax_regime, 'simples_nacional'),
    'gross_revenue', p_gross_revenue,
    'das', v_das,
    'irpj', v_irpj,
    'csll', v_csll,
    'pis', v_pis,
    'cofins', v_cofins,
    'iss', v_iss,
    'total_taxes', v_total_impostos,
    'net_revenue', p_gross_revenue - v_total_impostos,
    'effective_rate', CASE WHEN p_gross_revenue > 0 
      THEN ROUND((v_total_impostos / p_gross_revenue * 100)::NUMERIC, 2) 
      ELSE 0 END
  );
  
  RETURN v_result;
END;
$$;
