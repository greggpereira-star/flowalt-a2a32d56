-- STEP 2: Tabelas + RLS + Funções (tudo junto)

-- Função audit
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF COALESCE(NEW.workspace_id, OLD.workspace_id) IS NOT NULL THEN
    INSERT INTO public.audit_logs (workspace_id, user_id, entity_type, entity_id, action, old_data, new_data, actor_type)
    VALUES (COALESCE(NEW.workspace_id, OLD.workspace_id), auth.uid(), TG_TABLE_NAME, COALESCE(NEW.id, OLD.id)::text, TG_OP,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END, 'user');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Tabelas
CREATE TABLE public.workspace_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_tier public.plan_tier NOT NULL DEFAULT 'free',
  status public.plan_status NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '1 month'),
  provider public.billing_provider NOT NULL DEFAULT 'manual',
  provider_customer_id text, provider_subscription_id text,
  seats_limit integer NOT NULL DEFAULT 3, spaces_limit integer NOT NULL DEFAULT 3,
  storage_mb_limit integer NOT NULL DEFAULT 100, webhooks_limit integer NOT NULL DEFAULT 0, api_keys_limit integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key text NOT NULL, value jsonb NOT NULL DEFAULT '{"enabled": false}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE public.workspace_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  period_end date NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  seats_used integer DEFAULT 0, spaces_used integer DEFAULT 0, storage_mb_used integer DEFAULT 0,
  api_keys_used integer DEFAULT 0, webhooks_used integer DEFAULT 0, events_ingested integer DEFAULT 0, automations_runs integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period_start)
);

-- RLS
ALTER TABLE public.workspace_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wp_select" ON public.workspace_plans FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id) OR EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));
CREATE POLICY "wp_update" ON public.workspace_plans FOR UPDATE USING (has_admin_access(auth.uid(), workspace_id) OR EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));
CREATE POLICY "wp_insert" ON public.workspace_plans FOR INSERT WITH CHECK (has_admin_access(auth.uid(), workspace_id) OR EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));

CREATE POLICY "we_select" ON public.workspace_entitlements FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id) OR EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));
CREATE POLICY "we_manage" ON public.workspace_entitlements FOR ALL USING (EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));

CREATE POLICY "wu_select" ON public.workspace_usage FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id) OR EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));
CREATE POLICY "wu_manage" ON public.workspace_usage FOR ALL USING (has_admin_access(auth.uid(), workspace_id) OR EXISTS (SELECT 1 FROM platform_super_admins WHERE user_id = auth.uid()));

-- Funções de plano
CREATE OR REPLACE FUNCTION public.get_workspace_plan(p_workspace_id uuid)
RETURNS TABLE(plan_tier public.plan_tier, status public.plan_status, seats_limit int, spaces_limit int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT plan_tier, status, seats_limit, spaces_limit FROM workspace_plans WHERE workspace_id = p_workspace_id;
$$;

CREATE OR REPLACE FUNCTION public.has_entitlement(p_workspace_id uuid, p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false) FROM workspace_entitlements WHERE workspace_id = p_workspace_id AND key = p_key;
$$;

CREATE OR REPLACE FUNCTION public.within_limit(p_workspace_id uuid, p_metric text, p_increment int DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_limit int; v_used int;
BEGIN
  SELECT CASE p_metric WHEN 'seats' THEN seats_limit WHEN 'spaces' THEN spaces_limit WHEN 'api_keys' THEN api_keys_limit WHEN 'webhooks' THEN webhooks_limit END INTO v_limit FROM workspace_plans WHERE workspace_id = p_workspace_id;
  SELECT CASE p_metric WHEN 'seats' THEN seats_used WHEN 'spaces' THEN spaces_used WHEN 'api_keys' THEN api_keys_used WHEN 'webhooks' THEN webhooks_used END INTO v_used FROM workspace_usage WHERE workspace_id = p_workspace_id AND period_start = date_trunc('month', now())::date;
  RETURN COALESCE(v_used, 0) + p_increment <= COALESCE(v_limit, 0);
END;
$$;