-- =============================================
-- STEP 1-2: DDA Complete Schema + RLS + Workflow (Fixed v3)
-- =============================================

-- Add new columns to dda_boletos for full workflow support
ALTER TABLE public.dda_boletos 
ADD COLUMN IF NOT EXISTS pluggy_item_id text,
ADD COLUMN IF NOT EXISTS pluggy_bill_id text,
ADD COLUMN IF NOT EXISTS bill_type text DEFAULT 'boleto',
ADD COLUMN IF NOT EXISTS workflow_status text DEFAULT 'captured',
ADD COLUMN IF NOT EXISTS linked_ap_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- Add constraint for workflow_status
DO $$ BEGIN
  ALTER TABLE public.dda_boletos 
  ADD CONSTRAINT dda_boletos_workflow_status_check 
  CHECK (workflow_status IN ('captured', 'reviewed', 'ap_created', 'awaiting_payment', 'paid_reconciled', 'ignored'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create simpler indexes for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_dda_boletos_pluggy_dedupe 
ON public.dda_boletos (workspace_id, pluggy_bill_id)
WHERE pluggy_bill_id IS NOT NULL AND deleted_at IS NULL;

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_dda_boletos_workflow_status ON public.dda_boletos(workflow_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dda_boletos_due_date ON public.dda_boletos(data_vencimento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dda_boletos_linked_ap ON public.dda_boletos(linked_ap_id) WHERE linked_ap_id IS NOT NULL;

-- =============================================
-- DDA Sync Runs table (enhanced from sync_logs)
-- =============================================
ALTER TABLE public.dda_sync_logs
ADD COLUMN IF NOT EXISTS pluggy_item_id text,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS finished_at timestamptz,
ADD COLUMN IF NOT EXISTS cursor_position text,
ADD COLUMN IF NOT EXISTS raw_response_sample jsonb;

-- =============================================
-- DDA Audit Events Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.dda_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  boleto_id uuid REFERENCES public.dda_boletos(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_dda_audit_workspace ON public.dda_audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dda_audit_boleto ON public.dda_audit_events(boleto_id);

-- =============================================
-- RLS Policies for dda_boletos (using can_view_financials)
-- =============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "workspace_dda_read" ON public.dda_boletos;
DROP POLICY IF EXISTS "workspace_dda_insert" ON public.dda_boletos;
DROP POLICY IF EXISTS "workspace_dda_update" ON public.dda_boletos;
DROP POLICY IF EXISTS "workspace_dda_delete" ON public.dda_boletos;
DROP POLICY IF EXISTS "dda_boletos_select_policy" ON public.dda_boletos;
DROP POLICY IF EXISTS "dda_boletos_insert_policy" ON public.dda_boletos;
DROP POLICY IF EXISTS "dda_boletos_update_policy" ON public.dda_boletos;
DROP POLICY IF EXISTS "dda_boletos_delete_policy" ON public.dda_boletos;

-- Enable RLS
ALTER TABLE public.dda_boletos ENABLE ROW LEVEL SECURITY;

-- Policy: Only financial members can SELECT (excluding soft-deleted)
CREATE POLICY "dda_boletos_select_policy" ON public.dda_boletos
FOR SELECT USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_boletos.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Policy: Only financial members can INSERT
CREATE POLICY "dda_boletos_insert_policy" ON public.dda_boletos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_boletos.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Policy: Only financial members can UPDATE
CREATE POLICY "dda_boletos_update_policy" ON public.dda_boletos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_boletos.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- Policy: Only financial members can DELETE (soft delete recommended)
CREATE POLICY "dda_boletos_delete_policy" ON public.dda_boletos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_boletos.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- =============================================
-- RLS for dda_sync_logs
-- =============================================
DROP POLICY IF EXISTS "dda_sync_logs_select" ON public.dda_sync_logs;
DROP POLICY IF EXISTS "dda_sync_logs_insert" ON public.dda_sync_logs;
DROP POLICY IF EXISTS "dda_sync_logs_select_policy" ON public.dda_sync_logs;
DROP POLICY IF EXISTS "dda_sync_logs_insert_policy" ON public.dda_sync_logs;

ALTER TABLE public.dda_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dda_sync_logs_select_policy" ON public.dda_sync_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_sync_logs.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

CREATE POLICY "dda_sync_logs_insert_policy" ON public.dda_sync_logs
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_sync_logs.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

-- =============================================
-- RLS for dda_audit_events
-- =============================================
ALTER TABLE public.dda_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dda_audit_events_select_policy" ON public.dda_audit_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_audit_events.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

CREATE POLICY "dda_audit_events_insert_policy" ON public.dda_audit_events
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = dda_audit_events.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
  )
);

-- =============================================
-- Trigger for audit logging on status changes
-- =============================================
CREATE OR REPLACE FUNCTION public.log_dda_boleto_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.workflow_status IS DISTINCT FROM NEW.workflow_status 
     OR OLD.linked_ap_id IS DISTINCT FROM NEW.linked_ap_id
     OR OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
    INSERT INTO public.dda_audit_events (
      workspace_id,
      boleto_id,
      action,
      old_value,
      new_value,
      performed_by
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      CASE 
        WHEN OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN 'workflow_change'
        WHEN OLD.linked_ap_id IS DISTINCT FROM NEW.linked_ap_id THEN 'ap_link_change'
        WHEN OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN 'reconciliation_change'
        ELSE 'update'
      END,
      jsonb_build_object(
        'workflow_status', OLD.workflow_status,
        'linked_ap_id', OLD.linked_ap_id,
        'transaction_id', OLD.transaction_id,
        'status', OLD.status
      ),
      jsonb_build_object(
        'workflow_status', NEW.workflow_status,
        'linked_ap_id', NEW.linked_ap_id,
        'transaction_id', NEW.transaction_id,
        'status', NEW.status
      ),
      auth.uid()
    );
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS dda_boleto_audit_trigger ON public.dda_boletos;
CREATE TRIGGER dda_boleto_audit_trigger
  BEFORE UPDATE ON public.dda_boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_dda_boleto_changes();

-- =============================================
-- Function to match DDA boletos with transactions (reconciliation)
-- =============================================
CREATE OR REPLACE FUNCTION public.match_dda_with_transactions(
  p_workspace_id uuid,
  p_tolerance_days integer DEFAULT 3,
  p_tolerance_amount numeric DEFAULT 0.01
)
RETURNS TABLE (
  boleto_id uuid,
  transaction_id uuid,
  match_score numeric,
  match_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as boleto_id,
    t.id as transaction_id,
    CASE
      WHEN ABS(b.valor_original - ABS(t.amount)) <= p_tolerance_amount 
           AND ABS(b.data_vencimento - t.date) <= p_tolerance_days THEN 0.95::numeric
      WHEN ABS(b.valor_original - ABS(t.amount)) <= p_tolerance_amount THEN 0.80::numeric
      WHEN t.description ILIKE '%' || COALESCE(b.cedente_nome, '') || '%' THEN 0.70::numeric
      ELSE 0.50::numeric
    END as match_score,
    CASE
      WHEN ABS(b.valor_original - ABS(t.amount)) <= p_tolerance_amount 
           AND ABS(b.data_vencimento - t.date) <= p_tolerance_days 
      THEN 'Valor e data compatíveis'
      WHEN ABS(b.valor_original - ABS(t.amount)) <= p_tolerance_amount 
      THEN 'Valor compatível'
      WHEN t.description ILIKE '%' || COALESCE(b.cedente_nome, '') || '%' 
      THEN 'Cedente encontrado na descrição'
      ELSE 'Match parcial'
    END as match_reason
  FROM public.dda_boletos b
  CROSS JOIN LATERAL (
    SELECT t2.* FROM public.transactions t2
    WHERE t2.workspace_id = p_workspace_id
      AND t2.type = 'expense'
      AND t2.status = 'completed'
      AND t2.id NOT IN (SELECT db.transaction_id FROM public.dda_boletos db WHERE db.transaction_id IS NOT NULL)
      AND (
        ABS(b.valor_original - ABS(t2.amount)) <= b.valor_original * 0.05
        OR t2.description ILIKE '%' || COALESCE(b.cedente_documento, 'NOMATCH') || '%'
        OR t2.description ILIKE '%' || COALESCE(b.cedente_nome, 'NOMATCH') || '%'
      )
    ORDER BY 
      ABS(b.valor_original - ABS(t2.amount)),
      ABS(b.data_vencimento - t2.date)
    LIMIT 5
  ) t
  WHERE b.workspace_id = p_workspace_id
    AND b.deleted_at IS NULL
    AND b.workflow_status IN ('captured', 'reviewed', 'ap_created', 'awaiting_payment')
    AND b.transaction_id IS NULL
  ORDER BY match_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.match_dda_with_transactions TO authenticated;