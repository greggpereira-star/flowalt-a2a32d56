
-- FLOWALT SECURITY HARDENING - PART 3B (Remaining fixes)

-- =====================================================
-- 1. PROFILES - Restringir visibilidade (SEC-1)
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in workspace" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are publicly visible" ON public.profiles;

-- Usuário vê próprio perfil OU perfis de colegas de workspace
CREATE POLICY "profiles_select_restricted" ON public.profiles
FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid()
    AND wm2.user_id = profiles.id
    AND wm1.is_active = true
    AND wm2.is_active = true
  )
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());

-- =====================================================
-- 2. API_KEYS - Separar policies (SEC-4)
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage API keys" ON public.api_keys;

CREATE POLICY "api_keys_select_admin" ON public.api_keys
FOR SELECT USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "api_keys_insert_admin" ON public.api_keys
FOR INSERT WITH CHECK (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "api_keys_update_admin" ON public.api_keys
FOR UPDATE USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "api_keys_delete_admin" ON public.api_keys
FOR DELETE USING (has_admin_access(auth.uid(), workspace_id));

-- =====================================================
-- 3. WEBHOOK_SUBSCRIPTIONS - View segura + policies (SEC-5)
-- =====================================================

DROP VIEW IF EXISTS public.webhook_subscriptions_safe;

CREATE VIEW public.webhook_subscriptions_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  workspace_id,
  name,
  url,
  events,
  is_active,
  created_by,
  created_at,
  updated_at,
  '***MASKED***'::text as secret
FROM public.webhook_subscriptions;

DROP POLICY IF EXISTS "Admins can manage webhooks" ON public.webhook_subscriptions;

CREATE POLICY "webhook_select_admin" ON public.webhook_subscriptions
FOR SELECT USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "webhook_insert_admin" ON public.webhook_subscriptions
FOR INSERT WITH CHECK (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "webhook_update_admin" ON public.webhook_subscriptions
FOR UPDATE USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "webhook_delete_admin" ON public.webhook_subscriptions
FOR DELETE USING (has_admin_access(auth.uid(), workspace_id));

-- =====================================================
-- 4. TRANSACTIONS - Políticas mais restritivas (SEC-3)
-- =====================================================

DROP POLICY IF EXISTS "Members with financial access can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members with financial access can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_financial" ON public.transactions;

CREATE POLICY "transactions_select_financial_strict" ON public.transactions
FOR SELECT USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = transactions.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

DROP POLICY IF EXISTS "transactions_insert_financial" ON public.transactions;
CREATE POLICY "transactions_insert_financial" ON public.transactions
FOR INSERT WITH CHECK (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = transactions.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

DROP POLICY IF EXISTS "transactions_update_financial" ON public.transactions;
CREATE POLICY "transactions_update_financial" ON public.transactions
FOR UPDATE USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = transactions.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.is_active = true
    AND wm.can_view_financials = true
  )
);

DROP POLICY IF EXISTS "transactions_delete_financial" ON public.transactions;
CREATE POLICY "transactions_delete_financial" ON public.transactions
FOR DELETE USING (has_admin_access(auth.uid(), workspace_id));

-- =====================================================
-- Comentários finais
-- =====================================================

COMMENT ON POLICY "profiles_select_restricted" ON public.profiles IS 
'Usuários só veem próprio perfil ou perfis de colegas de workspace ativos';

COMMENT ON VIEW public.webhook_subscriptions_safe IS 
'View segura que mascara o secret do webhook';

COMMENT ON POLICY "transactions_select_financial_strict" ON public.transactions IS 
'Transações só visíveis para admin ou membros com can_view_financials';
