
-- =====================================================
-- HARDENING FINAL DO MÓDULO SOCIAL - PRODUÇÃO ENTERPRISE
-- =====================================================

-- 1.1) GARANTIR CARD PADRÃO POR WORKSPACE (para posts órfãos futuros)
-- Criar função para obter/criar card padrão de Marketing
CREATE OR REPLACE FUNCTION public.get_or_create_marketing_card(p_workspace_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id UUID;
  v_space_id UUID;
BEGIN
  -- Buscar card existente de Marketing Geral
  SELECT c.id INTO v_card_id
  FROM cards c
  WHERE c.workspace_id = p_workspace_id
    AND c.title = 'Marketing Geral'
    AND c.visibility = 'workspace'
  LIMIT 1;
  
  IF v_card_id IS NOT NULL THEN
    RETURN v_card_id;
  END IF;
  
  -- Buscar ou criar space de Marketing
  SELECT id INTO v_space_id
  FROM spaces
  WHERE workspace_id = p_workspace_id
    AND (name ILIKE '%marketing%' OR template = 'social_media')
  LIMIT 1;
  
  IF v_space_id IS NULL THEN
    -- Criar space de Marketing se não existir
    INSERT INTO spaces (workspace_id, name, description, template, is_active)
    VALUES (p_workspace_id, 'Marketing', 'Space para marketing e mídias sociais', 'social_media', true)
    RETURNING id INTO v_space_id;
  END IF;
  
  -- Criar card de Marketing Geral
  INSERT INTO cards (workspace_id, space_id, title, description, visibility, status)
  VALUES (p_workspace_id, v_space_id, 'Marketing Geral', 'Card padrão para posts de marketing', 'workspace', 'doing')
  RETURNING id INTO v_card_id;
  
  RETURN v_card_id;
END;
$$;

-- 1.2) CONSTRAINT NOT NULL em card_id
-- Primeiro corrigir qualquer registro órfão (se existir)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT workspace_id FROM social_posts WHERE card_id IS NULL
  LOOP
    UPDATE social_posts
    SET card_id = get_or_create_marketing_card(r.workspace_id)
    WHERE workspace_id = r.workspace_id AND card_id IS NULL;
  END LOOP;
END $$;

-- Agora aplicar NOT NULL
ALTER TABLE public.social_posts ALTER COLUMN card_id SET NOT NULL;

-- 1.3) UNIQUE CONSTRAINT para platform_post_id (anti-duplicação de publicação)
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_platform_unique 
ON public.social_posts (platform, platform_post_id) 
WHERE platform_post_id IS NOT NULL;

-- 1.4) CONTENT FINGERPRINT para anti double-click
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS content_fingerprint TEXT;

-- Função para gerar fingerprint
CREATE OR REPLACE FUNCTION public.generate_social_post_fingerprint()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.content_fingerprint := encode(
    sha256(
      (COALESCE(NEW.caption, '') || 
       COALESCE(NEW.platform, '') || 
       COALESCE(NEW.content_type, '') || 
       COALESCE(NEW.card_id::text, '') ||
       COALESCE(NEW.media_urls::text, '[]') ||
       COALESCE(to_char(NEW.scheduled_at, 'YYYY-MM-DD HH24:MI'), ''))::bytea
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_fingerprint ON public.social_posts;
CREATE TRIGGER generate_fingerprint
BEFORE INSERT OR UPDATE OF caption, platform, content_type, card_id, media_urls, scheduled_at
ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.generate_social_post_fingerprint();

-- UNIQUE parcial no fingerprint (apenas para scheduled/publishing/published)
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_fingerprint_unique
ON public.social_posts (workspace_id, content_fingerprint)
WHERE status IN ('scheduled', 'publishing', 'published') AND content_fingerprint IS NOT NULL;

-- 1.5) ENUM DE STATUS (usando CHECK constraint para não quebrar código existente)
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_status_check 
CHECK (status IN ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'error', 'archived'));

-- 1.6) TRIGGER DE MÁQUINA DE ESTADOS
CREATE OR REPLACE FUNCTION public.validate_social_post_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions JSONB := '{
    "draft": ["pending_approval", "scheduled", "archived"],
    "pending_approval": ["scheduled", "draft", "archived"],
    "scheduled": ["publishing", "error", "draft", "archived"],
    "publishing": ["published", "error", "failed"],
    "published": ["archived"],
    "failed": ["scheduled", "draft", "archived"],
    "error": ["scheduled", "draft", "archived"],
    "archived": []
  }'::JSONB;
  allowed_targets JSONB;
