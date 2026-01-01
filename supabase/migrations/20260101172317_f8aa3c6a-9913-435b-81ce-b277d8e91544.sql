-- Drop all conflicting functions first
DROP FUNCTION IF EXISTS public.can_access_space(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_folder(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_card(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_elevated_role(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_view_sensitive_financial(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_super_admin(uuid) CASCADE;