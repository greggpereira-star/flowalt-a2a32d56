-- Marketing: o estado 'approved' passa a existir na maquina de estados de social_posts.
--
-- Por que: a tela de Marketing trata 'approved' como estado real (botao Aprovar, lista de posts, detalhe), mas o gatilho
-- validate_status_transition nao o previa. Resultado: aprovar uma postagem falhava ("Transicao de status invalida:
-- draft -> approved"), mesmo depois de o CHECK aceitar o valor (20261009120000).
--
-- O que muda (so a tabela de transicoes; o resto da funcao e identico):
--   draft             -> pending_approval, approved, scheduled, archived      (acrescenta approved)
--   pending_approval  -> approved, scheduled, draft, archived                  (acrescenta approved)
--   approved          -> scheduled, pending_approval, draft, archived          (novo)
-- Nada sai do ar: 'approved' nunca vai direto para 'publishing'; so um post 'scheduled' e publicado pelo agendador.
-- Continua valendo que o agendador so processa status 'scheduled' vencidos.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261009121000_social_posts_estado_aprovado.sql"
--
-- Reversao: recriar validate_social_post_transition com a tabela anterior (sem 'approved').

begin;

create or replace function public.validate_social_post_transition()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  valid_transitions jsonb := '{
    "draft": ["pending_approval", "approved", "scheduled", "archived"],
    "pending_approval": ["approved", "scheduled", "draft", "archived"],
    "approved": ["scheduled", "pending_approval", "draft", "archived"],
    "scheduled": ["publishing", "error", "draft", "archived"],
    "publishing": ["published", "error", "failed", "scheduled"],
    "published": ["archived"],
    "failed": ["scheduled", "draft", "archived"],
    "error": ["scheduled", "draft", "archived"],
    "archived": []
  }'::jsonb;
  allowed_targets jsonb;
begin
  -- Se o status nao mudou, deixa passar
  if old.status = new.status then
    return new;
  end if;

  -- Confere se a transicao e valida
  allowed_targets := valid_transitions -> old.status;

  if allowed_targets is null or not (allowed_targets ? new.status) then
    raise exception 'Transição de status inválida: % -> %. Transições permitidas: %',
      old.status, new.status, allowed_targets;
  end if;

  -- Registra o evento da mudanca de status
  insert into domain_events (workspace_id, event_type, aggregate_type, aggregate_id, payload)
  values (
    new.workspace_id,
    'social_post.status_changed',
    'social_post',
    new.id,
    jsonb_build_object(
      'old_status', old.status,
      'new_status', new.status,
      'card_id', new.card_id,
      'platform', new.platform
    )
  );

  return new;
end;
$function$;

commit;
