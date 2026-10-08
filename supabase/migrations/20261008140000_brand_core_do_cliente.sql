-- Brand Core do cliente: diagnostico do perfil, personas, concorrentes e esteira de ofertas, de forma estruturada.
--
-- Contexto: a ficha do cliente (client_cards) ja guarda texto livre de contexto, publico, concorrentes, posicionamento,
-- personalidade e voz. Isso continua como esta (alimenta o agente de roteiros do Banco de Ideias). Esta tabela acrescenta
-- o que o texto livre nao da: VARIAS personas, VARIOS concorrentes, VARIAS ofertas, cada uma com campos proprios.
--
-- Desenho: uma tabela so, `client_brand_items`, com `kind` e os campos da peca em `data` (jsonb). Os campos de cada tipo
-- ficam definidos no front (src/lib/brandCore/campos.ts), que tambem limpa e limita o conteudo antes de gravar.
--   kind = 'diagnosis'   um unico registro por cliente (raio-x do perfil)
--   kind = 'persona'     varias
--   kind = 'competitor'  varios
--   kind = 'offer'       varias (esteira de produtos/servicos)
--
-- Seguranca:
--   - workspace_id em toda linha; o cliente tem que pertencer ao mesmo workspace (trigger);
--   - ver: qualquer membro ativo do workspace; criar/editar/excluir: papeis acima de 'viewer' (mesma regra de client_policies
--     e client_cards, que exigem papel de equipe para escrever);
--   - o cliente final NAO tem acesso (ainda): nenhuma funcao publica le esta tabela.
--   - Aditiva: nenhuma tabela ou coluna existente e alterada.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261008140000_brand_core_do_cliente.sql"
--
-- Reversao:
--   drop table public.client_brand_items cascade; drop function public.client_brand_items_guard();

begin;

create table if not exists public.client_brand_items (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  client_id     uuid not null references public.client_cards(id) on delete cascade,
  kind          text not null check (kind in ('diagnosis', 'persona', 'competitor', 'offer')),
  position      int  not null default 0,
  data          jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_client_brand_items_client on public.client_brand_items (client_id, kind, position);
-- O diagnostico e unico por cliente.
create unique index if not exists uq_client_brand_items_diagnosis on public.client_brand_items (client_id) where kind = 'diagnosis';

alter table public.client_brand_items enable row level security;

create policy client_brand_items_select on public.client_brand_items for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));

create policy client_brand_items_insert on public.client_brand_items for insert
  with check (
    exists (select 1 from public.user_roles ur
            where ur.workspace_id = client_brand_items.workspace_id and ur.user_id = (select auth.uid())
              and ur.role in ('super_admin', 'owner', 'admin', 'coordinator', 'member'))
  );
create policy client_brand_items_update on public.client_brand_items for update
  using (
    exists (select 1 from public.user_roles ur
            where ur.workspace_id = client_brand_items.workspace_id and ur.user_id = (select auth.uid())
              and ur.role in ('super_admin', 'owner', 'admin', 'coordinator', 'member'))
  )
  with check (
    exists (select 1 from public.user_roles ur
            where ur.workspace_id = client_brand_items.workspace_id and ur.user_id = (select auth.uid())
              and ur.role in ('super_admin', 'owner', 'admin', 'coordinator', 'member'))
  );
create policy client_brand_items_delete on public.client_brand_items for delete
  using (
    exists (select 1 from public.user_roles ur
            where ur.workspace_id = client_brand_items.workspace_id and ur.user_id = (select auth.uid())
              and ur.role in ('super_admin', 'owner', 'admin', 'coordinator', 'member'))
  );

-- Mantem a coerencia: o cliente tem que ser do mesmo workspace; workspace, cliente e tipo nao mudam depois de criados;
-- quem criou/alterou e a data ficam sempre corretos, mesmo que o front esqueca de mandar.
create or replace function public.client_brand_items_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.client_cards c where c.id = new.client_id and c.workspace_id = new.workspace_id) then
      raise exception 'o cliente nao pertence a este workspace';
    end if;
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  else
    if new.workspace_id is distinct from old.workspace_id or new.client_id is distinct from old.client_id
       or new.kind is distinct from old.kind or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'workspace, cliente e tipo nao podem mudar';
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.client_brand_items_guard() from public, anon, authenticated;
drop trigger if exists trg_client_brand_items_guard on public.client_brand_items;
create trigger trg_client_brand_items_guard before insert or update on public.client_brand_items
  for each row execute function public.client_brand_items_guard();

-- Tempo real: duas pessoas abertas no mesmo cliente veem a edicao uma da outra.
do $$ begin
  begin alter publication supabase_realtime add table public.client_brand_items; exception when duplicate_object then null; end;
end $$;

commit;
