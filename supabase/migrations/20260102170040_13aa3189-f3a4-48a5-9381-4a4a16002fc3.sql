-- Security hardening: ensure function search_path is set (prevents search_path hijacking)
ALTER FUNCTION public.update_notification_prefs_updated_at() SET search_path = public;