-- Social: o post passa a guardar QUAL conta (pagina ou Instagram) deve receber a publicacao.
--
-- Problema (09/10/2026): social_posts.platform_connection_id aponta para a CONEXAO (um login da Meta), e uma conexao
-- pode ter varias contas ativas (ex.: "6 contas"). O agendador publicava sempre na conta "principal" da conexao
-- (social_platforms.account_id = a primeira selecionada), ignorando a conta que a pessoa escolheu na tela.
--
-- O que muda: coluna platform_asset_id (id da conta na Meta, o mesmo de social_platform_assets.asset_id).
-- O agendador passa a publicar somente nessa conta; se ela nao estiver ativa na conexao do post, o post falha com
-- mensagem clara em vez de ir para outra conta. Posts sem a coluna so publicam se a conexao tiver UMA unica conta
-- ativa do tipo; com mais de uma, falham pedindo para escolher a conta.
--
-- Aditiva e reversivel (drop column). Nao altera dados existentes.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261009180000_post_conta_de_destino.sql"
--
-- Reversao: alter table public.social_posts drop column platform_asset_id;

begin;

alter table public.social_posts add column if not exists platform_asset_id text;

comment on column public.social_posts.platform_asset_id is
  'Conta de destino na Meta (social_platform_assets.asset_id): pagina do Facebook ou conta Business do Instagram. O agendador publica somente nela.';

commit;
