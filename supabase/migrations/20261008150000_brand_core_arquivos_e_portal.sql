-- Brand Core, parte 2: arquivos do cliente organizados em pastas (com permissao) e o que o cliente ve no portal.
--
-- ARQUIVOS
--   client_file_folders  pastas do cliente. `access`: 'team' (todo membro) ou 'managers' (so owner/admin/coordenacao).
--                        `visible_to_client`: a pasta aparece (somente leitura) no portal do cliente.
--                        Pasta restrita a gestores nao pode ser visivel ao cliente (o cliente nao ve o que a equipe nao ve).
--   client_files         um registro por arquivo; o conteudo fica no bucket privado `client-files`, em
--                        <workspace_id>/<client_id>/<folder_id>/<uuid>-<nome>. O caminho e validado por trigger.
--
-- PORTAL
--   client_portal_access.brand_sections  quais secoes do Brand Core o cliente ve: diagnosis, persona, competitor, offer.
--                                        Vazio por padrao: nada aparece ate a equipe liberar.
--   Quem le tudo isso para o cliente e a funcao de borda `public-portal` (credencial de servico), que so devolve o que
--   esta liberado e assina a URL de cada arquivo por 1 hora.
--
-- Seguranca:
--   - workspace_id em toda linha; ver = membro ativo (e, em pasta de gestores, so gestor); escrever = papel acima de viewer;
--   - excluir pasta = so gestor; excluir arquivo = gestor ou quem enviou;
--   - bucket privado, limite de 50 MB por arquivo; leitura do objeto so se o registro existir e a pasta for visivel ao usuario;
--   - aditiva: nada existente e alterado alem de uma coluna nova com padrao vazio em client_portal_access.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261008150000_brand_core_arquivos_e_portal.sql"
--
-- Reversao:
--   alter table public.client_portal_access drop column brand_sections;
--   drop table public.client_files, public.client_file_folders cascade;
--   drop function public.brand_can_see_folder(uuid), public.brand_is_manager(uuid), public.brand_can_write(uuid);
--   (e remover as politicas "client_files_*" de storage.objects e o bucket client-files, vazio)

begin;

-- Funcoes de papel ---------------------------------------------------------------------------------------------------
create or replace function public.brand_can_write(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
                 where ur.workspace_id = p_ws and ur.user_id = auth.uid()
                   and ur.role in ('super_admin', 'owner', 'admin', 'coordinator', 'member'));
$$;

create or replace function public.brand_is_manager(p_ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
                 where ur.workspace_id = p_ws and ur.user_id = auth.uid()
                   and ur.role in ('super_admin', 'owner', 'admin', 'coordinator'));
$$;

-- O usuario atual pode ver esta pasta? (membro ativo; pasta de gestores so para gestor)
create or replace function public.brand_can_see_folder(p_folder uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.client_file_folders f
                 where f.id = p_folder
                   and public.user_has_workspace_access(f.workspace_id)
                   and (f.access = 'team' or public.brand_is_manager(f.workspace_id)));
end;
$$;

revoke execute on function public.brand_can_write(uuid), public.brand_is_manager(uuid), public.brand_can_see_folder(uuid) from public, anon;
grant execute on function public.brand_can_write(uuid), public.brand_is_manager(uuid), public.brand_can_see_folder(uuid) to authenticated;

-- Tabelas ------------------------------------------------------------------------------------------------------------
create table if not exists public.client_file_folders (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  client_id          uuid not null references public.client_cards(id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 80),
  access             text not null default 'team' check (access in ('team', 'managers')),
  visible_to_client  boolean not null default false,
  position           int not null default 0,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint client_file_folders_cliente_so_se_equipe check (not (visible_to_client and access = 'managers'))
);
create unique index if not exists uq_client_file_folders_nome on public.client_file_folders (client_id, lower(btrim(name)));
create index if not exists idx_client_file_folders_client on public.client_file_folders (client_id, position);

