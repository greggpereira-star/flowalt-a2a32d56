
-- Drop broad SELECT policies on public buckets; public URLs still resolve via CDN because buckets remain public=true
DROP POLICY IF EXISTS "Avatar images accessible to authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Client logos accessible to authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Mindmap attachments accessible to authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Social media files accessible to authenticated" ON storage.objects;

-- Also revoke from PUBLIC (covers unauthenticated role default)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Re-grant to authenticated (needed for RPC and RLS helper calls)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Intentional anonymous helpers
GRANT EXECUTE ON FUNCTION public.get_public_idea_board(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon;

-- Default privileges: future functions should follow the same pattern
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
