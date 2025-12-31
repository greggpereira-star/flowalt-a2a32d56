-- Sprint 8: Observabilidade & Auditoria - Migração completa

-- 1. Tabela system_metrics para métricas do sistema
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_workspace ON public.system_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON public.system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created ON public.system_metrics(created_at DESC);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view metrics from their workspace" ON public.system_metrics;
CREATE POLICY "Users can view metrics from their workspace"
  ON public.system_metrics FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert metrics to their workspace" ON public.system_metrics;
CREATE POLICY "Users can insert metrics to their workspace"
  ON public.system_metrics FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- 2. Tabela dashboard_snapshots
CREATE TABLE IF NOT EXISTS public.dashboard_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_workspace ON public.dashboard_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_type_date ON public.dashboard_snapshots(snapshot_type, snapshot_date DESC);

ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view snapshots from their workspace" ON public.dashboard_snapshots;
CREATE POLICY "Users can view snapshots from their workspace"
  ON public.dashboard_snapshots FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage snapshots in their workspace" ON public.dashboard_snapshots;
CREATE POLICY "Users can manage snapshots in their workspace"
  ON public.dashboard_snapshots FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- 3. Tabela application_logs
CREATE TABLE IF NOT EXISTS public.application_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  correlation_id TEXT,
  session_id TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_logs_workspace ON public.application_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON public.application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_created ON public.application_logs(created_at DESC);

ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view logs from their workspace" ON public.application_logs;
CREATE POLICY "Users can view logs from their workspace"
  ON public.application_logs FOR SELECT
  USING (
    workspace_id IS NULL OR 
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "System can insert logs" ON public.application_logs;
CREATE POLICY "System can insert logs"
  ON public.application_logs FOR INSERT
  WITH CHECK (true);

-- 4. Função para computar snapshot diário
CREATE OR REPLACE FUNCTION public.compute_daily_snapshot(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT jsonb_build_object(
    'computed_at', now(),
    'cards', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'by_status', COALESCE(jsonb_object_agg(COALESCE(status::text, 'unknown'), cnt), '{}'::jsonb)
      )
      FROM (
        SELECT status, COUNT(*) as cnt
        FROM cards
        WHERE workspace_id = p_workspace_id
        GROUP BY status
      ) s
    ),
    'time_entries', (
      SELECT jsonb_build_object(
        'today_hours', COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at)) / 3600), 0),
        'entries_count', COUNT(*)
      )
      FROM time_entries
      WHERE workspace_id = p_workspace_id
        AND DATE(started_at) = v_today
    ),
    'transactions', (
      SELECT jsonb_build_object(
        'today_income', COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
        'today_expense', COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0),
        'count', COUNT(*)
      )
      FROM transactions
      WHERE workspace_id = p_workspace_id
        AND DATE(transaction_date) = v_today
    ),
    'inventory', (
      SELECT jsonb_build_object(
        'total_items', COUNT(*),
        'low_stock_count', COUNT(*) FILTER (WHERE current_stock <= min_stock AND min_stock > 0),
        'total_value', COALESCE(SUM(current_stock * COALESCE(purchase_value, 0)), 0)
      )
      FROM inventory_items
      WHERE workspace_id = p_workspace_id
    )
  ) INTO v_metrics;

  INSERT INTO dashboard_snapshots (workspace_id, snapshot_type, snapshot_date, metrics)
  VALUES (p_workspace_id, 'daily', v_today, v_metrics)
  ON CONFLICT ON CONSTRAINT dashboard_snapshots_pkey DO NOTHING;

  RETURN v_metrics;
END;
$$;

-- 5. Função para registrar métricas
CREATE OR REPLACE FUNCTION public.record_metric(
  p_workspace_id UUID,
  p_metric_type TEXT,
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_dimensions JSONB DEFAULT '{}',
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO system_metrics (workspace_id, metric_type, metric_name, metric_value, dimensions, correlation_id)
  VALUES (p_workspace_id, p_metric_type, p_metric_name, p_metric_value, p_dimensions, p_correlation_id)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 6. Função para métricas agregadas
CREATE OR REPLACE FUNCTION public.get_aggregated_metrics(
  p_workspace_id UUID,
  p_metric_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  metric_name TEXT,
  metric_type TEXT,
  avg_value NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  count BIGINT,
  last_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.metric_name,
    sm.metric_type,
    AVG(sm.metric_value)::NUMERIC as avg_value,
    MIN(sm.metric_value) as min_value,
    MAX(sm.metric_value) as max_value,
    COUNT(*) as count,
    (SELECT m2.metric_value FROM system_metrics m2
     WHERE m2.workspace_id = p_workspace_id 
       AND m2.metric_name = sm.metric_name 
     ORDER BY m2.created_at DESC LIMIT 1) as last_value
  FROM system_metrics sm
  WHERE sm.workspace_id = p_workspace_id
    AND sm.created_at BETWEEN p_start_date AND p_end_date
    AND (p_metric_type IS NULL OR sm.metric_type = p_metric_type)
  GROUP BY sm.metric_name, sm.metric_type
  ORDER BY sm.metric_name;
END;
$$;

-- 7. View para health check
CREATE OR REPLACE VIEW public.system_health_view AS
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  (SELECT COUNT(*) FROM cards c WHERE c.workspace_id = w.id) as total_cards,
  (SELECT COUNT(*) FROM cards c WHERE c.workspace_id = w.id AND c.status = 'in_progress') as active_cards,
  (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as team_size,
  (SELECT MAX(created_at) FROM cards c WHERE c.workspace_id = w.id) as last_card_created,
  (SELECT MAX(started_at) FROM time_entries te WHERE te.workspace_id = w.id) as last_time_entry,
  (SELECT COUNT(*) FROM application_logs al WHERE al.workspace_id = w.id AND al.level = 'error' AND al.created_at > now() - INTERVAL '24 hours') as errors_24h
FROM workspaces w;