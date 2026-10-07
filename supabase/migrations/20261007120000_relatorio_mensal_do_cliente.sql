-- Onda 6: relatorio mensal do cliente, em rascunho para o gestor revisar.
-- O rascunho guarda uma FOTO dos numeros do mes (snapshot, montada no app a partir de cards e aprovacoes reais) e um
-- texto-resumo editavel. Publicar = o gestor revisou; depois de publicado, texto e numeros ficam travados.
-- Nada aqui chega ao cliente ainda: a exibicao no portal e um passo separado.
begin;

create table if not exists public.client_monthly_reports (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  client_id     uuid not null references public.client_cards(id) on delete cascade,
  period        date not null,
  status        text not null default 'draft' check (status in ('draft', 'published')),
  snapshot      jsonb not null default '{}'::jsonb,
  summary       text not null default '',
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_by  uuid,
  published_at  timestamptz,
  constraint client_monthly_reports_period_first_day check (period = date_trunc('month', period)::date),
  constraint client_monthly_reports_client_period_key unique (client_id, period)
);
create index if not exists idx_client_monthly_reports_ws on public.client_monthly_reports (workspace_id, period desc);

alter table public.client_monthly_reports enable row level security;

create policy client_monthly_reports_select on public.client_monthly_reports for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_monthly_reports_insert on public.client_monthly_reports for insert
  with check (
    public.is_workspace_member((select auth.uid()), workspace_id)
    and created_by = (select auth.uid())
    and status = 'draft'
    and exists (select 1 from public.client_cards c where c.id = client_id and c.workspace_id = client_monthly_reports.workspace_id)
  );
create policy client_monthly_reports_update on public.client_monthly_reports for update
  using (public.is_workspace_member((select auth.uid()), workspace_id))
  with check (public.is_workspace_member((select auth.uid()), workspace_id));
-- Só rascunho pode ser apagado: o publicado fica como registro do que foi entregue ao cliente.
create policy client_monthly_reports_delete on public.client_monthly_reports for delete
  using (status = 'draft' and public.is_workspace_member((select auth.uid()), workspace_id));

create or replace function public.client_monthly_reports_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.workspace_id is distinct from old.workspace_id or new.client_id is distinct from old.client_id
     or new.period is distinct from old.period or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'cliente, mes e autoria do relatorio nao mudam';
  end if;
  -- Publicado fica travado: para corrigir, volte para rascunho (isso apaga a marca de publicação).
  if old.status = 'published' and new.status = 'published'
     and (new.summary is distinct from old.summary or new.snapshot is distinct from old.snapshot
          or new.published_by is distinct from old.published_by or new.published_at is distinct from old.published_at) then
    raise exception 'relatorio publicado nao pode ser editado; volte para rascunho';
  end if;
  if new.status = 'published' and old.status = 'draft' then
    new.published_by := auth.uid();
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_by := null;
    new.published_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.client_monthly_reports_guard() from public, anon, authenticated;
drop trigger if exists trg_client_monthly_reports_guard on public.client_monthly_reports;
create trigger trg_client_monthly_reports_guard before update on public.client_monthly_reports
  for each row execute function public.client_monthly_reports_guard();

commit;
