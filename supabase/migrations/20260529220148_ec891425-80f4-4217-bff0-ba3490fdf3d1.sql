
-- Fix mutable search_path on public functions
ALTER FUNCTION public.audit_folder_changes() SET search_path = public;
ALTER FUNCTION public.audit_transaction_changes() SET search_path = public;
ALTER FUNCTION public.idea_set_updated_at() SET search_path = public;
ALTER FUNCTION public.user_has_workspace_access(ws_id uuid) SET search_path = public;
ALTER FUNCTION public.user_is_workspace_admin(ws_id uuid) SET search_path = public;

-- Lock down infra tables (RLS enabled, no policy). These are service_role-only.
-- Add explicit deny policies so client roles cannot access them even if grants change.
REVOKE ALL ON public.api_idempotency_keys FROM anon, authenticated;
REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;
REVOKE ALL ON public.oauth_states FROM anon, authenticated;

GRANT ALL ON public.api_idempotency_keys TO service_role;
GRANT ALL ON public.api_rate_limits TO service_role;
GRANT ALL ON public.oauth_states TO service_role;

CREATE POLICY "deny all client access" ON public.api_idempotency_keys AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny all client access" ON public.api_rate_limits AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny all client access" ON public.oauth_states AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
