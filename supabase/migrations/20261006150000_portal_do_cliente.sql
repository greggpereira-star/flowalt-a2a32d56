-- Onda 5 (blueprint V3): Portal do cliente por link magico.
--
-- Um link por cliente (sem login). O token tem 32 bytes aleatorios e so o SHA-256 dele fica no banco, como na Sala de
-- Aprovacao. O link mostra ao cliente o que esta aguardando a resposta dele, o historico de decisoes, o calendario de
-- publicacoes e um resumo do mes. Quem le os dados e a funcao de borda `public-portal` (credencial de servico), que
-- so devolve o que ja foi enviado ao cliente em pedidos de aprovacao ou ja foi publicado.
--
-- A cor da marca da agencia fica em workspaces.settings.brand_color (a politica de admin de workspaces ja cobre),
-- sem tabela nova.
--
-- Seguranca: workspace_id e RLS por membro; so a funcao de servico grava last_seen_at e view_count.
-- Aditiva. Reversao: drop table public.client_portal_access cascade; drop function public.client_portal_access_guard();

begin;

create table if not exists public.client_portal_access (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  client_id     uuid not null references public.client_cards(id) on delete cascade unique,
  token_hash    text not null unique,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  renewed_at    timestamptz,
  last_seen_at  timestamptz,
  view_count    int not null default 0,
  revoked_at    timestamptz
);
create index if not exists idx_client_portal_ws on public.client_portal_access (workspace_id);

alter table public.client_portal_access enable row level security;

create policy client_portal_select on public.client_portal_access for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_portal_insert on public.client_portal_access for insert
  with check (
    public.is_workspace_member((select auth.uid()), workspace_id)
    and created_by = (select auth.uid())
    and exists (select 1 from public.client_cards c where c.id = client_id and c.workspace_id = client_portal_access.workspace_id)
  );
create policy client_portal_update on public.client_portal_access for update
  using (public.is_workspace_member((select auth.uid()), workspace_id))
  with check (public.is_workspace_member((select auth.uid()), workspace_id));

-- Membros so trocam o token e revogam; contadores e datas de acesso so a funcao de servico.
create or replace function public.client_portal_access_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.workspace_id is distinct from old.workspace_id or new.client_id is distinct from old.client_id
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or new.last_seen_at is distinct from old.last_seen_at or new.view_count is distinct from old.view_count then
    raise exception 'so o token e a revogacao do link podem mudar';
  end if;
  return new;
end;
$$;
revoke execute on function public.client_portal_access_guard() from public, anon, authenticated;
drop trigger if exists trg_client_portal_access_guard on public.client_portal_access;
create trigger trg_client_portal_access_guard before update on public.client_portal_access
  for each row execute function public.client_portal_access_guard();

commit;
