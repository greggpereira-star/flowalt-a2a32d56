-- Aprovacao por etapas (Tema, Conteudo, Midia, Legenda), alem do modo rapido (uma decisao so).
--
-- Desenho:
--   approval_requests.mode      'quick' (padrao, comportamento de sempre) ou 'stages'.
--   approval_items.stage        a etapa a que a peca pertence (so no modo 'stages'); null no modo rapido.
--   approval_stage_decisions    uma linha por etapa enviada no pedido, com a decisao do cliente em cada uma.
--
-- Regras:
--   - So as etapas enviadas existem no pedido (da para mandar so a ideia, ou so a legenda).
--   - O pedido continua 'pending' enquanto houver etapa sem decisao. Quando a ultima e decidida, a funcao de borda
--     fecha o pedido: 'approved' se todas foram aprovadas, 'changes_requested' se alguma pediu ajuste.
--   - O cliente nao tem login: so a funcao de borda `public-approval` (credencial de servico) grava a decisao.
--     Os membros so podem criar as linhas, sempre como 'pending' (nao existe politica de update nem de delete).
--   - Aditiva: pedidos existentes ficam como 'quick' e nada muda para eles.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261008120000_aprovacao_por_etapas.sql"
--
-- Reversao:
--   drop table public.approval_stage_decisions;
--   alter table public.approval_items drop column stage;
--   alter table public.approval_requests drop column mode;
--   (e recriar approval_events_type_check sem 'stage_approved' e 'stage_changes_requested')

begin;

alter table public.approval_requests
  add column if not exists mode text not null default 'quick';
alter table public.approval_requests drop constraint if exists approval_requests_mode_check;
alter table public.approval_requests
  add constraint approval_requests_mode_check check (mode in ('quick', 'stages'));

alter table public.approval_items
  add column if not exists stage text;
alter table public.approval_items drop constraint if exists approval_items_stage_check;
alter table public.approval_items
  add constraint approval_items_stage_check check (stage is null or stage in ('tema', 'conteudo', 'midia', 'legenda'));

create table if not exists public.approval_stage_decisions (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references public.approval_requests(id) on delete cascade,
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  stage             text not null check (stage in ('tema', 'conteudo', 'midia', 'legenda')),
  status            text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested')),
  decided_at        timestamptz,
  decided_by_name   text,
  decided_by_email  text,
  decision_ip       text,
  decision_ua       text,
  created_at        timestamptz not null default now(),
  unique (request_id, stage)
);
create index if not exists idx_approval_stage_decisions_request on public.approval_stage_decisions (request_id);

alter table public.approval_stage_decisions enable row level security;

create policy approval_stage_decisions_select on public.approval_stage_decisions for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy approval_stage_decisions_insert on public.approval_stage_decisions for insert
  with check (public.is_workspace_member((select auth.uid()), workspace_id) and status = 'pending');

-- Tipos de evento novos: decisao por etapa.
alter table public.approval_events drop constraint if exists approval_events_type_check;
alter table public.approval_events
  add constraint approval_events_type_check check (type in (
    'sent', 'viewed', 'commented', 'approved', 'changes_requested', 'reminder', 'expired', 'canceled', 'link_renewed',
    'stage_approved', 'stage_changes_requested'
  ));

-- Tempo real: o gestor ve a decisao de cada etapa na hora.
do $$ begin
  begin alter publication supabase_realtime add table public.approval_stage_decisions; exception when duplicate_object then null; end;
end $$;

commit;
