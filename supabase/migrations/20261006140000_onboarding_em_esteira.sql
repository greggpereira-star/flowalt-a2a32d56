-- Onda 4 (blueprint V3): onboarding de clientes em esteira, com playbook por etapa.
--
-- O que existe hoje: o espaco "Onboarding de Clientes" tem 0 cards, e todas as tabelas de modelos (kits, modelos de
-- checklist, processos, pastas) estao vazias. Este modulo e novo e nao mexe em nada existente.
--
-- Desenho:
--   onboarding_templates / _stages / _tasks   o modelo: etapas em ordem, cada uma com seu playbook ("como fazemos"),
--                                             e tarefas com prazo em dias a partir do inicio (D+n).
--   client_onboardings                        um onboarding de um cliente (um ativo por cliente), com a data de inicio.
--   client_onboarding_tasks                   as tarefas do cliente, copiadas do modelo, com prazo, responsavel e feito.
--
-- Por que tabelas proprias e nao cards: cada tarefa de onboarding virar um card inundaria os quadros e os indicadores
-- de entrega. Aqui a esteira e o quadro compilado de clientes sao a propria visao.
--
-- Seguranca: todas as tabelas tem workspace_id e RLS. Membros leem e trabalham as tarefas; so admin edita modelos.
-- Aditiva. Reversao no fim do arquivo.

begin;

