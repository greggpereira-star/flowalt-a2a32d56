-- =====================================================
-- BLUEPRINT CONSOLIDADO - STEP 1: DB Schema (parte restante)
-- =====================================================

-- 1.3 Update audit_logs with actor_type (usando user_id existente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_type') THEN
    ALTER TABLE public.audit_logs ADD COLUMN actor_type TEXT DEFAULT 'workspace_user';
  END IF;
END $$;

-- 1.4 Space Templates table
CREATE TABLE IF NOT EXISTS public.space_templates (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_optional BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.space_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates
DROP POLICY IF EXISTS "Anyone can read space templates" ON public.space_templates;
CREATE POLICY "Anyone can read space templates"
  ON public.space_templates FOR SELECT
  USING (true);

-- 1.5 Add template_key to spaces (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'template_key') THEN
    ALTER TABLE public.spaces ADD COLUMN template_key TEXT;
  END IF;
END $$;

-- 1.6 Ensure folders has visibility column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'folders' AND column_name = 'visibility') THEN
    ALTER TABLE public.folders ADD COLUMN visibility TEXT DEFAULT 'public';
  END IF;
END $$;

-- Migrate is_restricted to visibility
UPDATE public.folders 
SET visibility = CASE WHEN is_restricted = true THEN 'restricted' ELSE 'public' END
WHERE visibility IS NULL OR visibility = '';

-- 1.7 Ensure folder_members has proper structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'folder_members' AND column_name = 'can_view') THEN
    ALTER TABLE public.folder_members ADD COLUMN can_view BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'folder_members' AND column_name = 'can_edit') THEN
    ALTER TABLE public.folder_members ADD COLUMN can_edit BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'folder_members' AND column_name = 'can_delete') THEN
    ALTER TABLE public.folder_members ADD COLUMN can_delete BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 1.8 Ensure card_members has proper structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_members' AND column_name = 'can_view') THEN
    ALTER TABLE public.card_members ADD COLUMN can_view BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_members' AND column_name = 'can_edit') THEN
    ALTER TABLE public.card_members ADD COLUMN can_edit BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_members' AND column_name = 'can_delete') THEN
    ALTER TABLE public.card_members ADD COLUMN can_delete BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 1.9 Insert default space templates
INSERT INTO public.space_templates (key, name, description, definition, is_optional)
VALUES 
  ('blank', 'Espaço em Branco', 'Comece do zero sem estrutura predefinida', '{"folders": [], "views": [], "customFields": [], "features": []}'::jsonb, true),
  ('social_media', 'Social Media', 'Template para gestão de redes sociais com calendário editorial', '{
    "folders": [
      {"name": "Ideias", "icon": "Lightbulb", "color": "#f59e0b"},
      {"name": "Em Produção", "icon": "Clapperboard", "color": "#3b82f6"},
      {"name": "Aprovação", "icon": "CheckCircle", "color": "#8b5cf6"},
      {"name": "Publicado", "icon": "Send", "color": "#10b981"}
    ],
    "views": [
      {"name": "Calendário Editorial", "type": "calendar"},
      {"name": "Kanban Conteúdo", "type": "kanban"},
      {"name": "Lista Aprovações", "type": "list"},
      {"name": "Checklist Semanal", "type": "checklist"}
    ],
    "customFields": [
      {"key": "platform", "name": "Plataforma", "type": "select", "options": ["Instagram", "Facebook", "LinkedIn", "TikTok", "Twitter", "YouTube"]},
      {"key": "content_type", "name": "Tipo de Conteúdo", "type": "select", "options": ["Post", "Story", "Reel", "Vídeo", "Carrossel"]},
      {"key": "publish_date", "name": "Data de Publicação", "type": "date"},
      {"key": "editorial_status", "name": "Status Editorial", "type": "select", "options": ["Rascunho", "Em Revisão", "Aprovado", "Publicado"]}
    ],
    "features": ["Pastas por colaborador", "Calendário visual", "Aprovações", "Banco de ideias"]
  }'::jsonb, true),
  ('audiovisual', 'Audiovisual', 'Template para produção de vídeo e áudio', '{
    "folders": [
      {"name": "Pré-Produção", "icon": "FileText", "color": "#6366f1"},
      {"name": "Produção", "icon": "Video", "color": "#f59e0b"},
      {"name": "Pós-Produção", "icon": "Film", "color": "#8b5cf6"},
      {"name": "Entregue", "icon": "Check", "color": "#10b981"}
    ],
    "views": [
      {"name": "Timeline", "type": "gantt"},
      {"name": "Kanban", "type": "kanban"}
    ],
    "customFields": [
      {"key": "project_type", "name": "Tipo de Projeto", "type": "select", "options": ["Vídeo Institucional", "Comercial", "Documentário", "Social", "Evento"]},
      {"key": "duration", "name": "Duração Estimada", "type": "text"},
      {"key": "delivery_date", "name": "Data de Entrega", "type": "date"}
    ],
    "features": ["Gestão de equipamentos", "Timeline de produção", "Controle de entregas"]
  }'::jsonb, true),
  ('designer', 'Design', 'Template para projetos de design gráfico', '{
    "folders": [
      {"name": "Briefing", "icon": "ClipboardList", "color": "#6366f1"},
      {"name": "Criação", "icon": "Palette", "color": "#f59e0b"},
      {"name": "Revisão", "icon": "Eye", "color": "#8b5cf6"},
      {"name": "Aprovado", "icon": "ThumbsUp", "color": "#10b981"}
    ],
    "views": [
      {"name": "Kanban", "type": "kanban"},
      {"name": "Lista", "type": "list"}
    ],
    "customFields": [
      {"key": "design_type", "name": "Tipo de Peça", "type": "select", "options": ["Logo", "Banner", "Folder", "Cartão", "Embalagem", "UI/UX"]},
      {"key": "format", "name": "Formato", "type": "text"}
    ],
    "features": ["Gestão de versões", "Feedback visual", "Biblioteca de assets"]
  }'::jsonb, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  definition = EXCLUDED.definition,
  updated_at = now();

-- 1.10 Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(user_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_action ON public.audit_logs(workspace_id, action);
CREATE INDEX IF NOT EXISTS idx_folder_members_folder ON public.folder_members(folder_id);
CREATE INDEX IF NOT EXISTS idx_card_members_card ON public.card_members(card_id);

-- 1.11 Update trigger for space_templates
CREATE OR REPLACE FUNCTION public.update_space_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_space_templates_updated_at ON public.space_templates;
CREATE TRIGGER update_space_templates_updated_at
  BEFORE UPDATE ON public.space_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_space_templates_updated_at();