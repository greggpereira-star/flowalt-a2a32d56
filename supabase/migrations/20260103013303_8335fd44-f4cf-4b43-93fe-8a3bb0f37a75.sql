-- =====================================================
-- MÓDULO SOCIAL MEDIA: Entitlements + Tabelas + RLS
-- Sprint 1: Fundação
-- =====================================================

-- 1. REGISTRAR ENTITLEMENTS NO REGISTRY
-- =====================================================

INSERT INTO entitlement_registry (key, name, description, type, category, default_enabled, default_limit, unit, ui_visibility) VALUES
-- PRO + Enterprise
('social_publish', 'Publicação Social', 'Criar e publicar posts em redes sociais', 'boolean', 'social', false, null, null, 'paywall'),
('social_schedule', 'Agendamento de Posts', 'Agendar publicações para data/hora específica', 'boolean', 'social', false, null, null, 'paywall'),
('social_calendar', 'Calendário Editorial', 'Visualização de calendário de publicações', 'boolean', 'social', false, null, null, 'paywall'),
('social_metrics_basic', 'Métricas Básicas', 'Alcance, impressões, curtidas, comentários', 'boolean', 'social', false, null, null, 'paywall'),
('social_utm_builder', 'Construtor de UTM', 'Gerar parâmetros UTM automaticamente', 'boolean', 'social', false, null, null, 'paywall'),
('social_platforms_limit', 'Limite de Plataformas', 'Número máximo de plataformas conectadas', 'limit', 'social', true, 3, 'platforms', 'paywall'),
('social_history_days', 'Histórico de Posts', 'Dias de histórico de publicações', 'limit', 'social', true, 90, 'days', 'paywall'),
-- Enterprise Only
('social_reports', 'Relatórios Avançados', 'Relatórios por cliente, período e plataforma', 'boolean', 'social', false, null, null, 'paywall'),
('social_insights_ai', 'Insights com IA', 'Análise inteligente de performance e sugestões', 'boolean', 'social', false, null, null, 'paywall'),
('social_hashtag_library', 'Biblioteca de Hashtags', 'Gerenciar e reutilizar hashtags por categoria', 'boolean', 'social', false, null, null, 'paywall'),
('social_content_recycling', 'Reciclagem de Conteúdo', 'Sugestões de repost de conteúdo evergreen', 'boolean', 'social', false, null, null, 'paywall'),
('social_smart_schedule', 'Agendamento Inteligente', 'Sugestão de melhor horário para publicar', 'boolean', 'social', false, null, null, 'paywall'),
('social_competitor_benchmark', 'Benchmark de Mercado', 'Comparação com concorrentes do nicho', 'boolean', 'social', false, null, null, 'paywall')
ON CONFLICT (key) DO NOTHING;

-- 2. VINCULAR ENTITLEMENTS AOS PLANOS
-- =====================================================

-- PRO: Operação
INSERT INTO plan_entitlements (plan_key, entitlement_key, enabled, limit_value) VALUES
('pro', 'social_publish', true, null),
('pro', 'social_schedule', true, null),
('pro', 'social_calendar', true, null),
('pro', 'social_metrics_basic', true, null),
('pro', 'social_utm_builder', true, null),
('pro', 'social_platforms_limit', true, 3),
('pro', 'social_history_days', true, 90)
ON CONFLICT (plan_key, entitlement_key) DO NOTHING;

-- Enterprise: Inteligência + Tudo do PRO
INSERT INTO plan_entitlements (plan_key, entitlement_key, enabled, limit_value) VALUES
('enterprise', 'social_publish', true, null),
('enterprise', 'social_schedule', true, null),
('enterprise', 'social_calendar', true, null),
('enterprise', 'social_metrics_basic', true, null),
('enterprise', 'social_utm_builder', true, null),
('enterprise', 'social_platforms_limit', true, 999),
('enterprise', 'social_history_days', true, 365),
('enterprise', 'social_reports', true, null),
('enterprise', 'social_insights_ai', true, null),
('enterprise', 'social_hashtag_library', true, null),
('enterprise', 'social_content_recycling', true, null),
('enterprise', 'social_smart_schedule', true, null),
('enterprise', 'social_competitor_benchmark', true, null)
ON CONFLICT (plan_key, entitlement_key) DO NOTHING;

