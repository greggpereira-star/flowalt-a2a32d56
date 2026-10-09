-- Marketing: voltar a publicar posts agendados e permitir aprovar uma postagem.
--
-- Diagnostico (09/10/2026):
--   1) Nenhum job do pg_cron chamava a funcao `social-scheduler`: o post agendado ficava "scheduled" para sempre.
--   2) A tela de Marketing grava status = 'approved' ao aprovar uma postagem, mas o CHECK de social_posts nao
--      aceitava esse valor, entao aprovar falhava.
--
-- O que esta migration faz:
--   a) acrescenta 'approved' aos status permitidos de social_posts (e mantem os que ja existiam);
--   b) agenda o job `social-scheduler` a cada minuto, copiando a chamada do job `approval-reminders` (mesmo endereco
--      interno, mesmos cabecalhos) por dentro do banco. Nenhuma chave e escrita neste arquivo.
--
-- O que NAO faz (e por que):
--   - nao renova token da Meta: a funcao social-token-refresh exige login de usuario e proibe o modo em lote de
--     proposito; isso pede um desenho proprio;
--   - nao reconecta o Instagram: a conexao ativa foi validada pela ultima vez em 07/01/2026 e o token da Meta vence
--     em cerca de 60 dias. Quem reconecta e a pessoa dona da conta, pelo fluxo de conexao do Marketing.
--
-- Aditiva e reversivel.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261009120000_marketing_agendamento.sql"
--
-- Reversao:
--   select cron.unschedule('social-scheduler');
--   (e recriar social_posts_status_check sem 'approved')

begin;

-- a) status 'approved' ------------------------------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.social_posts'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%pending_approval%'
  loop
    execute format('alter table public.social_posts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.social_posts
  add constraint social_posts_status_check
  check (status in ('draft', 'pending_approval', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'error', 'archived'));

-- b) job do agendador -----------------------------------------------------------------------------------------------------
do $$
declare
  modelo text;
  novo text;
begin
  select command into modelo from cron.job where jobname = 'approval-reminders';
  if modelo is null then
    raise exception 'job modelo approval-reminders nao encontrado: nao ha como copiar a chamada autenticada';
  end if;
  novo := replace(modelo, '/functions/v1/approval-reminders', '/functions/v1/social-scheduler');
  if novo = modelo then
    raise exception 'o modelo nao aponta para /functions/v1/approval-reminders: confira o job antes de continuar';
  end if;
  perform cron.schedule('social-scheduler', '* * * * *', novo);
end $$;

commit;
