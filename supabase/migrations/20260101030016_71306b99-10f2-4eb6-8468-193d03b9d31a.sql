-- =====================================================
-- ESPAÇO CLIENTES - Migração Corrigida
-- =====================================================

-- 1. Criar enum para status do cliente (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_status') THEN
    CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'closed');
  END IF;
END$$;

-- 2. Criar enum para estado financeiro do cliente (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_financial_state') THEN
    CREATE TYPE public.client_financial_state AS ENUM ('healthy', 'attention', 'critical', 'loss');
  END IF;
END$$;

-- 3. Criar tabela principal de Client Cards (ficha completa do cliente)
CREATE TABLE IF NOT EXISTS public.client_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Referência ao cliente original (para migração)
  legacy_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  
  -- 2.1 Identidade
  name TEXT NOT NULL,
  segment TEXT,
  status public.client_status NOT NULL DEFAULT 'active',
  responsible_user_id UUID,
  start_date DATE,
  important_links JSONB DEFAULT '[]'::jsonb,
  logo_url TEXT,
  color TEXT,
  
  -- 2.2 Onboarding
  about_client TEXT,
  objectives TEXT,
  target_audience TEXT,
  challenges TEXT,
  competitors TEXT,
  relationship_tone TEXT,
  
  -- 2.3 Branding & Identidade Visual
  positioning TEXT,
  personality TEXT,
  visual_guidelines TEXT,
  brand_files JSONB DEFAULT '[]'::jsonb,
  
  -- 2.4 É, Faz e Fala
  brand_essence TEXT,
  products_services TEXT,
  language_style TEXT,
  keywords TEXT[],
  language_restrictions TEXT,
  
  -- 2.5 Contrato & Escopo
  contract_type TEXT,
  contracted_services TEXT[],
  agreed_deliverables TEXT,
  scope_limits TEXT,
  contract_notes TEXT,
  
  -- Metadados calculados
  health_score INTEGER DEFAULT 100,
  financial_state public.client_financial_state DEFAULT 'healthy',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  
  -- Constraints
  CONSTRAINT client_cards_health_score_check CHECK (health_score >= 0 AND health_score <= 100)
);

-- 4. Criar tabela para dados financeiros restritos do cliente
CREATE TABLE IF NOT EXISTS public.client_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_card_id UUID NOT NULL REFERENCES public.client_cards(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Campos financeiros (Step 3)
  contract_value DECIMAL(15,2),
  billing_type TEXT,
  expected_margin DECIMAL(5,2),
  financial_notes TEXT,
  
  -- Métricas calculadas
  total_revenue DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) DEFAULT 0,
  total_hours DECIMAL(10,2) DEFAULT 0,
  real_margin DECIMAL(5,2),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_client_cards_workspace ON public.client_cards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_cards_status ON public.client_cards(status);
CREATE INDEX IF NOT EXISTS idx_client_cards_financial_state ON public.client_cards(financial_state);
CREATE INDEX IF NOT EXISTS idx_client_cards_responsible ON public.client_cards(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_client_financials_client ON public.client_financials(client_card_id);
CREATE INDEX IF NOT EXISTS idx_client_financials_workspace ON public.client_financials(workspace_id);

-- 6. Trigger para updated_at (verificar se existe antes de criar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_cards_updated_at') THEN
    CREATE TRIGGER update_client_cards_updated_at
      BEFORE UPDATE ON public.client_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_financials_updated_at') THEN
    CREATE TRIGGER update_client_financials_updated_at
      BEFORE UPDATE ON public.client_financials
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 7. Enable RLS
ALTER TABLE public.client_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financials ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para client_cards (todos membros ativos do workspace podem ver)
DROP POLICY IF EXISTS "client_cards_select_workspace_members" ON public.client_cards;
CREATE POLICY "client_cards_select_workspace_members"
  ON public.client_cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = client_cards.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
    )
  );

DROP POLICY IF EXISTS "client_cards_insert_coordinators" ON public.client_cards;
CREATE POLICY "client_cards_insert_coordinators"
  ON public.client_cards
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_cards.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "client_cards_update_coordinators" ON public.client_cards;
CREATE POLICY "client_cards_update_coordinators"
  ON public.client_cards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_cards.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "client_cards_delete_admins" ON public.client_cards;
