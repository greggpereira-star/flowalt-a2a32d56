-- Social: vigia diario do prazo de acesso das conexoes da Meta.
--
-- Contexto (medido em 09/10/2026 com debug_token): o token do Facebook Login for Business chega com expires_at = 0
-- (nunca), mas o app perde o acesso aos dados da conta em data_access_expires_at (90 dias depois da autorizacao).
-- O sistema nao guardava essa data e nao avisava ninguem; a conexao simplesmente parava de publicar.
--
-- O que esta migration faz:
--   a) cria public.social_token_watch(): marca conexoes ativas como 'expiring' (faltam 14 dias ou menos) ou 'expired'
--      (prazo vencido) e avisa quem conectou a conta, no maximo uma vez a cada 7 dias por conexao;
--   b) agenda a funcao uma vez por dia (12:00 UTC, 09:00 em Brasilia) no pg_cron.
--
-- Nao renova nada: o acesso so se renova quando a pessoa dona da conta autoriza de novo pelo fluxo de conexao. O
-- agendador continua publicando enquanto o status for 'connected' ou 'expiring'; so 'expired' bloqueia.
--
-- Aditiva e reversivel.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261013100000_vigia_do_acesso_da_meta.sql"
--
-- Reversao:
--   select cron.unschedule('social-token-watch');
--   drop function public.social_token_watch();

begin;

create or replace function public.social_token_watch()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c record;
  v_expirando int := 0;
  v_expiradas int := 0;
  v_avisos int := 0;
  v_dias int;
  v_titulo text;
  v_msg text;
begin
  for c in
    select id, workspace_id, platform, account_name, token_expires_at, connection_status, created_by
      from social_platforms
     where is_active
       and token_expires_at is not null
       and platform in ('instagram', 'facebook')
       and token_expires_at < now() + interval '14 days'
       and connection_status in ('connected', 'expiring')
  loop
    if c.token_expires_at <= now() then
      update social_platforms
         set connection_status = 'expired',
             last_error_code = 'TOKEN_EXPIRED',
             last_error_message = 'O acesso da Meta venceu. Reconecte a conta para voltar a publicar.',
             updated_at = now()
       where id = c.id;
      v_expiradas := v_expiradas + 1;
      v_titulo := 'Conexão com a Meta expirou';
      v_msg := format('A conexão %s venceu e os posts agendados não serão publicados. Reconecte em Marketing → Plataformas.', c.account_name);
    else
      if c.connection_status <> 'expiring' then
        update social_platforms set connection_status = 'expiring', updated_at = now() where id = c.id;
      end if;
      v_expirando := v_expirando + 1;
      v_dias := greatest(0, ceil(extract(epoch from (c.token_expires_at - now())) / 86400)::int);
      v_titulo := 'Conexão com a Meta perto de vencer';
      v_msg := format('A conexão %s vence em %s %s. Reconecte em Marketing → Plataformas para não interromper as publicações.',
                      c.account_name, v_dias, case when v_dias = 1 then 'dia' else 'dias' end);
    end if;

    -- avisa quem conectou a conta, no maximo uma vez a cada 7 dias por conexao
    if c.created_by is not null and not exists (
      select 1 from notifications n
       where n.user_id = c.created_by
         and n.type = 'social_connection_expiring'
         and n.metadata->>'platform_id' = c.id::text
         and n.created_at > now() - interval '7 days'
    ) then
      insert into notifications (user_id, workspace_id, type, title, message, metadata)
      values (c.created_by, c.workspace_id, 'social_connection_expiring', v_titulo, v_msg,
              jsonb_build_object('platform_id', c.id, 'platform', c.platform, 'expires_at', c.token_expires_at));
      v_avisos := v_avisos + 1;
    end if;
  end loop;

  return jsonb_build_object('expirando', v_expirando, 'expiradas', v_expiradas, 'avisos', v_avisos);
end;
$function$;

revoke all on function public.social_token_watch() from public, anon, authenticated;

select cron.schedule('social-token-watch', '0 12 * * *', $$select public.social_token_watch();$$);

commit;
