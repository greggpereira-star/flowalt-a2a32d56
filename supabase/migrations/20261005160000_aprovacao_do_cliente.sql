-- Onda 1 (blueprint V3): Sala de Aprovacao do cliente, por link, sem login.
--
-- Desenho:
--   approval_requests   um pedido de aprovacao por rodada (round 1, 2, 3...), com o hash do token (nunca o token).
--   approval_items      as pecas do pedido (arquivos do card, texto da legenda, link).
--   approval_comments   conversa do pedido, de equipe e do cliente. FICA EM TABELA SEPARADA de `comments`
--                       (comentarios internos do card) de proposito: a funcao publica nunca le `comments`,
--                       entao um comentario interno NAO PODE vazar para o cliente, nem por erro de filtro.
--   approval_events     trilha de auditoria (enviado, visto, comentado, aprovado, ajuste pedido, lembrete).
--
-- Seguranca:
--   - Todas as tabelas tem workspace_id e RLS por membro do workspace (is_workspace_member).
--   - O cliente nao tem login: age pela funcao de borda `public-approval` (credencial de servico, valida o token).
--   - O token tem 32 bytes aleatorios, e so o SHA-256 dele fica no banco.
--   - Aditiva: nenhuma tabela ou coluna existente e alterada.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261005160000_aprovacao_do_cliente.sql"
--
-- Reversao:
--   drop table public.approval_events, public.approval_comments, public.approval_items, public.approval_requests cascade;

begin;

create table if not exists public.approval_requests (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  card_id           uuid not null references public.cards(id) on delete cascade,
  client_id         uuid,
  token_hash        text not null unique,
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'changes_requested', 'expired', 'canceled')),
  round             int  not null default 1 check (round >= 1),
  title             text not null,
  message           text,
  client_name       text,
  client_email      text,
  requested_by      uuid not null,
  expires_at        timestamptz not null default (now() + interval '14 days'),
  view_count        int  not null default 0,
  first_viewed_at   timestamptz,
  last_viewed_at    timestamptz,
  reminded_at       timestamptz,
  decided_at        timestamptz,
  decided_by_name   text,
  decided_by_email  text,
  decision_ip       text,
  decision_ua       text,
  certificate_hash  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Um card tem no maximo um pedido em aberto por vez.
create unique index if not exists uq_approval_requests_aberto
  on public.approval_requests (card_id) where status = 'pending';
create index if not exists idx_approval_requests_ws_status on public.approval_requests (workspace_id, status);
create index if not exists idx_approval_requests_card on public.approval_requests (card_id, round desc);

create table if not exists public.approval_items (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.approval_requests(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          text not null check (kind in ('image', 'video', 'document', 'text', 'link')),
  bucket        text,
  storage_path  text,
  file_name     text,
  body          text,
  caption       text,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_approval_items_request on public.approval_items (request_id, sort_order);

create table if not exists public.approval_comments (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.approval_requests(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  author_kind   text not null check (author_kind in ('member', 'client')),
  user_id       uuid,
  author_name   text not null,
  body          text not null check (char_length(body) between 1 and 4000),
  created_at    timestamptz not null default now()
);
create index if not exists idx_approval_comments_request on public.approval_comments (request_id, created_at);

create table if not exists public.approval_events (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.approval_requests(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  type          text not null check (type in ('sent', 'viewed', 'commented', 'approved', 'changes_requested', 'reminder', 'expired', 'canceled', 'link_renewed')),
  actor_kind    text not null default 'member' check (actor_kind in ('member', 'client', 'system')),
  actor_label   text,
  payload       jsonb not null default '{}'::jsonb,
  ip            text,
  ua            text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_approval_events_request on public.approval_events (request_id, created_at);

-- RLS --------------------------------------------------------------------------------------------------------
alter table public.approval_requests enable row level security;
alter table public.approval_items    enable row level security;
alter table public.approval_comments enable row level security;
alter table public.approval_events   enable row level security;

create policy approval_requests_select on public.approval_requests for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy approval_requests_insert on public.approval_requests for insert
  with check (public.is_workspace_member((select auth.uid()), workspace_id) and requested_by = (select auth.uid()));
create policy approval_requests_update on public.approval_requests for update
  using (public.is_workspace_member((select auth.uid()), workspace_id))
  with check (public.is_workspace_member((select auth.uid()), workspace_id));

create policy approval_items_select on public.approval_items for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy approval_items_insert on public.approval_items for insert
  with check (public.is_workspace_member((select auth.uid()), workspace_id));
create policy approval_items_delete on public.approval_items for delete
  using (public.is_workspace_member((select auth.uid()), workspace_id));

create policy approval_comments_select on public.approval_comments for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy approval_comments_insert on public.approval_comments for insert
  with check (public.is_workspace_member((select auth.uid()), workspace_id)
              and author_kind = 'member' and user_id = (select auth.uid()));

create policy approval_events_select on public.approval_events for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy approval_events_insert on public.approval_events for insert
  with check (public.is_workspace_member((select auth.uid()), workspace_id) and actor_kind = 'member');

-- updated_at do pedido
create or replace function public.touch_approval_request()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_approval_request on public.approval_requests;
create trigger trg_touch_approval_request before update on public.approval_requests
  for each row execute function public.touch_approval_request();

-- Tempo real para o painel do card (o gestor ve a decisao do cliente na hora)
do $$ begin
  begin alter publication supabase_realtime add table public.approval_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.approval_comments; exception when duplicate_object then null; end;
end $$;

commit;