-- 3. CRIAR TIPO ENUM PARA PLATAFORMAS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE social_platform_type AS ENUM ('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE social_content_type AS ENUM ('feed', 'story', 'reels', 'carousel', 'video', 'short', 'article');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE social_post_status AS ENUM ('draft', 'pending_approval', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE content_pillar_type AS ENUM ('educational', 'sales', 'entertainment', 'relationship', 'institutional', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE funnel_stage_type AS ENUM ('tofu', 'mofu', 'bofu');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. TABELA PRINCIPAL: social_posts
-- =====================================================

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  client_id UUID REFERENCES client_cards(id) ON DELETE SET NULL,
  
  -- Conteúdo
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  media_urls JSONB DEFAULT '[]',
  first_comment TEXT,
  
  -- Plataforma & Tipo
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  
  -- Agendamento
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Erro & Retry
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Métricas
  metrics JSONB DEFAULT '{}',
  metrics_updated_at TIMESTAMPTZ,
  
  -- Integração
  platform_post_id TEXT,
  platform_url TEXT,
  
  -- Marketing Intelligence
  content_pillar TEXT,
  funnel_stage TEXT,
  campaign_name TEXT,
  utm_params JSONB,
  ab_test_group TEXT,
  
  -- Governança
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  visibility TEXT DEFAULT 'inherit',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_social_posts_workspace ON social_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_card ON social_posts(card_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_client ON social_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_published ON social_posts(published_at DESC);

-- 5. TABELA: social_platforms (Conexões OAuth)
-- =====================================================

CREATE TABLE IF NOT EXISTS social_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  platform TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_type TEXT DEFAULT 'business',
  profile_image_url TEXT,
  
  -- OAuth
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'connected',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_platforms_workspace ON social_platforms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_platforms_active ON social_platforms(workspace_id, is_active) WHERE is_active = true;

-- 6. TABELA: social_hashtag_library (Enterprise)
-- =====================================================

CREATE TABLE IF NOT EXISTS social_hashtag_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES client_cards(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  hashtags TEXT[] NOT NULL,
  category TEXT,
  description TEXT,
  
  -- Analytics
  usage_count INTEGER DEFAULT 0,
  avg_engagement_boost NUMERIC(5,2),
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_hashtag_library_workspace ON social_hashtag_library(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_hashtag_library_client ON social_hashtag_library(client_id);

-- 7. TABELA: social_post_templates
-- =====================================================

CREATE TABLE IF NOT EXISTS social_post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  platform TEXT,
  content_type TEXT,
  caption_template TEXT,
  hashtag_library_ids UUID[],
  content_pillar TEXT,
  funnel_stage TEXT,
  
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_post_templates_workspace ON social_post_templates(workspace_id);

-- 8. RLS POLICIES
-- =====================================================

-- social_posts RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social posts in their workspace" ON social_posts
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert social posts in their workspace" ON social_posts
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update social posts in their workspace" ON social_posts
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete social posts in their workspace" ON social_posts
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- social_platforms RLS
ALTER TABLE social_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social platforms in their workspace" ON social_platforms
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert social platforms in their workspace" ON social_platforms
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update social platforms in their workspace" ON social_platforms
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete social platforms in their workspace" ON social_platforms
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- social_hashtag_library RLS
ALTER TABLE social_hashtag_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hashtag library in their workspace" ON social_hashtag_library
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert hashtag library in their workspace" ON social_hashtag_library
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update hashtag library in their workspace" ON social_hashtag_library
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete hashtag library in their workspace" ON social_hashtag_library
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- social_post_templates RLS
ALTER TABLE social_post_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post templates in their workspace" ON social_post_templates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert post templates in their workspace" ON social_post_templates
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update post templates in their workspace" ON social_post_templates
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete post templates in their workspace" ON social_post_templates
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 9. TRIGGER PARA updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_social_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_social_posts_updated_at ON social_posts;
CREATE TRIGGER trigger_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

DROP TRIGGER IF EXISTS trigger_social_platforms_updated_at ON social_platforms;
CREATE TRIGGER trigger_social_platforms_updated_at
  BEFORE UPDATE ON social_platforms
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

DROP TRIGGER IF EXISTS trigger_social_hashtag_library_updated_at ON social_hashtag_library;
CREATE TRIGGER trigger_social_hashtag_library_updated_at
  BEFORE UPDATE ON social_hashtag_library
  FOR EACH ROW EXECUTE FUNCTION update_social_updated_at();

-- 10. ENABLE REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE social_platforms;