-- Banco de Ideias — Onda 1: referências de redes sociais por incorporação (embed).
-- Só acrescenta colunas opcionais; nada existente é alterado e nenhuma política (RLS) muda.
ALTER TABLE public.idea_references
  ADD COLUMN IF NOT EXISTS platform    text,   -- 'tiktok' | 'instagram' | 'youtube' (nulo = referência comum)
  ADD COLUMN IF NOT EXISTS external_id text,   -- id do vídeo/post na plataforma, quando conhecido
  ADD COLUMN IF NOT EXISTS author_name text,   -- nome de quem publicou
  ADD COLUMN IF NOT EXISTS author_url  text;   -- perfil de quem publicou
