-- Onda 2 (blueprint V3): endurece as permissoes do chat depois da auditoria de 06/10/2026.
--
-- Achados confirmados no banco real (em transacao com ROLLBACK):
--   1. Escalonamento de privilegio: qualquer membro de um canal privado conseguia se promover a admin do canal
--      (UPDATE no proprio registro de chat_members) e expulsar o criador.
--   2. Adulteracao de mensagem: o autor podia mover a propria mensagem para OUTRO canal e reescrever o texto sem a
--      marca de edicao, porque a politica de UPDATE nao limita colunas.
--   3. "Apagar" so marcava deleted_at: o texto continuava legivel por qualquer participante via API.
--   4. Os canais de espaco ignoravam o nivel de acesso do espaco (access_level 'restricted'): hoje todos os espacos
--      sao 'operational', mas um espaco restrito criado depois teria o canal aberto a todo o workspace.
--   5. As funcoes chat_* eram executaveis por usuario anonimo (chat_can_access permitia sondar quem participa de
--      qual canal).
--   6. Canal privado podia ficar sem nenhum admin.
--
-- Correcoes: gatilhos que travam as colunas que nao podem mudar, apagar limpa o texto, o acesso a canal de espaco
-- respeita o espaco, funcoes revogadas para anonimo, e sempre sobra pelo menos um admin.
--
-- Aditiva (so gatilhos, funcoes e permissoes). Reversao no fim do arquivo.

begin;

-- 1) Quem pode executar as funcoes ----------------------------------------------------------------------------
revoke execute on function public.chat_can_access(uuid, uuid)             from public, anon;
revoke execute on function public.chat_is_member(uuid, uuid)              from public, anon;
revoke execute on function public.chat_is_channel_admin(uuid, uuid)       from public, anon;
revoke execute on function public.chat_ensure_channels(uuid)              from public, anon;
revoke execute on function public.chat_get_or_create_dm(uuid, uuid)       from public, anon;
revoke execute on function public.chat_create_private(uuid, text, uuid[]) from public, anon;
revoke execute on function public.chat_mark_read(uuid)                    from public, anon;
revoke execute on function public.chat_unread_counts(uuid)                from public, anon;
revoke execute on function public.chat_notify_mentions()                  from public, anon, authenticated;
grant  execute on function public.chat_can_access(uuid, uuid)             to authenticated, service_role;
grant  execute on function public.chat_is_member(uuid, uuid)              to authenticated, service_role;
grant  execute on function public.chat_is_channel_admin(uuid, uuid)       to authenticated, service_role;
grant  execute on function public.chat_ensure_channels(uuid)              to authenticated, service_role;
grant  execute on function public.chat_get_or_create_dm(uuid, uuid)       to authenticated, service_role;
grant  execute on function public.chat_create_private(uuid, text, uuid[]) to authenticated, service_role;
grant  execute on function public.chat_mark_read(uuid)                    to authenticated, service_role;
grant  execute on function public.chat_unread_counts(uuid)                to authenticated, service_role;

-- 2) Canal de espaco segue o acesso do espaco ----------------------------------------------------------------
create or replace function public.chat_can_access(_channel uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_channels c
    where c.id = _channel
      and c.archived_at is null
      and public.is_workspace_member(_user, c.workspace_id)
      and case c.kind
        when 'workspace' then true
        when 'client'    then true
        when 'space'     then exists (
          select 1 from public.spaces s
          where s.id = c.ref_id
            and (
              public.has_admin_access(_user, s.workspace_id)
              or s.access_level = 'operational'
              or (s.access_level = 'restricted' and exists (
                    select 1 from public.user_roles ur
                    where ur.workspace_id = s.workspace_id and ur.user_id = _user and ur.role = any (s.allowed_roles)))
            ))
        else exists (select 1 from public.chat_members m where m.channel_id = c.id and m.user_id = _user)
      end
  );
$$;
revoke execute on function public.chat_can_access(uuid, uuid) from public, anon;
grant  execute on function public.chat_can_access(uuid, uuid) to authenticated, service_role;

