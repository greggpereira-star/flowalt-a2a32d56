
-- Helper: drop+recreate each permissive policy scoped to service_role only.

-- user_badges
DROP POLICY IF EXISTS "Service role can insert badges" ON public.user_badges;
CREATE POLICY "Service role can insert badges" ON public.user_badges
  FOR INSERT TO service_role WITH CHECK (true);

-- user_goal_progress
DROP POLICY IF EXISTS "System can insert progress" ON public.user_goal_progress;
CREATE POLICY "System can insert progress" ON public.user_goal_progress
  FOR INSERT TO service_role WITH CHECK (true);

-- ranking_history
DROP POLICY IF EXISTS "System can insert ranking history" ON public.ranking_history;
CREATE POLICY "System can insert ranking history" ON public.ranking_history
  FOR INSERT TO service_role WITH CHECK (true);

-- email_notifications
DROP POLICY IF EXISTS "System can insert email notifications" ON public.email_notifications;
CREATE POLICY "System can insert email notifications" ON public.email_notifications
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "System can update email notifications" ON public.email_notifications;
CREATE POLICY "System can update email notifications" ON public.email_notifications
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- analytics_snapshots
DROP POLICY IF EXISTS "System can manage analytics" ON public.analytics_snapshots;
CREATE POLICY "System can manage analytics" ON public.analytics_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- api_logs
DROP POLICY IF EXISTS "System can insert API logs" ON public.api_logs;
CREATE POLICY "System can insert API logs" ON public.api_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- usage_metrics
DROP POLICY IF EXISTS "System can insert usage metrics" ON public.usage_metrics;
CREATE POLICY "System can insert usage metrics" ON public.usage_metrics
  FOR INSERT TO service_role WITH CHECK (true);

-- dashboard_snapshots
DROP POLICY IF EXISTS "System can manage snapshots" ON public.dashboard_snapshots;
CREATE POLICY "System can manage snapshots" ON public.dashboard_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- api_idempotency_keys (was "Users can manage their own idempotency keys" with USING true)
DROP POLICY IF EXISTS "Users can manage their own idempotency keys" ON public.api_idempotency_keys;
CREATE POLICY "Service role manages idempotency keys" ON public.api_idempotency_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- api_rate_limits (was "Users can view rate limits" FOR ALL with USING true)
DROP POLICY IF EXISTS "Users can view rate limits" ON public.api_rate_limits;
CREATE POLICY "Service role manages rate limits" ON public.api_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- access_logs
DROP POLICY IF EXISTS "System can insert access logs" ON public.access_logs;
CREATE POLICY "System can insert access logs" ON public.access_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- structured_logs
DROP POLICY IF EXISTS "Service can insert logs" ON public.structured_logs;
CREATE POLICY "Service can insert logs" ON public.structured_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- automation_logs
DROP POLICY IF EXISTS "automation_logs_insert_policy" ON public.automation_logs;
CREATE POLICY "automation_logs_insert_policy" ON public.automation_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- webhook_deliveries
DROP POLICY IF EXISTS "webhook_deliveries_insert_policy" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries_insert_policy" ON public.webhook_deliveries
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "webhook_deliveries_update_policy" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries_update_policy" ON public.webhook_deliveries
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- application_logs
DROP POLICY IF EXISTS "System can insert logs" ON public.application_logs;
CREATE POLICY "System can insert logs" ON public.application_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- entitlement_audit (was TO authenticated with check true)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.entitlement_audit;
CREATE POLICY "System can insert audit logs" ON public.entitlement_audit
  FOR INSERT TO service_role WITH CHECK (true);

-- email_notifications_log
DROP POLICY IF EXISTS "email_log_insert_service" ON public.email_notifications_log;
CREATE POLICY "email_log_insert_service" ON public.email_notifications_log
  FOR INSERT TO service_role WITH CHECK (true);
