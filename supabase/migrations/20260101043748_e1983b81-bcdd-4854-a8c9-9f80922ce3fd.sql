-- ==============================================
-- DDA (Débito Direto Autorizado) - Boletos Module
-- ==============================================

-- Tabela para armazenar boletos recebidos via DDA
CREATE TABLE public.dda_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Identificação do boleto
  external_id TEXT, -- ID do boleto no sistema externo (Pluggy)
  barcode TEXT, -- Código de barras
  digitable_line TEXT, -- Linha digitável
  
  -- Dados do cedente (quem emitiu o boleto)
  cedente_nome TEXT NOT NULL,
  cedente_documento TEXT, -- CNPJ/CPF do cedente
  cedente_banco TEXT,
  cedente_agencia TEXT,
  cedente_conta TEXT,
  
  -- Dados do sacado (quem deve pagar)
  sacado_nome TEXT,
  sacado_documento TEXT, -- CNPJ/CPF do sacado
  
  -- Valores
  valor_original DECIMAL(15,2) NOT NULL,
  valor_atualizado DECIMAL(15,2), -- Com juros/multa
  valor_desconto DECIMAL(15,2) DEFAULT 0,
  valor_abatimento DECIMAL(15,2) DEFAULT 0,
  
  -- Datas
  data_emissao DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  data_baixa DATE,
  
  -- Status do boleto
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Aguardando pagamento
    'scheduled',    -- Agendado para pagamento
    'paid',         -- Pago
    'expired',      -- Vencido não pago
    'cancelled',    -- Cancelado
    'ignored'       -- Ignorado pelo usuário
  )),
  
  -- Vinculação com transação
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Categorização
  category_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  
  -- Observações e metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Sincronização
  source TEXT DEFAULT 'pluggy', -- pluggy, manual, import
  synced_at TIMESTAMPTZ,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_dda_boletos_workspace ON public.dda_boletos(workspace_id);
CREATE INDEX idx_dda_boletos_status ON public.dda_boletos(status);
CREATE INDEX idx_dda_boletos_vencimento ON public.dda_boletos(data_vencimento);
CREATE INDEX idx_dda_boletos_cedente ON public.dda_boletos(cedente_documento);
CREATE INDEX idx_dda_boletos_external_id ON public.dda_boletos(external_id);
CREATE UNIQUE INDEX idx_dda_boletos_unique_external ON public.dda_boletos(workspace_id, external_id) WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.dda_boletos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view workspace boletos"
ON public.dda_boletos FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users with financial access can insert boletos"
ON public.dda_boletos FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND is_active = true AND can_view_financials = true
  )
);

CREATE POLICY "Users with financial access can update boletos"
ON public.dda_boletos FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND is_active = true AND can_view_financials = true
  )
);

CREATE POLICY "Users with financial access can delete boletos"
ON public.dda_boletos FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND is_active = true AND can_view_financials = true
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_dda_boletos_updated_at
BEFORE UPDATE ON public.dda_boletos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de log de sincronização DDA
CREATE TABLE public.dda_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'pluggy',
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  boletos_found INTEGER DEFAULT 0,
  boletos_new INTEGER DEFAULT 0,
  boletos_updated INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_by UUID REFERENCES auth.users(id)
);

-- Index e RLS para sync logs
CREATE INDEX idx_dda_sync_logs_workspace ON public.dda_sync_logs(workspace_id);

ALTER TABLE public.dda_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace sync logs"
ON public.dda_sync_logs FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users with financial access can insert sync logs"
ON public.dda_sync_logs FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid() AND is_active = true AND can_view_financials = true
  )
);