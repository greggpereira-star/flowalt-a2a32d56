-- =====================================================
-- 15.3 READ MODELS: Dashboard Snapshots + Async Pipelines
-- =====================================================

-- Create system_metrics table for observability
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'api', 'job', 'performance', 'error'
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  correlation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_metrics_workspace_type ON public.system_metrics(workspace_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON public.system_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_correlation ON public.system_metrics(correlation_id) WHERE correlation_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can read metrics
CREATE POLICY "Admins can read system metrics"
  ON public.system_metrics
  FOR SELECT
  USING (
    workspace_id IS NULL OR
    public.has_admin_access(auth.uid(), workspace_id)
  );

-- System can insert metrics (via service role)
CREATE POLICY "Service can insert metrics"
  ON public.system_metrics
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 15.6 OBSERVABILITY: Structured Logging Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.structured_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  log_level TEXT NOT NULL DEFAULT 'info', -- 'debug', 'info', 'warn', 'error', 'fatal'
  service TEXT NOT NULL, -- 'api', 'edge-function', 'client', 'job'
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  correlation_id TEXT,
  session_id TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for log querying
CREATE INDEX IF NOT EXISTS idx_structured_logs_workspace ON public.structured_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_structured_logs_level ON public.structured_logs(log_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_structured_logs_correlation ON public.structured_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_structured_logs_service ON public.structured_logs(service, created_at DESC);

-- Enable RLS
ALTER TABLE public.structured_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read logs
CREATE POLICY "Admins can read structured logs"
  ON public.structured_logs
  FOR SELECT
  USING (
    workspace_id IS NULL OR
    public.has_admin_access(auth.uid(), workspace_id)
  );

-- System can insert logs
CREATE POLICY "Service can insert logs"
  ON public.structured_logs
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Function to log structured entries
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_structured(
  p_level TEXT,
  p_service TEXT,
  p_message TEXT,
  p_context JSONB DEFAULT '{}',
  p_workspace_id UUID DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.structured_logs (
    workspace_id, log_level, service, message, context, 
    correlation_id, session_id, user_id
  ) VALUES (
    p_workspace_id, p_level, p_service, p_message, p_context,
    p_correlation_id, p_session_id, auth.uid()
  );
END;
$$;

-- =====================================================
-- Analytics snapshot function for executive KPIs
-- =====================================================

CREATE OR REPLACE FUNCTION public.compute_executive_kpis(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'timestamp', now(),
    'workspace_id', p_workspace_id,
    
    -- Card metrics
    'cards_total', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status != 'archived'),
    'cards_in_progress', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status = 'in_progress'),
    'cards_overdue', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status NOT IN ('delivered', 'archived') AND due_date < CURRENT_DATE),
    'cards_completed_week', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status = 'delivered' AND completed_at >= CURRENT_DATE - INTERVAL '7 days'),
    'cards_completed_month', (SELECT COUNT(*) FROM cards WHERE workspace_id = p_workspace_id AND status = 'delivered' AND completed_at >= CURRENT_DATE - INTERVAL '30 days'),
    
    -- Time metrics
    'hours_logged_week', COALESCE((SELECT SUM(duration_seconds)/3600.0 FROM time_entries WHERE workspace_id = p_workspace_id AND started_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    'hours_logged_month', COALESCE((SELECT SUM(duration_seconds)/3600.0 FROM time_entries WHERE workspace_id = p_workspace_id AND started_at >= CURRENT_DATE - INTERVAL '30 days'), 0),
    
    -- Team metrics
    'active_members', (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = p_workspace_id AND is_active = true),
    'members_with_activity_week', (
      SELECT COUNT(DISTINCT user_id) FROM time_entries 
      WHERE workspace_id = p_workspace_id AND started_at >= CURRENT_DATE - INTERVAL '7 days'
    ),
    
    -- Financial metrics (if available)
    'revenue_month', COALESCE((
      SELECT SUM(amount) FROM transactions 
      WHERE workspace_id = p_workspace_id AND type = 'income' AND status = 'paid' 
      AND DATE_TRUNC('month', due_date) = DATE_TRUNC('month', CURRENT_DATE)
    ), 0),
    'expenses_month', COALESCE((
      SELECT SUM(amount) FROM transactions 
      WHERE workspace_id = p_workspace_id AND type = 'expense' AND status = 'paid' 
      AND DATE_TRUNC('month', due_date) = DATE_TRUNC('month', CURRENT_DATE)
    ), 0),
    
    -- Client metrics
    'active_clients', (SELECT COUNT(*) FROM clients WHERE workspace_id = p_workspace_id AND is_active = true),
    'cards_per_client', COALESCE((
      SELECT AVG(card_count) FROM (
        SELECT client_id, COUNT(*) as card_count 
        FROM cards WHERE workspace_id = p_workspace_id AND client_id IS NOT NULL
        GROUP BY client_id
      ) sub
    ), 0),
    
    -- Velocity metrics
    'avg_completion_time_hours', COALESCE((
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)
      FROM cards 
      WHERE workspace_id = p_workspace_id AND status = 'delivered' 
      AND completed_at >= CURRENT_DATE - INTERVAL '30 days'
    ), 0)
    
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- Add status to workspaces if not exists
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;
END $$;