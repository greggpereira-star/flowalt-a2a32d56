-- Banco de Ideias — Onda 3: transcrição, análise de criativo e roteiros por cliente.
-- Colunas novas são opcionais. A tabela de roteiros segue o mesmo padrão de acesso das
-- referências: qualquer membro do workspace lê e cria; apagar só quem criou, admin ou coordenação.

ALTER TABLE public.idea_references
  ADD COLUMN IF NOT EXISTS transcript        text,
  ADD COLUMN IF NOT EXISTS transcript_status text,       -- nulo | 'processando' | 'pronta' | 'erro'
  ADD COLUMN IF NOT EXISTS transcript_source text,       -- 'arquivo' | 'manual'
  ADD COLUMN IF NOT EXISTS transcript_error  text,
  ADD COLUMN IF NOT EXISTS analysis          jsonb,       -- análise estruturada (gancho, estrutura, gatilhos...)
  ADD COLUMN IF NOT EXISTS analysis_at       timestamptz;

CREATE TABLE IF NOT EXISTS public.idea_scripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  reference_id  uuid NOT NULL REFERENCES public.idea_references(id) ON DELETE CASCADE,
  client_id     uuid,                                     -- client_cards.id usado como briefing
  title         text NOT NULL,
  content       jsonb NOT NULL,                           -- gancho, cenas (fala/visual), CTA, legenda
  options       jsonb,                                    -- duração, objetivo, formato pedidos
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idea_scripts_ref ON public.idea_scripts (reference_id, created_at DESC);

ALTER TABLE public.idea_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idea_scripts_select ON public.idea_scripts;
CREATE POLICY idea_scripts_select ON public.idea_scripts
  FOR SELECT USING (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS idea_scripts_insert ON public.idea_scripts;
CREATE POLICY idea_scripts_insert ON public.idea_scripts
  FOR INSERT WITH CHECK (user_has_workspace_access(workspace_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS idea_scripts_delete ON public.idea_scripts;
CREATE POLICY idea_scripts_delete ON public.idea_scripts
  FOR DELETE USING (
    created_by = auth.uid()
    OR user_is_workspace_admin(workspace_id)
    OR has_role(auth.uid(), workspace_id, 'coordinator'::app_role)
  );