BEGIN
  -- Ignora se status não mudou
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Obter transições permitidas do estado atual
  allowed_targets := valid_transitions -> OLD.status;
  
  -- Verificar se a transição é válida
  IF allowed_targets IS NULL OR NOT (allowed_targets ? NEW.status) THEN
    RAISE EXCEPTION 'Transição de status inválida: % -> %. Transições permitidas: %', 
      OLD.status, NEW.status, allowed_targets;
  END IF;
  
  -- Log da transição
  INSERT INTO domain_events (workspace_id, event_type, entity_type, entity_id, payload, actor_id)
  VALUES (
    NEW.workspace_id,
    'social_post.status_changed',
    'social_post',
    NEW.id,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'card_id', NEW.card_id,
      'platform', NEW.platform
    ),
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_status_transition ON public.social_posts;
CREATE TRIGGER validate_status_transition
BEFORE UPDATE OF status ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.validate_social_post_transition();

-- 2) CAMPOS DE RETRY E OBSERVABILIDADE
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS last_error_code TEXT;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ;

-- Atualizar max_retries padrão para 5
ALTER TABLE public.social_posts ALTER COLUMN max_retries SET DEFAULT 5;

-- 3) TABELA social_jobs PARA OBSERVABILIDADE
CREATE TABLE IF NOT EXISTS public.social_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('publish', 'metrics_sync', 'token_refresh', 'retry')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB DEFAULT '{}',
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  attempts INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para social_jobs (apenas admin/owner vê)
ALTER TABLE public.social_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_jobs_select" ON public.social_jobs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    JOIN user_roles ur ON ur.user_id = wm.user_id AND ur.workspace_id = wm.workspace_id
    WHERE wm.workspace_id = social_jobs.workspace_id
      AND wm.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
  )
);

-- Índices para social_jobs
CREATE INDEX IF NOT EXISTS idx_social_jobs_workspace ON public.social_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_jobs_post ON public.social_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_social_jobs_status ON public.social_jobs(status);

-- 4) RLS PARA DOWNGRADE READ-ONLY
-- Função para verificar entitlement de escrita
CREATE OR REPLACE FUNCTION public.has_social_write_entitlement(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_entitlements_effective
    WHERE workspace_id = p_workspace_id
      AND entitlement_key = 'social_publish'
      AND enabled = true
  );
$$;

-- Atualizar policies de INSERT/UPDATE/DELETE para verificar entitlement
DROP POLICY IF EXISTS "social_posts_insert_v2" ON public.social_posts;
CREATE POLICY "social_posts_insert_v3" ON public.social_posts
FOR INSERT WITH CHECK (
  -- Deve ter entitlement de escrita
  has_social_write_entitlement(workspace_id)
  AND
  -- Deve ser membro do workspace
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
  )
  AND
  -- Deve ter acesso ao card
  (
    has_elevated_role(auth.uid(), workspace_id)
    OR
    has_card_permission(auth.uid(), card_id, 'edit')
  )
);

DROP POLICY IF EXISTS "social_posts_update_v2" ON public.social_posts;
CREATE POLICY "social_posts_update_v3" ON public.social_posts
FOR UPDATE USING (
  -- Deve ter entitlement de escrita
  has_social_write_entitlement(workspace_id)
  AND
  -- Membro do workspace
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
  )
  AND
  (
    -- Criador editando draft
    (created_by = auth.uid() AND status IN ('draft', 'pending_approval'))
    OR
    -- Tem permissão no card
    has_card_permission(auth.uid(), card_id, 'edit')
    OR
    -- Role elevada
    has_elevated_role(auth.uid(), workspace_id)
  )
);

DROP POLICY IF EXISTS "social_posts_delete_v2" ON public.social_posts;
CREATE POLICY "social_posts_delete_v3" ON public.social_posts
FOR DELETE USING (
  -- Deve ter entitlement de escrita
  has_social_write_entitlement(workspace_id)
  AND
  -- Membro do workspace
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = social_posts.workspace_id
      AND wm.user_id = auth.uid()
  )
  AND
  (
    -- Criador deletando draft
    (created_by = auth.uid() AND status = 'draft')
    OR
    -- Tem permissão no card
    has_card_permission(auth.uid(), card_id, 'delete')
    OR
    -- Role elevada (owner/admin) para qualquer status
    has_elevated_role(auth.uid(), workspace_id)
  )
);

-- 5) ÍNDICES ADICIONAIS PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_card_status_v2 
ON public.social_posts(workspace_id, card_id, status);

CREATE INDEX IF NOT EXISTS idx_social_posts_workspace_scheduled_status 
ON public.social_posts(workspace_id, scheduled_at) 
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_social_posts_fingerprint 
ON public.social_posts(content_fingerprint) 
WHERE content_fingerprint IS NOT NULL;

-- 6) GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_or_create_marketing_card TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_social_write_entitlement TO authenticated;

-- 7) Atualizar fingerprints existentes
UPDATE public.social_posts
SET content_fingerprint = encode(
  sha256(
    (COALESCE(caption, '') || 
     COALESCE(platform, '') || 
     COALESCE(content_type, '') || 
     COALESCE(card_id::text, '') ||
     COALESCE(media_urls::text, '[]') ||
     COALESCE(to_char(scheduled_at, 'YYYY-MM-DD HH24:MI'), ''))::bytea
  ),
  'hex'
)
WHERE content_fingerprint IS NULL;
