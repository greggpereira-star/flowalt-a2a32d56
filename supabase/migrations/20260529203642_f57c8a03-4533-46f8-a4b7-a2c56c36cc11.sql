
-- =========================================================================
-- Banco de Ideias / Central Criativa — Fase 1
-- =========================================================================

-- 1. Enum de tipos de referência
DO $$ BEGIN
  CREATE TYPE public.idea_reference_type AS ENUM (
    'image','video','link','file','document','text','copy','ad',
    'layout','moodboard','competitor','inspiration','campaign'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 2. idea_boards (pastas/coleções visuais)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.idea_boards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_id     uuid REFERENCES public.spaces(id) ON DELETE SET NULL,
  folder_id    uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  cover_url    text,
  category     text,
  tags         text[] NOT NULL DEFAULT '{}',
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  archived_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_idea_boards_workspace ON public.idea_boards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_idea_boards_folder ON public.idea_boards(folder_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_boards TO authenticated;
GRANT ALL ON public.idea_boards TO service_role;

ALTER TABLE public.idea_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_boards_select" ON public.idea_boards FOR SELECT TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "idea_boards_insert" ON public.idea_boards FOR INSERT TO authenticated
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND created_by = auth.uid());

CREATE POLICY "idea_boards_update" ON public.idea_boards FOR UPDATE TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "idea_boards_delete" ON public.idea_boards FOR DELETE TO authenticated
  USING (
    public.user_is_workspace_admin(workspace_id)
    OR public.has_role(auth.uid(), workspace_id, 'coordinator'::app_role)
  );

-- =========================================================================
-- 3. idea_references (cartões do moodboard)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.idea_references (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  board_id      uuid NOT NULL REFERENCES public.idea_boards(id) ON DELETE CASCADE,
  type          public.idea_reference_type NOT NULL DEFAULT 'inspiration',
  title         text NOT NULL,
  description   text,
  source_url    text,
  thumbnail_url text,
  media_url     text,
  file_url      text,
  file_name     text,
  tags          text[] NOT NULL DEFAULT '{}',
  category      text,
  client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_favorite   boolean NOT NULL DEFAULT false,
  -- IA (preparado para Fase 2)
  ai_tags         text[],
  ai_category     text,
  ai_summary      text,
  ai_suggestions  jsonb,
  ai_confidence   numeric,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_idea_refs_workspace ON public.idea_references(workspace_id);
CREATE INDEX IF NOT EXISTS idx_idea_refs_board ON public.idea_references(board_id);
CREATE INDEX IF NOT EXISTS idx_idea_refs_type ON public.idea_references(type);
CREATE INDEX IF NOT EXISTS idx_idea_refs_tags ON public.idea_references USING GIN(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_references TO authenticated;
GRANT ALL ON public.idea_references TO service_role;

ALTER TABLE public.idea_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_refs_select" ON public.idea_references FOR SELECT TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "idea_refs_insert" ON public.idea_references FOR INSERT TO authenticated
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND created_by = auth.uid());

CREATE POLICY "idea_refs_update" ON public.idea_references FOR UPDATE TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

CREATE POLICY "idea_refs_delete" ON public.idea_references FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.user_is_workspace_admin(workspace_id)
    OR public.has_role(auth.uid(), workspace_id, 'coordinator'::app_role)
  );

-- =========================================================================
-- 4. idea_comments
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.idea_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES public.idea_references(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idea_comments_ref ON public.idea_comments(reference_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_comments TO authenticated;
GRANT ALL ON public.idea_comments TO service_role;

ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_comments_select" ON public.idea_comments FOR SELECT TO authenticated
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "idea_comments_insert" ON public.idea_comments FOR INSERT TO authenticated
  WITH CHECK (public.user_has_workspace_access(workspace_id) AND user_id = auth.uid());
CREATE POLICY "idea_comments_update" ON public.idea_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "idea_comments_delete" ON public.idea_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.user_is_workspace_admin(workspace_id));

-- =========================================================================
-- 5. idea_card_links (ideia ↔ card)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.idea_card_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES public.idea_references(id) ON DELETE CASCADE,
  card_id      uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_idea_card_links_ref ON public.idea_card_links(reference_id);
CREATE INDEX IF NOT EXISTS idx_idea_card_links_card ON public.idea_card_links(card_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_card_links TO authenticated;
GRANT ALL ON public.idea_card_links TO service_role;

ALTER TABLE public.idea_card_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_card_links_select" ON public.idea_card_links FOR SELECT TO authenticated
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "idea_card_links_insert" ON public.idea_card_links FOR INSERT TO authenticated
  WITH CHECK (public.user_has_workspace_access(workspace_id));
CREATE POLICY "idea_card_links_delete" ON public.idea_card_links FOR DELETE TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

-- =========================================================================
-- 6. idea_audit_log (imutável)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.idea_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type  text NOT NULL,    -- 'board' | 'reference' | 'card_link'
  entity_id    uuid NOT NULL,
  action       text NOT NULL,    -- 'create' | 'update' | 'delete' | 'move' | 'card_from_idea'
  user_id      uuid,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idea_audit_workspace ON public.idea_audit_log(workspace_id, created_at DESC);

GRANT SELECT, INSERT ON public.idea_audit_log TO authenticated;
GRANT ALL ON public.idea_audit_log TO service_role;

ALTER TABLE public.idea_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idea_audit_select" ON public.idea_audit_log FOR SELECT TO authenticated
  USING (public.user_has_workspace_access(workspace_id));
CREATE POLICY "idea_audit_insert" ON public.idea_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.user_has_workspace_access(workspace_id));
-- sem update/delete: imutável

-- =========================================================================
-- 7. Triggers de updated_at + auditoria automática
-- =========================================================================
CREATE OR REPLACE FUNCTION public.idea_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_idea_boards_updated ON public.idea_boards;
CREATE TRIGGER trg_idea_boards_updated BEFORE UPDATE ON public.idea_boards
  FOR EACH ROW EXECUTE FUNCTION public.idea_set_updated_at();

DROP TRIGGER IF EXISTS trg_idea_refs_updated ON public.idea_references;
CREATE TRIGGER trg_idea_refs_updated BEFORE UPDATE ON public.idea_references
  FOR EACH ROW EXECUTE FUNCTION public.idea_set_updated_at();

CREATE OR REPLACE FUNCTION public.idea_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity text;
  v_action text;
  v_ws uuid;
  v_id uuid;
BEGIN
  v_entity := TG_ARGV[0];
  IF (TG_OP = 'INSERT') THEN
    v_action := 'create'; v_ws := NEW.workspace_id; v_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'update'; v_ws := NEW.workspace_id; v_id := NEW.id;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at AND NEW.archived_at IS NOT NULL THEN
      v_action := 'archive';
    END IF;
  ELSE
    v_action := 'delete'; v_ws := OLD.workspace_id; v_id := OLD.id;
  END IF;

  INSERT INTO public.idea_audit_log(workspace_id, entity_type, entity_id, action, user_id)
  VALUES (v_ws, v_entity, v_id, v_action, auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_idea_boards_audit ON public.idea_boards;
CREATE TRIGGER trg_idea_boards_audit AFTER INSERT OR UPDATE OR DELETE ON public.idea_boards
  FOR EACH ROW EXECUTE FUNCTION public.idea_audit_trigger('board');

DROP TRIGGER IF EXISTS trg_idea_refs_audit ON public.idea_references;
CREATE TRIGGER trg_idea_refs_audit AFTER INSERT OR UPDATE OR DELETE ON public.idea_references
  FOR EACH ROW EXECUTE FUNCTION public.idea_audit_trigger('reference');

-- =========================================================================
-- 8. Storage bucket privado
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('idea-references', 'idea-references', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "idea_refs_storage_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'idea-references' AND public.user_has_workspace_access(
      NULLIF((storage.foldername(name))[1], '')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "idea_refs_storage_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'idea-references' AND public.user_has_workspace_access(
      NULLIF((storage.foldername(name))[1], '')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "idea_refs_storage_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'idea-references' AND public.user_has_workspace_access(
      NULLIF((storage.foldername(name))[1], '')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 9. Migração de dados legados (ideas_bank → idea_boards/idea_references)
-- =========================================================================
DO $$
DECLARE
  ws record;
  legacy_board_id uuid;
BEGIN
  FOR ws IN
    SELECT DISTINCT workspace_id FROM public.ideas_bank WHERE workspace_id IS NOT NULL
  LOOP
    -- cria board "Referências importadas" caso ainda não exista
    SELECT id INTO legacy_board_id
      FROM public.idea_boards
     WHERE workspace_id = ws.workspace_id AND name = 'Referências importadas'
     LIMIT 1;

    IF legacy_board_id IS NULL THEN
      INSERT INTO public.idea_boards(workspace_id, name, description, category)
      VALUES (ws.workspace_id, 'Referências importadas',
              'Itens migrados do antigo Banco de Ideias.', 'Migração')
      RETURNING id INTO legacy_board_id;
    END IF;

    INSERT INTO public.idea_references
      (workspace_id, board_id, type, title, description, source_url,
       thumbnail_url, tags, created_by, created_at, updated_at)
    SELECT
      ib.workspace_id,
      legacy_board_id,
      CASE ib.reference_type
        WHEN 'image' THEN 'image'::public.idea_reference_type
        WHEN 'video' THEN 'video'::public.idea_reference_type
        WHEN 'article' THEN 'link'::public.idea_reference_type
        WHEN 'social' THEN 'inspiration'::public.idea_reference_type
        ELSE 'inspiration'::public.idea_reference_type
      END,
      ib.title,
      ib.description,
      ib.reference_url,
      ib.thumbnail_url,
      COALESCE(ib.tags, '{}'),
      ib.created_by,
      ib.created_at,
      ib.updated_at
    FROM public.ideas_bank ib
    WHERE ib.workspace_id = ws.workspace_id
      AND NOT EXISTS (
        SELECT 1 FROM public.idea_references r
         WHERE r.workspace_id = ib.workspace_id
           AND r.title = ib.title
           AND r.created_at = ib.created_at
      );
  END LOOP;
END $$;