create table if not exists public.onboarding_templates (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create unique index if not exists uq_onboarding_template_default on public.onboarding_templates (workspace_id) where is_default;

create table if not exists public.onboarding_template_stages (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.onboarding_templates(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  key           text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name          text not null,
  sort_order    int  not null default 0,
  playbook      text,
  unique (template_id, key)
);

create table if not exists public.onboarding_template_tasks (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.onboarding_templates(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  stage_key     text not null,
  title         text not null,
  description   text,
  offset_days   int  not null default 0 check (offset_days between 0 and 365),
  sort_order    int  not null default 0
);
create index if not exists idx_onb_tpl_tasks on public.onboarding_template_tasks (template_id, stage_key, sort_order);

create table if not exists public.client_onboardings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  client_id     uuid not null references public.client_cards(id) on delete cascade,
  template_id   uuid references public.onboarding_templates(id) on delete set null,
  start_date    date not null default current_date,
  status        text not null default 'active' check (status in ('active', 'done', 'canceled')),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create unique index if not exists uq_client_onboarding_ativo on public.client_onboardings (client_id) where status = 'active';
create index if not exists idx_client_onboardings_ws on public.client_onboardings (workspace_id, status);

create table if not exists public.client_onboarding_tasks (
  id             uuid primary key default gen_random_uuid(),
  onboarding_id  uuid not null references public.client_onboardings(id) on delete cascade,
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  stage_key      text not null,
  title          text not null check (char_length(title) between 1 and 300),
  description    text,
  due_date       date,
  assignee_id    uuid,
  completed_at   timestamptz,
  completed_by   uuid,
  sort_order     int  not null default 0,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_client_onb_tasks on public.client_onboarding_tasks (onboarding_id, stage_key, sort_order);
create index if not exists idx_client_onb_tasks_assignee on public.client_onboarding_tasks (assignee_id) where completed_at is null;

-- RLS ------------------------------------------------------------------------------------------------------------
alter table public.onboarding_templates       enable row level security;
alter table public.onboarding_template_stages enable row level security;
alter table public.onboarding_template_tasks  enable row level security;
alter table public.client_onboardings         enable row level security;
alter table public.client_onboarding_tasks    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['onboarding_templates', 'onboarding_template_stages', 'onboarding_template_tasks'] loop
    execute format('create policy %I on public.%I for select using (public.is_workspace_member((select auth.uid()), workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (public.has_admin_access((select auth.uid()), workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.has_admin_access((select auth.uid()), workspace_id)) with check (public.has_admin_access((select auth.uid()), workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.has_admin_access((select auth.uid()), workspace_id))', t || '_delete', t);
  end loop;
end $$;

create policy client_onboardings_select on public.client_onboardings for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_onboardings_update on public.client_onboardings for update
  using (public.is_workspace_member((select auth.uid()), workspace_id))
  with check (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_onboardings_delete on public.client_onboardings for delete
  using (public.has_admin_access((select auth.uid()), workspace_id));
-- (a criacao passa pela funcao iniciar_onboarding)

create policy client_onb_tasks_select on public.client_onboarding_tasks for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_onb_tasks_insert on public.client_onboarding_tasks for insert
  with check (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_onb_tasks_update on public.client_onboarding_tasks for update
  using (public.is_workspace_member((select auth.uid()), workspace_id))
  with check (public.is_workspace_member((select auth.uid()), workspace_id));
create policy client_onb_tasks_delete on public.client_onboarding_tasks for delete
  using (public.has_admin_access((select auth.uid()), workspace_id));

-- Gatilhos de protecao ---------------------------------------------------------------------------------------------
-- Tarefa: nao muda de onboarding nem de workspace; "feito" registra quem e quando, e some ao desfazer.
create or replace function public.client_onb_tasks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.onboarding_id is distinct from old.onboarding_id or new.workspace_id is distinct from old.workspace_id then
    raise exception 'nao e permitido mudar o onboarding ou o workspace de uma tarefa';
  end if;
  if new.assignee_id is not null and not public.is_workspace_member(new.assignee_id, new.workspace_id) then
    raise exception 'o responsavel precisa ser membro do workspace';
  end if;
  if old.completed_at is null and new.completed_at is not null then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.completed_at is null then
    new.completed_by := null;
  else
    new.completed_at := old.completed_at;
    new.completed_by := old.completed_by;
  end if;
  return new;
end;
$$;
revoke execute on function public.client_onb_tasks_guard() from public, anon, authenticated;
drop trigger if exists trg_client_onb_tasks_guard on public.client_onboarding_tasks;
create trigger trg_client_onb_tasks_guard before update on public.client_onboarding_tasks
  for each row execute function public.client_onb_tasks_guard();

-- Onboarding: so status e conclusao mudam
create or replace function public.client_onboardings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.workspace_id is distinct from old.workspace_id or new.client_id is distinct from old.client_id
     or new.template_id is distinct from old.template_id or new.created_by is distinct from old.created_by then
    raise exception 'so o status e a data de inicio do onboarding podem mudar';
  end if;
  if new.status = 'done' and old.status <> 'done' then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;
revoke execute on function public.client_onboardings_guard() from public, anon, authenticated;
drop trigger if exists trg_client_onboardings_guard on public.client_onboardings;
create trigger trg_client_onboardings_guard before update on public.client_onboardings
  for each row execute function public.client_onboardings_guard();

-- Funcoes ----------------------------------------------------------------------------------------------------------
-- Garante o modelo inicial (rascunho a ajustar ao processo da ALT). Etapas e tarefas partem do que o proprio sistema ja
-- usava ao assinar uma proposta (boas-vindas, acessos e materiais de marca, kick-off, ferramentas e calendario editorial,
-- primeira entrega) e dos marcos de 15 e 30 dias.
create or replace function public.onboarding_ensure_default_template(_workspace uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _id uuid;
begin
  if _uid is null or not public.is_workspace_member(_uid, _workspace) then raise exception 'sem acesso ao workspace'; end if;
  select id into _id from public.onboarding_templates where workspace_id = _workspace and is_default limit 1;
  if _id is not null then return _id; end if;

  insert into public.onboarding_templates (workspace_id, name, description, is_default, created_by)
  values (_workspace, 'Onboarding padrão (30 dias)', 'Modelo inicial: ajuste as etapas, tarefas e playbooks ao processo da agência.', true, _uid)
  returning id into _id;

  insert into public.onboarding_template_stages (template_id, workspace_id, key, name, sort_order, playbook) values
    (_id, _workspace, 'administrativo', 'Administrativo', 1, E'Objetivo: deixar contrato, dados e acessos resolvidos antes de começar a produzir.\n\n• Confirme que o contrato está assinado e o cadastro do cliente está completo.\n• Peça logo, senhas e manual de marca no mesmo pedido, para o cliente enviar uma vez só.\n• Registre onde cada acesso foi guardado.'),
    (_id, _workspace, 'kickoff', 'Kick-off', 2, E'Objetivo: alinhar expectativas e apresentar o time.\n\n• Envie as boas-vindas no mesmo dia da assinatura.\n• Apresente quem responde por quê e o canal para falar com a agência.\n• Na reunião de kick-off, combine metas, prioridades do primeiro mês e como o cliente aprova as peças.'),
    (_id, _workspace, 'configuracao', 'Configuração', 3, E'Objetivo: deixar a operação pronta para a primeira entrega.\n\n• Configure as ferramentas e o calendário editorial.\n• Preencha o briefing do cliente no cadastro.\n• Defina a rotina de aprovação (quem aprova e em quanto tempo).'),
    (_id, _workspace, 'primeira_entrega', 'Primeira entrega', 4, E'Objetivo: fazer a primeira entrega e confirmar com o cliente que o rumo está certo.\n\n• Envie a primeira peça pela aprovação por link.\n• Anote os ajustes pedidos: eles viram regras do cliente.'),
    (_id, _workspace, 'cadencia_15', 'Cadência de 15 dias', 5, E'Objetivo: checar com o cliente se o início está como o combinado.\n\n• Faça a conversa de 15 dias: o que está funcionando e o que ajustar.\n• Resolva pendências de acesso ou material que ainda estejam abertas.'),
    (_id, _workspace, 'cadencia_30', 'Cadência de 30 dias', 6, E'Objetivo: fechar o onboarding e passar para a operação normal.\n\n• Apresente o resumo do primeiro mês.\n• Combine o ritmo da operação e os próximos passos.\n• Conclua o onboarding aqui quando todas as tarefas estiverem feitas.');

  insert into public.onboarding_template_tasks (template_id, workspace_id, stage_key, title, offset_days, sort_order) values
    (_id, _workspace, 'administrativo', 'Confirmar contrato assinado e cadastro do cliente completo', 1, 1),
    (_id, _workspace, 'administrativo', 'Coletar acessos e materiais de marca (logo, guidelines, senhas)', 3, 2),
    (_id, _workspace, 'kickoff', 'Enviar boas-vindas e apresentar o time responsável', 1, 1),
    (_id, _workspace, 'kickoff', 'Agendar e realizar a reunião de kick-off', 5, 2),
    (_id, _workspace, 'configuracao', 'Configurar ferramentas e calendário editorial', 7, 1),
    (_id, _workspace, 'configuracao', 'Preencher o briefing do cliente no cadastro', 7, 2),
    (_id, _workspace, 'primeira_entrega', 'Enviar a primeira peça para aprovação do cliente', 12, 1),
    (_id, _workspace, 'primeira_entrega', 'Confirmar a primeira entrega com o cliente', 14, 2),
    (_id, _workspace, 'cadencia_15', 'Reunião de alinhamento de 15 dias', 15, 1),
    (_id, _workspace, 'cadencia_30', 'Reunião de fechamento de 30 dias', 30, 1),
    (_id, _workspace, 'cadencia_30', 'Concluir o onboarding e passar o cliente para a operação', 30, 2);
  return _id;
end;
$$;

-- Inicia o onboarding de um cliente: copia as tarefas do modelo com prazo = inicio + D+n.
create or replace function public.iniciar_onboarding(_client uuid, _template uuid, _start date)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _ws uuid; _tpl_ws uuid; _id uuid;
begin
  select workspace_id into _ws from public.client_cards where id = _client;
  if _ws is null or _uid is null or not public.is_workspace_member(_uid, _ws) then raise exception 'sem acesso ao cliente'; end if;
  select workspace_id into _tpl_ws from public.onboarding_templates where id = _template and is_active;
  if _tpl_ws is distinct from _ws then raise exception 'modelo invalido'; end if;
  if exists (select 1 from public.client_onboardings where client_id = _client and status = 'active') then
    raise exception 'este cliente ja tem um onboarding em andamento';
  end if;

  insert into public.client_onboardings (workspace_id, client_id, template_id, start_date, created_by)
  values (_ws, _client, _template, coalesce(_start, current_date), _uid) returning id into _id;

  insert into public.client_onboarding_tasks (onboarding_id, workspace_id, stage_key, title, description, due_date, sort_order)
  select _id, _ws, t.stage_key, t.title, t.description, coalesce(_start, current_date) + t.offset_days, t.sort_order
  from public.onboarding_template_tasks t
  join public.onboarding_template_stages s on s.template_id = t.template_id and s.key = t.stage_key
  where t.template_id = _template
  order by s.sort_order, t.sort_order;
  return _id;
end;
$$;

revoke execute on function public.onboarding_ensure_default_template(uuid) from public, anon;
revoke execute on function public.iniciar_onboarding(uuid, uuid, date)      from public, anon;
grant  execute on function public.onboarding_ensure_default_template(uuid) to authenticated, service_role;
grant  execute on function public.iniciar_onboarding(uuid, uuid, date)      to authenticated, service_role;

commit;

-- Reversao:
--   drop table public.client_onboarding_tasks, public.client_onboardings, public.onboarding_template_tasks,
--     public.onboarding_template_stages, public.onboarding_templates cascade;
--   drop function public.onboarding_ensure_default_template(uuid), public.iniciar_onboarding(uuid, uuid, date),
--     public.client_onb_tasks_guard(), public.client_onboardings_guard();
