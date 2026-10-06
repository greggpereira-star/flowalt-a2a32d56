-- Onda 2 (blueprint V3): Conversas, o chat da equipe.
--
-- Canais:
--   workspace  um canal geral da agencia (todos os membros do workspace)
--   space      um canal por espaco (todos os membros do workspace)
--   client     um canal por cliente ativo (todos os membros do workspace)
--   private    canal privado, so quem foi convidado
--   dm         mensagem direta entre duas pessoas
--
-- PRIVACIDADE (decisao do blueprint, secao 10, item 4): canais privados e mensagens diretas NAO sao lidos por
-- owner nem admin. Nenhuma politica abaixo concede leitura por papel: so quem esta em chat_members enxerga.
-- Os canais de agencia, espaco e cliente sao abertos a todos os membros do workspace.
--
-- Seguranca: todas as tabelas tem workspace_id e RLS. A criacao de canais (automaticos, privados e diretos) e feita por
-- funcoes SECURITY DEFINER que conferem se quem chama e membro do workspace; nao ha INSERT direto em chat_channels.
-- O chat ainda NAO tem cliente externo: so membros do workspace (o cliente entra no Portal, Onda 5).
--
-- Aditiva. Reversao:
--   drop table public.chat_reactions, public.chat_messages, public.chat_members, public.chat_channels cascade;
--   drop function public.chat_can_access, public.chat_is_channel_admin, public.chat_ensure_channels,
--     public.chat_get_or_create_dm, public.chat_create_private, public.chat_unread_counts, public.chat_mark_read,
--     public.chat_notify_mentions, public.chat_is_member;

begin;

create table if not exists public.chat_channels (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          text not null check (kind in ('workspace', 'space', 'client', 'private', 'dm')),
  ref_id        uuid,
  name          text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  archived_at   timestamptz
);
create unique index if not exists uq_chat_channels_ref on public.chat_channels (workspace_id, kind, ref_id) where kind in ('space', 'client');
create unique index if not exists uq_chat_channels_geral on public.chat_channels (workspace_id) where kind = 'workspace';
create index if not exists idx_chat_channels_ws on public.chat_channels (workspace_id, kind);

create table if not exists public.chat_members (
  channel_id    uuid not null references public.chat_channels(id) on delete cascade,
  user_id       uuid not null,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  role          text not null default 'member' check (role in ('member', 'admin')),
  last_read_at  timestamptz not null default now(),
  muted         boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_chat_members_user on public.chat_members (user_id);

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references public.chat_channels(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  author_id     uuid not null,
  body          text not null check (char_length(body) between 1 and 8000),
  mentions      uuid[] not null default '{}',
  reply_to      uuid references public.chat_messages(id) on delete set null,
  card_id       uuid references public.cards(id) on delete set null,
  attachments   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);
create index if not exists idx_chat_messages_canal on public.chat_messages (channel_id, created_at desc);

create table if not exists public.chat_reactions (
  message_id    uuid not null references public.chat_messages(id) on delete cascade,
  user_id       uuid not null,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  emoji         text not null check (char_length(emoji) between 1 and 16),
  created_at    timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- Acesso -------------------------------------------------------------------------------------------------------
create or replace function public.chat_can_access(_channel uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_channels c
    where c.id = _channel
      and c.archived_at is null
      and public.is_workspace_member(_user, c.workspace_id)
      and (
        c.kind in ('workspace', 'space', 'client')
        or exists (select 1 from public.chat_members m where m.channel_id = c.id and m.user_id = _user)
      )
  );
$$;

create or replace function public.chat_is_channel_admin(_channel uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members m where m.channel_id = _channel and m.user_id = _user and m.role = 'admin');
$$;

create or replace function public.chat_is_member(_channel uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members m where m.channel_id = _channel and m.user_id = _user);
$$;

alter table public.chat_channels  enable row level security;
alter table public.chat_members   enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.chat_reactions enable row level security;

create policy chat_channels_select on public.chat_channels for select
  using (public.chat_can_access(id, (select auth.uid())));
create policy chat_channels_update on public.chat_channels for update
  using (kind = 'private' and public.chat_is_channel_admin(id, (select auth.uid())))
  with check (kind = 'private' and public.chat_is_channel_admin(id, (select auth.uid())));

-- Cada pessoa ve o proprio registro; em canal privado ou direto, ve tambem os dos outros participantes.
-- (Nos canais abertos a lista de membros e a do workspace, e o horario de leitura dos outros nao e exposto.)
create policy chat_members_select on public.chat_members for select
  using (
    user_id = (select auth.uid())
    or (public.chat_is_member(channel_id, (select auth.uid()))
        and exists (select 1 from public.chat_channels c where c.id = channel_id and c.kind in ('private', 'dm')))
  );
create policy chat_members_update_own on public.chat_members for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Convidar para canal privado: so admin do canal, e so quem e membro do workspace.
create policy chat_members_invite on public.chat_members for insert
  with check (
    public.chat_is_channel_admin(channel_id, (select auth.uid()))
    and public.is_workspace_member(user_id, workspace_id)
    and exists (select 1 from public.chat_channels c where c.id = channel_id and c.kind = 'private' and c.workspace_id = chat_members.workspace_id)
  );
create policy chat_members_leave on public.chat_members for delete
  using (
    (user_id = (select auth.uid()) or public.chat_is_channel_admin(channel_id, (select auth.uid())))
    and exists (select 1 from public.chat_channels c where c.id = channel_id and c.kind = 'private')
  );

create policy chat_messages_select on public.chat_messages for select
  using (public.chat_can_access(channel_id, (select auth.uid())));
create policy chat_messages_insert on public.chat_messages for insert
  with check (
    author_id = (select auth.uid())
    and public.chat_can_access(channel_id, (select auth.uid()))
    and exists (select 1 from public.chat_channels c where c.id = channel_id and c.workspace_id = chat_messages.workspace_id)
  );
create policy chat_messages_update_author on public.chat_messages for update
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy chat_reactions_select on public.chat_reactions for select
  using (exists (select 1 from public.chat_messages m where m.id = message_id and public.chat_can_access(m.channel_id, (select auth.uid()))));
create policy chat_reactions_insert on public.chat_reactions for insert
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chat_messages m where m.id = message_id and m.workspace_id = chat_reactions.workspace_id
                and public.chat_can_access(m.channel_id, (select auth.uid())))
  );
