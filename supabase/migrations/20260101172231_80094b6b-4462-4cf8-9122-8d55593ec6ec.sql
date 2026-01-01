-- =====================================================
-- STEP 1 RETRY: Create platform_super_admins and support_sessions
-- =====================================================

-- Platform Super Admins table
CREATE TABLE IF NOT EXISTS public.platform_super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.platform_super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_select" ON public.platform_super_admins;
CREATE POLICY "super_admins_select"
  ON public.platform_super_admins FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.platform_super_admins));

-- Support Sessions table
CREATE TABLE IF NOT EXISTS public.support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'read_only' CHECK (mode IN ('read_only', 'elevated')),
  scope JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admins_manage_sessions" ON public.support_sessions;
CREATE POLICY "super_admins_manage_sessions"
  ON public.support_sessions FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.platform_super_admins));