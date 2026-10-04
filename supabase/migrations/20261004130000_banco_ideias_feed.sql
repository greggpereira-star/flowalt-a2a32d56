-- Banco de Ideias — Onda 2: feed de referências com status de análise.
-- Só acrescenta uma coluna com valor padrão e um índice; nenhuma política (RLS) muda.
ALTER TABLE public.idea_references
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'para_analisar';

ALTER TABLE public.idea_references
  DROP CONSTRAINT IF EXISTS idea_references_review_status_check;
ALTER TABLE public.idea_references
  ADD CONSTRAINT idea_references_review_status_check
  CHECK (review_status IN ('para_analisar', 'analisado', 'usar'));

CREATE INDEX IF NOT EXISTS idx_idea_references_feed
  ON public.idea_references (workspace_id, created_at DESC)
  WHERE archived_at IS NULL;
