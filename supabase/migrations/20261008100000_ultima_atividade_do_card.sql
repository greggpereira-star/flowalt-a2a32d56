-- Última atividade do card: quando e QUEM mexeu por último, contando só trabalho de pessoas.
-- Por que não usar cards.updated_at: ele é carimbado por qualquer escrita, inclusive operações em massa e
-- automações (50 cards "atualizados" em 05/10 e 33 em 03/09 por rotinas, 4 com o mesmo horário), e não guarda autor.
-- Conta como atividade: criar o card; editar título, descrição, etapa, urgência, prazos, responsável, cliente, briefing
-- e horas estimadas; comentar; anexar; mexer em checklist, campos personalizados, responsáveis e tempo; mensagem no chat do card.
-- Não conta: ações sem pessoa (cron, service role), consequências de regras automáticas e reordenar o quadro.

alter table public.cards
  add column if not exists last_activity_at timestamptz,
  add column if not exists last_activity_by uuid references auth.users(id) on delete set null;

comment on column public.cards.last_activity_at is 'Última ação de uma pessoa no card (ver migração 20261008100000). Não é o updated_at.';
comment on column public.cards.last_activity_by is 'Quem fez a última ação de pessoa no card.';

-- Registro a partir das tabelas filhas. Throttle de 5 s por card e pessoa, para marcar/desmarcar checklist em sequência
-- não gerar uma escrita por clique.
create or replace function public.registrar_atividade_no_card(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_card_id is null or auth.uid() is null then return; end if;
  if coalesce(current_setting('flowalt.em_regra', true), '') = '1' then return; end if;
  update public.cards
     set last_activity_at = now(), last_activity_by = auth.uid()
   where id = p_card_id
     and (last_activity_at is null or last_activity_at < now() - interval '5 seconds' or last_activity_by is distinct from auth.uid());
end $$;

-- Gatilho das tabelas filhas (a coluna do card varia: todas usam card_id).
create or replace function public.trg_atividade_por_card_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.registrar_atividade_no_card(case when tg_op = 'DELETE' then old.card_id else new.card_id end);
  return coalesce(new, old);
end $$;

-- Gatilho do próprio card: carimba na mesma escrita, sem segunda atualização.
create or replace function public.trg_atividade_no_proprio_card()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.last_activity_at := coalesce(new.last_activity_at, now());
    new.last_activity_by := coalesce(new.last_activity_by, auth.uid(), new.created_by);
    return new;
  end if;

  if auth.uid() is null or coalesce(current_setting('flowalt.em_regra', true), '') = '1' then return new; end if;

  if (old.title, old.description, old.status, old.urgency, old.due_date, old.start_date, old.owner_id, old.client_id,
      old.briefing_data, old.traffic_briefing_data, old.briefing_completed, old.estimated_hours, old.card_type, old.current_stage)
     is distinct from
     (new.title, new.description, new.status, new.urgency, new.due_date, new.start_date, new.owner_id, new.client_id,
      new.briefing_data, new.traffic_briefing_data, new.briefing_completed, new.estimated_hours, new.card_type, new.current_stage) then
    new.last_activity_at := now();
    new.last_activity_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists cards_atividade on public.cards;
create trigger cards_atividade
  before insert or update on public.cards
  for each row execute function public.trg_atividade_no_proprio_card();

drop trigger if exists comments_atividade on public.comments;
create trigger comments_atividade after insert on public.comments
  for each row execute function public.trg_atividade_por_card_id();

drop trigger if exists attachments_atividade on public.attachments;
create trigger attachments_atividade after insert on public.attachments
  for each row execute function public.trg_atividade_por_card_id();

drop trigger if exists checklists_atividade on public.checklists;
create trigger checklists_atividade after insert or update or delete on public.checklists
  for each row execute function public.trg_atividade_por_card_id();

drop trigger if exists time_entries_atividade on public.time_entries;
create trigger time_entries_atividade after insert or update on public.time_entries
  for each row when (new.card_id is not null) execute function public.trg_atividade_por_card_id();

drop trigger if exists card_members_atividade on public.card_members;
create trigger card_members_atividade after insert or delete on public.card_members
  for each row execute function public.trg_atividade_por_card_id();

drop trigger if exists card_custom_fields_atividade on public.card_custom_fields;
create trigger card_custom_fields_atividade after insert or update on public.card_custom_fields
  for each row execute function public.trg_atividade_por_card_id();

drop trigger if exists chat_messages_atividade on public.chat_messages;
create trigger chat_messages_atividade after insert on public.chat_messages
  for each row when (new.card_id is not null) execute function public.trg_atividade_por_card_id();

-- Só os gatilhos chamam: ninguém de fora pode "marcar atividade" num card.
revoke all on function public.registrar_atividade_no_card(uuid) from public, anon, authenticated;
revoke all on function public.trg_atividade_por_card_id() from public, anon, authenticated;
revoke all on function public.trg_atividade_no_proprio_card() from public, anon, authenticated;

-- Preenchimento dos cards que já existem, só com sinais de pessoas (comentário, anexo, tempo, checklist/tempo no histórico,
-- mudanças de etapa/responsável/briefing no log de auditoria). Sem sinal: a criação do card.
-- O updated_at não pode ser tocado por este preenchimento, senão ele viraria o ruído que estamos substituindo.
alter table public.cards disable trigger update_cards_updated_at;
alter table public.cards disable trigger cards_atividade;

with sinais as (
  select card_id, created_at as quando, user_id as quem from public.comments where user_id is not null
  union all select card_id, created_at, user_id from public.attachments where user_id is not null
  union all select card_id, coalesce(started_at, created_at), user_id from public.time_entries where card_id is not null and user_id is not null
  union all select card_id, created_at, user_id from public.card_history
            where user_id is not null and action_type in ('checklist_change', 'time_log')
  union all select entity_id, created_at, user_id from public.audit_logs
            where entity_type = 'cards' and user_id is not null and action = 'update'
  union all select id, created_at, created_by from public.cards where created_by is not null
), ultimo as (
  select distinct on (card_id) card_id, quando, quem from sinais order by card_id, quando desc
)
update public.cards c
   set last_activity_at = u.quando, last_activity_by = u.quem
  from ultimo u
 where u.card_id = c.id and c.last_activity_at is null;

update public.cards set last_activity_at = created_at, last_activity_by = created_by
 where last_activity_at is null;

alter table public.cards enable trigger update_cards_updated_at;
alter table public.cards enable trigger cards_atividade;