-- 3) chat_members: ninguem muda papel, canal ou pessoa sem ser admin; sempre sobra um admin ------------------------
create or replace function public.chat_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _restam int;
begin
  if _uid is null then return coalesce(new, old); end if;   -- sessao de servico/manutencao

  if tg_op = 'UPDATE' then
    if new.channel_id is distinct from old.channel_id or new.user_id is distinct from old.user_id
       or new.workspace_id is distinct from old.workspace_id then
      raise exception 'nao e permitido mudar o canal nem a pessoa de uma participacao';
    end if;
    if new.role is distinct from old.role then
      if not public.chat_is_channel_admin(old.channel_id, _uid) then
        raise exception 'so admin do canal muda papeis';
      end if;
    end if;
  end if;

  -- O canal nunca fica sem admin enquanto houver outras pessoas (vale para sair, ser removido ou ser rebaixado)
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into _restam from public.chat_members m
      where m.channel_id = old.channel_id and m.role = 'admin' and m.user_id <> old.user_id;
    if _restam = 0 and exists (select 1 from public.chat_members m where m.channel_id = old.channel_id and m.user_id <> old.user_id) then
      raise exception 'passe a administracao do canal para outra pessoa antes de sair ou ser rebaixado';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;
revoke execute on function public.chat_members_guard() from public, anon, authenticated;
drop trigger if exists trg_chat_members_guard on public.chat_members;
create trigger trg_chat_members_guard before update or delete on public.chat_members
  for each row execute function public.chat_members_guard();

-- Admin de canal privado muda o papel das outras pessoas (promover/rebaixar). Antes nao havia regra para isso.
drop policy if exists chat_members_admin_update on public.chat_members;
create policy chat_members_admin_update on public.chat_members for update
  using (public.chat_is_channel_admin(channel_id, (select auth.uid()))
         and exists (select 1 from public.chat_channels c where c.id = channel_id and c.kind = 'private'))
  with check (public.chat_is_channel_admin(channel_id, (select auth.uid())));

-- 4) chat_messages: so o texto (com marca de edicao) e o apagar mudam; apagar limpa o conteudo ------------------
create or replace function public.chat_messages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.channel_id is distinct from old.channel_id or new.workspace_id is distinct from old.workspace_id
     or new.author_id is distinct from old.author_id or new.created_at is distinct from old.created_at
     or new.reply_to is distinct from old.reply_to or new.card_id is distinct from old.card_id then
    raise exception 'nao e permitido mudar canal, autor, data ou resposta de uma mensagem';
  end if;
  if old.deleted_at is not null then
    raise exception 'mensagem apagada nao pode ser alterada';
  end if;
  if new.deleted_at is not null then
    -- apagar: some o conteudo de verdade, nao so da tela
    new.body := '(mensagem apagada)';
    new.mentions := '{}';
    new.attachments := '[]'::jsonb;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.chat_messages_guard() from public, anon, authenticated;
drop trigger if exists trg_chat_messages_guard on public.chat_messages;
create trigger trg_chat_messages_guard before update on public.chat_messages
  for each row execute function public.chat_messages_guard();

-- 5) chat_channels: so nome e arquivamento mudam --------------------------------------------------------------
create or replace function public.chat_channels_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.workspace_id is distinct from old.workspace_id or new.kind is distinct from old.kind
     or new.ref_id is distinct from old.ref_id or new.created_by is distinct from old.created_by then
    raise exception 'so o nome e o arquivamento do canal podem mudar';
  end if;
  return new;
end;
$$;
revoke execute on function public.chat_channels_guard() from public, anon, authenticated;
drop trigger if exists trg_chat_channels_guard on public.chat_channels;
create trigger trg_chat_channels_guard before update on public.chat_channels
  for each row execute function public.chat_channels_guard();

commit;

-- Reversao:
--   drop trigger trg_chat_members_guard on public.chat_members;  drop function public.chat_members_guard();
--   drop trigger trg_chat_messages_guard on public.chat_messages; drop function public.chat_messages_guard();
--   drop trigger trg_chat_channels_guard on public.chat_channels; drop function public.chat_channels_guard();
--   drop policy chat_members_admin_update on public.chat_members;
--   grant execute on all functions in schema public to anon;  -- so se for realmente necessario