create policy chat_reactions_delete on public.chat_reactions for delete
  using (user_id = (select auth.uid()));

-- Funcoes de criacao e leitura -----------------------------------------------------------------------------------
-- Garante o canal geral, os canais de espaco e de cliente, e entra o usuario nos canais abertos.
create or replace function public.chat_ensure_channels(_workspace uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null or not public.is_workspace_member(_uid, _workspace) then
    raise exception 'sem acesso ao workspace';
  end if;

  insert into public.chat_channels (workspace_id, kind, name, created_by)
  select _workspace, 'workspace', 'Geral', _uid
  where not exists (select 1 from public.chat_channels where workspace_id = _workspace and kind = 'workspace');

  insert into public.chat_channels (workspace_id, kind, ref_id, name, created_by)
  select s.workspace_id, 'space', s.id, s.name, _uid
  from public.spaces s
  where s.workspace_id = _workspace and coalesce(s.is_archived, false) = false
    and not exists (select 1 from public.chat_channels c where c.workspace_id = _workspace and c.kind = 'space' and c.ref_id = s.id);

  insert into public.chat_channels (workspace_id, kind, ref_id, name, created_by)
  select k.workspace_id, 'client', k.id, k.name, _uid
  from public.client_cards k
  where k.workspace_id = _workspace and k.status::text = 'active'
    and not exists (select 1 from public.chat_channels c where c.workspace_id = _workspace and c.kind = 'client' and c.ref_id = k.id);

  -- nomes acompanham o espaco/cliente
  update public.chat_channels c set name = s.name from public.spaces s
    where c.workspace_id = _workspace and c.kind = 'space' and c.ref_id = s.id and c.name is distinct from s.name;
  update public.chat_channels c set name = k.name from public.client_cards k
    where c.workspace_id = _workspace and c.kind = 'client' and c.ref_id = k.id and c.name is distinct from k.name;

  -- primeiro acesso: comeca com tudo lido (last_read_at = agora)
  insert into public.chat_members (channel_id, user_id, workspace_id)
  select c.id, _uid, _workspace from public.chat_channels c
  where c.workspace_id = _workspace and c.kind in ('workspace', 'space', 'client') and c.archived_at is null
  on conflict (channel_id, user_id) do nothing;
end;
$$;

create or replace function public.chat_get_or_create_dm(_workspace uuid, _other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _id uuid;
begin
  if _uid is null or not public.is_workspace_member(_uid, _workspace) or not public.is_workspace_member(_other, _workspace) then
    raise exception 'sem acesso ao workspace';
  end if;
  if _other = _uid then raise exception 'escolha outra pessoa'; end if;

  select c.id into _id from public.chat_channels c
  where c.workspace_id = _workspace and c.kind = 'dm'
    and exists (select 1 from public.chat_members m where m.channel_id = c.id and m.user_id = _uid)
    and exists (select 1 from public.chat_members m where m.channel_id = c.id and m.user_id = _other)
    and (select count(*) from public.chat_members m where m.channel_id = c.id) = 2
  limit 1;
  if _id is not null then return _id; end if;

  insert into public.chat_channels (workspace_id, kind, created_by) values (_workspace, 'dm', _uid) returning id into _id;
  insert into public.chat_members (channel_id, user_id, workspace_id, role) values (_id, _uid, _workspace, 'member'), (_id, _other, _workspace, 'member');
  return _id;
end;
$$;

create or replace function public.chat_create_private(_workspace uuid, _name text, _members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _id uuid; _m uuid;
begin
  if _uid is null or not public.is_workspace_member(_uid, _workspace) then raise exception 'sem acesso ao workspace'; end if;
  if _name is null or char_length(btrim(_name)) < 2 or char_length(_name) > 60 then raise exception 'nome invalido'; end if;

  insert into public.chat_channels (workspace_id, kind, name, created_by) values (_workspace, 'private', btrim(_name), _uid) returning id into _id;
  insert into public.chat_members (channel_id, user_id, workspace_id, role) values (_id, _uid, _workspace, 'admin');
  foreach _m in array coalesce(_members, '{}') loop
    if _m <> _uid and public.is_workspace_member(_m, _workspace) then
      insert into public.chat_members (channel_id, user_id, workspace_id) values (_id, _m, _workspace) on conflict do nothing;
    end if;
  end loop;
  return _id;
end;
$$;

create or replace function public.chat_mark_read(_channel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ws uuid;
begin
  if _uid is null or not public.chat_can_access(_channel, _uid) then return; end if;
  select workspace_id into _ws from public.chat_channels where id = _channel;
  insert into public.chat_members (channel_id, user_id, workspace_id, last_read_at) values (_channel, _uid, _ws, now())
  on conflict (channel_id, user_id) do update set last_read_at = now();
end;
$$;

-- Nao lidas e mencoes por canal (so canais em que o usuario tem registro de leitura)
create or replace function public.chat_unread_counts(_workspace uuid)
returns table (channel_id uuid, unread bigint, mentions bigint)
language sql stable security definer set search_path = public as $$
  select m.channel_id,
         count(msg.id) filter (where msg.id is not null) as unread,
         count(msg.id) filter (where msg.id is not null and auth.uid() = any (msg.mentions)) as mentions
  from public.chat_members m
  join public.chat_channels c on c.id = m.channel_id and c.workspace_id = _workspace and c.archived_at is null
  left join public.chat_messages msg
    on msg.channel_id = m.channel_id and msg.created_at > m.last_read_at and msg.author_id <> m.user_id and msg.deleted_at is null
  where m.user_id = auth.uid() and public.is_workspace_member(auth.uid(), _workspace)
  group by m.channel_id;
$$;

-- Mencao vira notificacao (so para quem pode ler o canal)
create or replace function public.chat_notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare _canal text; _autor text; _uid uuid;
begin
  if new.mentions is null or cardinality(new.mentions) = 0 then return new; end if;
  select coalesce(c.name, 'mensagem direta') into _canal from public.chat_channels c where c.id = new.channel_id;
  select coalesce(p.full_name, 'Alguém') into _autor from public.profiles p where p.id = new.author_id;
  foreach _uid in array new.mentions loop
    if _uid <> new.author_id and public.chat_can_access(new.channel_id, _uid) then
      begin
        insert into public.notifications (user_id, workspace_id, type, title, message, metadata)
        values (_uid, new.workspace_id, 'chat_mention', _autor || ' mencionou você em ' || _canal,
                left(new.body, 140), jsonb_build_object('channel_id', new.channel_id, 'message_id', new.id));
      exception when others then
        raise warning 'chat_notify_mentions falhou: %', sqlerrm;
      end;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_chat_notify_mentions on public.chat_messages;
create trigger trg_chat_notify_mentions after insert on public.chat_messages
  for each row execute function public.chat_notify_mentions();

-- Tempo real
do $$ begin
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chat_reactions; exception when duplicate_object then null; end;
end $$;

commit;