create table if not exists public.client_files (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  client_id     uuid not null references public.client_cards(id) on delete cascade,
  folder_id     uuid not null references public.client_file_folders(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 200),
  storage_path  text not null unique,
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  mime_type     text,
  uploaded_by   uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_client_files_folder on public.client_files (folder_id, created_at desc);
create index if not exists idx_client_files_client on public.client_files (client_id);

alter table public.client_file_folders enable row level security;
alter table public.client_files        enable row level security;

-- Pastas
create policy client_file_folders_select on public.client_file_folders for select
  using (public.user_has_workspace_access(workspace_id) and (access = 'team' or public.brand_is_manager(workspace_id)));
create policy client_file_folders_insert on public.client_file_folders for insert
  with check (public.brand_can_write(workspace_id) and (access = 'team' or public.brand_is_manager(workspace_id)));
create policy client_file_folders_update on public.client_file_folders for update
  using (public.brand_can_write(workspace_id) and (access = 'team' or public.brand_is_manager(workspace_id)))
  with check (public.brand_can_write(workspace_id) and (access = 'team' or public.brand_is_manager(workspace_id)));
create policy client_file_folders_delete on public.client_file_folders for delete
  using (public.brand_is_manager(workspace_id));

-- Arquivos
create policy client_files_select on public.client_files for select
  using (public.brand_can_see_folder(folder_id));
create policy client_files_insert on public.client_files for insert
  with check (public.brand_can_write(workspace_id) and public.brand_can_see_folder(folder_id));
create policy client_files_update on public.client_files for update
  using (public.brand_can_write(workspace_id) and public.brand_can_see_folder(folder_id))
  with check (public.brand_can_write(workspace_id) and public.brand_can_see_folder(folder_id));
create policy client_files_delete on public.client_files for delete
  using (public.brand_can_see_folder(folder_id) and (public.brand_is_manager(workspace_id) or uploaded_by = (select auth.uid())));

-- Guardas: coerencia de workspace/cliente/pasta, autoria preenchida pelo banco, caminho do arquivo no padrao.
create or replace function public.client_file_folders_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.client_cards c where c.id = new.client_id and c.workspace_id = new.workspace_id) then
      raise exception 'o cliente nao pertence a este workspace';
    end if;
    new.created_by := auth.uid();
  else
    if new.workspace_id is distinct from old.workspace_id or new.client_id is distinct from old.client_id
       or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'workspace e cliente da pasta nao podem mudar';
    end if;
    new.updated_at := now();
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;

create or replace function public.client_files_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare pasta record;
begin
  select f.workspace_id, f.client_id into pasta from public.client_file_folders f where f.id = new.folder_id;
  if not found or pasta.workspace_id <> new.workspace_id or pasta.client_id <> new.client_id then
    raise exception 'a pasta nao pertence a este cliente';
  end if;
  if tg_op = 'INSERT' then
    if new.storage_path not like (new.workspace_id::text || '/' || new.client_id::text || '/' || new.folder_id::text || '/%')
       or position('..' in new.storage_path) > 0 then
      raise exception 'caminho do arquivo fora do padrao';
    end if;
    new.uploaded_by := auth.uid();
  else
    if new.workspace_id is distinct from old.workspace_id or new.client_id is distinct from old.client_id
       or new.storage_path is distinct from old.storage_path or new.uploaded_by is distinct from old.uploaded_by
       or new.size_bytes is distinct from old.size_bytes or new.created_at is distinct from old.created_at then
      raise exception 'so o nome e a pasta do arquivo podem mudar';
    end if;
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;
revoke execute on function public.client_file_folders_guard(), public.client_files_guard() from public, anon, authenticated;

drop trigger if exists trg_client_file_folders_guard on public.client_file_folders;
create trigger trg_client_file_folders_guard before insert or update on public.client_file_folders
  for each row execute function public.client_file_folders_guard();
drop trigger if exists trg_client_files_guard on public.client_files;
create trigger trg_client_files_guard before insert or update on public.client_files
  for each row execute function public.client_files_guard();

-- Bucket privado e politicas de storage ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists client_files_storage_select on storage.objects;
create policy client_files_storage_select on storage.objects for select
  using (
    bucket_id = 'client-files'
    and exists (select 1 from public.client_files f where f.storage_path = storage.objects.name and public.brand_can_see_folder(f.folder_id))
  );

drop policy if exists client_files_storage_insert on storage.objects;
create policy client_files_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'client-files'
    and public.brand_can_write(nullif((storage.foldername(name))[1], '')::uuid)
    and public.user_has_workspace_access(nullif((storage.foldername(name))[1], '')::uuid)
  );

-- Apagar objeto: gestor, quem enviou, ou objeto orfao (upload que nao chegou a ter registro).
drop policy if exists client_files_storage_delete on storage.objects;
create policy client_files_storage_delete on storage.objects for delete
  using (
    bucket_id = 'client-files'
    and public.brand_can_write(nullif((storage.foldername(name))[1], '')::uuid)
    and (
      public.brand_is_manager(nullif((storage.foldername(name))[1], '')::uuid)
      or exists (select 1 from public.client_files f where f.storage_path = storage.objects.name and f.uploaded_by = (select auth.uid()))
      or not exists (select 1 from public.client_files f where f.storage_path = storage.objects.name)
    )
  );

-- Portal: secoes do Brand Core liberadas ao cliente --------------------------------------------------------------------
alter table public.client_portal_access add column if not exists brand_sections text[] not null default '{}';
alter table public.client_portal_access drop constraint if exists client_portal_access_brand_sections_check;
alter table public.client_portal_access
  add constraint client_portal_access_brand_sections_check
  check (brand_sections <@ array['diagnosis', 'persona', 'competitor', 'offer']::text[]);

do $$ begin
  begin alter publication supabase_realtime add table public.client_file_folders; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.client_files; exception when duplicate_object then null; end;
end $$;

commit;
