
-- =====================================================
-- HARDENING FINAL: Social Media Module
-- Blueprint Compliance + Security + Audit
-- =====================================================

-- 1) DROP políticas antigas/duplicadas (cleanup)
DROP POLICY IF EXISTS "Users can view social posts in their workspace" ON public.social_posts;
DROP POLICY IF EXISTS "Users can insert social posts in their workspace" ON public.social_posts;
DROP POLICY IF EXISTS "Users can update social posts in their workspace" ON public.social_posts;
DROP POLICY IF EXISTS "Users can delete social posts in their workspace" ON public.social_posts;
DROP POLICY IF EXISTS "social_posts_select_policy" ON public.social_posts;
DROP POLICY IF EXISTS "social_posts_insert_policy" ON public.social_posts;
DROP POLICY IF EXISTS "social_posts_update_policy" ON public.social_posts;
DROP POLICY IF EXISTS "social_posts_delete_policy" ON public.social_posts;

-- 2) Criar função has_elevated_role (Blueprint pattern - suporta múltiplos owners)
CREATE OR REPLACE FUNCTION public.has_elevated_role(
  p_user_id UUID,
  p_workspace_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id 
    AND role IN ('owner', 'admin', 'coordinator')
  );
$$;

-- 3) Criar função has_card_permission (Blueprint pattern)
CREATE OR REPLACE FUNCTION public.has_card_permission(
  p_user_id UUID,
  p_card_id UUID,
  p_permission TEXT -- 'view', 'edit', 'delete'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM card_members 
    WHERE user_id = p_user_id 
    AND card_id = p_card_id 
    AND CASE p_permission
      WHEN 'view' THEN COALESCE(can_view, false)
      WHEN 'edit' THEN COALESCE(can_edit, false)
      WHEN 'delete' THEN COALESCE(can_delete, false)
      ELSE false
    END
  );
$$;

-- 4) Criar card de sistema para posts sem card (se necessário no futuro)
-- Por enquanto, card_id será obrigatório via RLS

-- 5) NOVAS POLICIES RLS - SEM bypass card_id IS NULL
-- Agora card_id IS NULL só permitido para elevated roles (Owner/Admin)

-- SELECT: Ver posts
CREATE POLICY "social_posts_select_v2" ON public.social_posts
FOR SELECT USING (
  -- Must be workspace member
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    -- Elevated role sees all workspace posts
    has_elevated_role(auth.uid(), workspace_id)
    OR
    -- Has card view permission (quando card_id existe)
    (card_id IS NOT NULL AND has_card_permission(auth.uid(), card_id, 'view'))
    OR
    -- É o criador do post
    created_by = auth.uid()
  )
);

-- INSERT: Criar posts
CREATE POLICY "social_posts_insert_v2" ON public.social_posts
FOR INSERT WITH CHECK (
  -- Must be workspace member
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    -- Elevated role can create anywhere
    has_elevated_role(auth.uid(), workspace_id)
    OR
    -- Has card edit permission (card_id obrigatório para não-elevated)
    (card_id IS NOT NULL AND has_card_permission(auth.uid(), card_id, 'edit'))
  )
  -- created_by must be current user (audit trail)
  AND (created_by IS NULL OR created_by = auth.uid())
);

-- UPDATE: Editar posts
CREATE POLICY "social_posts_update_v2" ON public.social_posts
FOR UPDATE USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    -- Elevated role can update any post
    has_elevated_role(auth.uid(), workspace_id)
    OR
    -- Creator can update own drafts/pending
    (created_by = auth.uid() AND status IN ('draft', 'pending_approval'))
    OR
    -- Has card edit permission
    (card_id IS NOT NULL AND has_card_permission(auth.uid(), card_id, 'edit'))
  )
);

-- DELETE: Deletar posts
CREATE POLICY "social_posts_delete_v2" ON public.social_posts
FOR DELETE USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND (
    -- Owner/Admin can delete anything
    has_elevated_role(auth.uid(), workspace_id)
    OR
    -- Creator can delete own drafts only
    (created_by = auth.uid() AND status = 'draft')
    OR
    -- Has card delete permission (apenas para drafts/pending)
    (card_id IS NOT NULL AND has_card_permission(auth.uid(), card_id, 'delete') AND status IN ('draft', 'pending_approval'))
  )
);

-- 6) Tornar created_by NOT NULL (após garantir default)
ALTER TABLE public.social_posts ALTER COLUMN created_by SET DEFAULT auth.uid();
-- Não forçamos NOT NULL agora pois edge functions podem precisar de system actor

-- 7) Criar audit trigger melhorado
CREATE OR REPLACE FUNCTION public.audit_social_post_changes_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_type TEXT;
  v_payload JSONB;
  v_actor_id UUID;
