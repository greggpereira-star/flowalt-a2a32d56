REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;