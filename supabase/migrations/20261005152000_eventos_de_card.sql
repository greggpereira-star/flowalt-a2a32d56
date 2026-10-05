-- Onda 0 (blueprint V3): barramento de eventos de card.
--
-- Hoje domain_events guarda so telemetria de social e financeiro; nenhum evento de card existe, e as automacoes
-- (webhooks, regras) dependem do navegador aberto. Este gatilho passa a registrar, no banco, o que acontece com o card:
--   card.stage_changed  quando current_stage muda
--   card.approved       quando status passa a approved
--   card.delivered      quando status passa a delivered
--
-- Aditivo e seguro: AFTER UPDATE, so insere em domain_events, e qualquer falha vira aviso (EXCEPTION) para nunca
-- bloquear a movimentacao do card. Nenhuma coluna existente muda.
--
-- Reversao: drop trigger on_card_domain_events on public.cards; drop function public.emit_card_domain_events();

create or replace function public.emit_card_domain_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.current_stage is distinct from old.current_stage then
      insert into public.domain_events (workspace_id, event_type, aggregate_type, aggregate_id, payload, metadata)
      values (new.workspace_id, 'card.stage_changed', 'card', new.id,
              jsonb_build_object('title', new.title, 'from_stage', old.current_stage, 'to_stage', new.current_stage,
                                 'from_status', old.status, 'to_status', new.status),
              jsonb_build_object('actor', auth.uid(), 'source', 'db_trigger'));
    end if;

    if new.status is distinct from old.status and new.status in ('approved', 'delivered') then
      insert into public.domain_events (workspace_id, event_type, aggregate_type, aggregate_id, payload, metadata)
      values (new.workspace_id, 'card.' || new.status::text, 'card', new.id,
              jsonb_build_object('title', new.title, 'from_status', old.status, 'stage', new.current_stage),
              jsonb_build_object('actor', auth.uid(), 'source', 'db_trigger'));
    end if;
  exception when others then
    raise warning 'emit_card_domain_events falhou: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_card_domain_events on public.cards;
create trigger on_card_domain_events
  after update of current_stage, status on public.cards
  for each row execute function public.emit_card_domain_events();