BEGIN
  -- Determinar actor (user ou system)
  v_actor_id := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
  
  -- Determinar tipo de evento baseado na operação
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'social_post.created';
    v_payload := jsonb_build_object(
      'post_id', NEW.id,
      'workspace_id', NEW.workspace_id,
      'card_id', NEW.card_id,
      'client_id', NEW.client_id,
      'platform', NEW.platform,
      'content_type', NEW.content_type,
      'status', NEW.status,
      'actor_id', v_actor_id
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Verificar se é mudança de status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Eventos específicos por status
      CASE NEW.status
        WHEN 'scheduled' THEN v_event_type := 'social_post.scheduled';
        WHEN 'published' THEN v_event_type := 'social_post.published';
        WHEN 'failed' THEN v_event_type := 'social_post.failed';
        WHEN 'approved' THEN v_event_type := 'social_post.approved';
        ELSE v_event_type := 'social_post.status_changed';
      END CASE;
      
      v_payload := jsonb_build_object(
        'post_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'card_id', NEW.card_id,
        'platform', NEW.platform,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'actor_id', v_actor_id
      );
    ELSE
      -- Mudança de outros campos críticos
      v_event_type := 'social_post.updated';
      v_payload := jsonb_build_object(
        'post_id', NEW.id,
        'workspace_id', NEW.workspace_id,
        'card_id', NEW.card_id,
        'platform', NEW.platform,
        'actor_id', v_actor_id,
        'changed_fields', (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(to_jsonb(NEW))
          WHERE key NOT IN ('updated_at', 'metrics_updated_at')
          AND to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
        )
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'social_post.deleted';
    v_payload := jsonb_build_object(
      'post_id', OLD.id,
      'workspace_id', OLD.workspace_id,
      'card_id', OLD.card_id,
      'platform', OLD.platform,
      'status_at_deletion', OLD.status,
      'actor_id', v_actor_id
    );
  END IF;
  
  -- Inserir evento de auditoria (apenas se não for update trivial)
  IF v_event_type IS NOT NULL AND (TG_OP != 'UPDATE' OR v_payload->>'changed_fields' IS NOT NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO domain_events (
      workspace_id,
      aggregate_type,
      aggregate_id,
      event_type,
      payload
    ) VALUES (
      COALESCE(NEW.workspace_id, OLD.workspace_id),
      'social_post',
      COALESCE(NEW.id, OLD.id),
      v_event_type,
      v_payload
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS audit_social_posts ON public.social_posts;
DROP TRIGGER IF EXISTS audit_social_posts_v2 ON public.social_posts;
CREATE TRIGGER audit_social_posts_v2
  AFTER INSERT OR UPDATE OR DELETE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION audit_social_post_changes_v2();

-- 8) Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_card_status 
  ON public.social_posts(workspace_id, card_id, status);
  
CREATE INDEX IF NOT EXISTS idx_social_posts_calendar 
  ON public.social_posts(workspace_id, scheduled_at) 
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_created_by 
  ON public.social_posts(created_by);

-- 9) Função de verificação de entitlement para social (não bloqueia onboarding)
CREATE OR REPLACE FUNCTION public.check_social_entitlement_safe(
  p_workspace_id UUID,
  p_action TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_entitlement_key TEXT;
  v_entitlement RECORD;
  v_result JSONB;
BEGIN
  -- Mapear ação para entitlement
  v_entitlement_key := CASE p_action
    WHEN 'publish' THEN 'social_publish'
    WHEN 'schedule' THEN 'social_schedule'
    WHEN 'view_calendar' THEN 'social_calendar'
    WHEN 'view_metrics' THEN 'social_metrics_basic'
    WHEN 'view_reports' THEN 'social_reports'
    WHEN 'view_insights' THEN 'social_insights_ai'
    ELSE NULL
  END;
  
  -- Se não mapeou, permitir (não bloquear)
  IF v_entitlement_key IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'unmapped_action');
  END IF;
  
  -- Buscar entitlement efetivo
  SELECT * INTO v_entitlement
  FROM workspace_entitlements_effective
  WHERE workspace_id = p_workspace_id
  AND entitlement_key = v_entitlement_key;
  
  -- Se não encontrou, verificar se é workspace novo (permitir básico)
  IF v_entitlement IS NULL THEN
    -- Workspace pode estar em criação, não bloquear
    RETURN jsonb_build_object(
      'allowed', true, 
      'reason', 'entitlement_not_configured',
      'warning', 'Entitlement não encontrado, permitindo acesso básico'
    );
  END IF;
  
  -- Verificar se habilitado
  IF NOT COALESCE(v_entitlement.enabled, false) THEN
    -- Logar bloqueio
    INSERT INTO domain_events (
      workspace_id, aggregate_type, aggregate_id, event_type, payload
    ) VALUES (
      p_workspace_id, 'entitlement', v_entitlement_key, 'entitlement.blocked',
      jsonb_build_object(
        'action', p_action,
        'entitlement', v_entitlement_key,
        'user_id', auth.uid(),
        'plan', v_entitlement.plan_key
      )
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'plan_limit',
      'entitlement', v_entitlement_key,
      'plan', v_entitlement.plan_key,
      'cta', 'Faça upgrade para acessar este recurso'
    );
  END IF;
  
  RETURN jsonb_build_object('allowed', true, 'entitlement', v_entitlement_key);
END;
$$;

-- 10) Grant para funções novas
GRANT EXECUTE ON FUNCTION public.has_elevated_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_card_permission(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_social_entitlement_safe(UUID, TEXT) TO authenticated;
