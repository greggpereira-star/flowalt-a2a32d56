-- Create system_metrics table for performance monitoring
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB,
  correlation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can view metrics
DROP POLICY IF EXISTS "Admins can view system metrics" ON public.system_metrics;
CREATE POLICY "Admins can view system metrics"
  ON public.system_metrics FOR SELECT
  USING (workspace_id IS NULL OR public.has_admin_access(auth.uid(), workspace_id));

-- System can insert metrics
DROP POLICY IF EXISTS "System can insert metrics" ON public.system_metrics;
CREATE POLICY "System can insert metrics"
  ON public.system_metrics FOR INSERT
  WITH CHECK (true);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON public.system_metrics(metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_correlation ON public.system_metrics(correlation_id) WHERE correlation_id IS NOT NULL;

-- Create dashboard_snapshots table for pre-computed metrics
CREATE TABLE IF NOT EXISTS public.dashboard_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, snapshot_type, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Members can view snapshots
DROP POLICY IF EXISTS "Members can view dashboard snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Members can view dashboard snapshots"
  ON public.dashboard_snapshots FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- System can manage snapshots
DROP POLICY IF EXISTS "System can manage snapshots" ON public.dashboard_snapshots;
CREATE POLICY "System can manage snapshots"
  ON public.dashboard_snapshots FOR ALL
  USING (true);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_lookup ON public.dashboard_snapshots(workspace_id, snapshot_type, snapshot_date DESC);

-- Function to record system metrics
CREATE OR REPLACE FUNCTION public.record_metric(
  p_metric_type TEXT,
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_workspace_id UUID DEFAULT NULL,
  p_dimensions JSONB DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_metrics (
    workspace_id, metric_type, metric_name, metric_value, dimensions, correlation_id
  ) VALUES (
    p_workspace_id, p_metric_type, p_metric_name, p_metric_value, p_dimensions, p_correlation_id
  );
END;
$$;

-- Function to compute and store dashboard snapshot
CREATE OR REPLACE FUNCTION public.compute_dashboard_snapshot(
  p_workspace_id UUID,
  p_snapshot_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB;
  v_today DATE := CURRENT_DATE;
BEGIN
  CASE p_snapshot_type
    WHEN 'coordination' THEN
      SELECT jsonb_build_object(
        'total_cards', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status != 'archived'),
        'in_progress', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status = 'in_progress'),
        'overdue', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status != 'delivered' AND due_date < CURRENT_DATE),
        'completed_today', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status = 'delivered' AND completed_at::date = v_today),
        'completed_week', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status = 'delivered' AND completed_at >= CURRENT_DATE - INTERVAL '7 days')
      ) INTO v_metrics;
    
    WHEN 'financial' THEN
      SELECT jsonb_build_object(
        'monthly_income', COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace_id = p_workspace_id AND type = 'income' AND DATE_TRUNC('month', due_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'paid'), 0),
        'monthly_expenses', COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace_id = p_workspace_id AND type = 'expense' AND DATE_TRUNC('month', due_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'paid'), 0),
        'pending_income', COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace_id = p_workspace_id AND type = 'income' AND status = 'pending'), 0),
        'pending_expenses', COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace_id = p_workspace_id AND type = 'expense' AND status = 'pending'), 0),
        'overdue_income', COALESCE((SELECT SUM(amount) FROM transactions WHERE workspace_id = p_workspace_id AND type = 'income' AND status = 'overdue'), 0)
      ) INTO v_metrics;
    
    WHEN 'team' THEN
      SELECT jsonb_build_object(
        'active_members', (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = p_workspace_id AND is_active = true),
        'total_hours_week', COALESCE((SELECT SUM(duration_seconds)/3600.0 FROM time_entries WHERE workspace_id = p_workspace_id AND started_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
        'avg_completion_rate', COALESCE((
          SELECT AVG(completion_rate) FROM (
            SELECT cm.user_id, 
              COUNT(CASE WHEN c.status = 'delivered' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) as completion_rate
            FROM card_members cm
            JOIN cards c ON c.id = cm.card_id
            WHERE c.workspace_id = p_workspace_id AND c.created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY cm.user_id
          ) sub
        ), 0)
      ) INTO v_metrics;
    
    ELSE
      v_metrics := '{}';
  END CASE;
  
  INSERT INTO public.dashboard_snapshots (workspace_id, snapshot_type, snapshot_date, metrics)
  VALUES (p_workspace_id, p_snapshot_type, v_today, v_metrics)
  ON CONFLICT (workspace_id, snapshot_type, snapshot_date)
  DO UPDATE SET metrics = EXCLUDED.metrics, computed_at = now();
END;
$$;

-- Add column to track data masking preferences
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS can_view_financials BOOLEAN DEFAULT false;
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS can_view_salaries BOOLEAN DEFAULT false;