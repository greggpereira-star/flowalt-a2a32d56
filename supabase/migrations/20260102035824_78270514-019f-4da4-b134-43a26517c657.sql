-- =====================================================
-- MÓDULO COMPLETO: Filtros e Visões Personalizadas
-- =====================================================

-- 1. Tabela de Visões Salvas
CREATE TABLE IF NOT EXISTS public.user_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('space', 'folder', 'global')),
  scope_id uuid NULL,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort jsonb DEFAULT '{}'::jsonb,
  view_mode text DEFAULT 'kanban' CHECK (view_mode IN ('kanban', 'list', 'calendar')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de Estado Atual
CREATE TABLE IF NOT EXISTS public.user_view_last_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('space', 'folder', 'global')),
  scope_id uuid NULL,
  last_query jsonb DEFAULT '{}'::jsonb,
  last_view_mode text DEFAULT 'kanban',
  last_used_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id, scope_type, scope_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_user_saved_views_workspace_user ON public.user_saved_views(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_views_scope ON public.user_saved_views(workspace_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_views_query ON public.user_saved_views USING GIN (query jsonb_path_ops);

-- 4. Habilitar RLS
ALTER TABLE public.user_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_view_last_state ENABLE ROW LEVEL SECURITY;

-- 5. Policies RLS
CREATE POLICY user_saved_views_all ON public.user_saved_views FOR ALL 
  USING (user_id = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY user_view_last_state_all ON public.user_view_last_state FOR ALL 
  USING (user_id = auth.uid() AND is_workspace_member(auth.uid(), workspace_id));

-- 6. Entitlements
INSERT INTO public.entitlement_registry (key, name, description, category, type, default_enabled, default_limit, unit)
VALUES ('saved_views_limit', 'Saved Views Limit', 'Max saved views per user', 'features', 'limit', true, 3, 'views')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_key, entitlement_key, enabled, limit_value)
VALUES ('free', 'saved_views_limit', true, 3), ('pro', 'saved_views_limit', true, 20), ('enterprise', 'saved_views_limit', true, 1000)
ON CONFLICT (plan_key, entitlement_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;