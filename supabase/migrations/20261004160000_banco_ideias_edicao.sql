-- Banco de Ideias — análise de edição do vídeo (medições automáticas).
-- Colunas opcionais; nenhuma política (RLS) muda.
ALTER TABLE public.idea_references
  ADD COLUMN IF NOT EXISTS edit_metrics        jsonb,        -- duração, formato, cortes, ritmo, silêncios
  ADD COLUMN IF NOT EXISTS edit_metrics_status text,         -- nulo | 'processando' | 'pronta' | 'erro'
  ADD COLUMN IF NOT EXISTS edit_metrics_error  text,
  ADD COLUMN IF NOT EXISTS edit_metrics_at     timestamptz;