CREATE POLICY "client_cards_delete_admins"
  ON public.client_cards
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_cards.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- 9. Políticas RLS para client_financials (apenas coordenação/admin/owner)
DROP POLICY IF EXISTS "client_financials_select_coordinators" ON public.client_financials;
CREATE POLICY "client_financials_select_coordinators"
  ON public.client_financials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_financials.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "client_financials_insert_coordinators" ON public.client_financials;
CREATE POLICY "client_financials_insert_coordinators"
  ON public.client_financials
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_financials.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "client_financials_update_coordinators" ON public.client_financials;
CREATE POLICY "client_financials_update_coordinators"
  ON public.client_financials
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_financials.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "client_financials_delete_admins" ON public.client_financials;
CREATE POLICY "client_financials_delete_admins"
  ON public.client_financials
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = client_financials.workspace_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- 10. Adicionar is_system na tabela folders para identificar pastas sistêmicas
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- 11. Função para criar espaço Clientes automaticamente para um workspace
CREATE OR REPLACE FUNCTION public.create_clients_space_for_workspace(p_workspace_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id UUID;
BEGIN
  -- Verificar se já existe espaço de clientes
  SELECT id INTO v_space_id
  FROM public.spaces
  WHERE workspace_id = p_workspace_id
  AND name = 'Clientes'
  AND is_archived = false;
  
  IF v_space_id IS NOT NULL THEN
    RETURN v_space_id;
  END IF;
  
  -- Criar espaço Clientes
  INSERT INTO public.spaces (workspace_id, name, type, description, icon, color, sort_order)
  VALUES (
    p_workspace_id,
    'Clientes',
    'custom',
    'Centro de resultado com P&L por cliente',
    'Building2',
    '#6366f1',
    0
  )
  RETURNING id INTO v_space_id;
  
  -- Criar pasta: Clientes Ativos
  INSERT INTO public.folders (workspace_id, space_id, name, icon, color, sort_order, is_system)
  VALUES (p_workspace_id, v_space_id, 'Clientes Ativos', 'CheckCircle', '#22c55e', 0, true);
  
  -- Criar pasta: Clientes Pausados
  INSERT INTO public.folders (workspace_id, space_id, name, icon, color, sort_order, is_system)
  VALUES (p_workspace_id, v_space_id, 'Clientes Pausados', 'PauseCircle', '#f59e0b', 1, true);
  
  -- Criar pasta: Clientes Encerrados
  INSERT INTO public.folders (workspace_id, space_id, name, icon, color, sort_order, is_system)
  VALUES (p_workspace_id, v_space_id, 'Clientes Encerrados', 'XCircle', '#ef4444', 2, true);
  
  RETURN v_space_id;
END;
$$;

-- 12. Função para migrar clientes existentes para ClientCards
CREATE OR REPLACE FUNCTION public.migrate_clients_to_client_cards(p_workspace_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_client RECORD;
  v_client_card_id UUID;
BEGIN
  FOR v_client IN 
    SELECT * FROM public.clients 
    WHERE workspace_id = p_workspace_id 
    AND is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.client_cards cc 
      WHERE cc.legacy_client_id = clients.id
    )
  LOOP
    INSERT INTO public.client_cards (
      workspace_id,
      legacy_client_id,
      name,
      logo_url,
      color,
      status,
      start_date
    )
    VALUES (
      v_client.workspace_id,
      v_client.id,
      v_client.name,
      v_client.logo_url,
      v_client.color,
      'active',
      v_client.created_at::date
    )
    RETURNING id INTO v_client_card_id;
    
    -- Criar registro financeiro vazio
    INSERT INTO public.client_financials (client_card_id, workspace_id)
    VALUES (v_client_card_id, v_client.workspace_id);
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- 13. Criar espaço Clientes para todos os workspaces existentes
DO $$
DECLARE
  v_workspace RECORD;
BEGIN
  FOR v_workspace IN SELECT id FROM public.workspaces WHERE status = 'active'
  LOOP
    PERFORM public.create_clients_space_for_workspace(v_workspace.id);
    PERFORM public.migrate_clients_to_client_cards(v_workspace.id);
  END LOOP;
END$$;

-- 14. Trigger para criar espaço Clientes automaticamente em novos workspaces
CREATE OR REPLACE FUNCTION public.trigger_create_clients_space()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_clients_space_for_workspace(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created_create_clients_space ON public.workspaces;
CREATE TRIGGER on_workspace_created_create_clients_space
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_clients_space();