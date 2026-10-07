-- Onda 6: regras automaticas no servidor ("quando X acontecer, faca Y"), explicaveis e com historico.
--
-- Por que existe: o sistema antigo (card_automations) nunca foi usado (0 regras, 0 registros) e tem dois defeitos:
--  1) o gatilho do banco execute_card_automations so GRAVAVA "sucesso" em automation_logs, sem executar nada;
--  2) o motor do navegador compara a ETAPA do card, e o do banco comparava o STATUS: dominios diferentes.
-- Aqui as regras rodam no banco, para qualquer caminho (tela, portal do cliente, API), e cada execucao deixa um registro.
--
-- Eventos: card entrou numa etapa; cliente aprovou; cliente pediu ajustes.
-- Acoes: avisar pessoas; mover para uma etapa; mudar a prioridade.
-- Regra de seguranca: uma regra NUNCA dispara outra (sem cascata), e uma falha numa regra nao impede a acao original.
-- Todas as regras nascem DESLIGADAS; quem liga e o admin.
begin;

create table if not exists public.automation_rules (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  name           text not null check (length(btrim(name)) > 0),
  description    text,
  trigger_event  text not null check (trigger_event in ('stage_entered', 'approval_approved', 'approval_changes_requested')),
  trigger_stage  text,
  space_id       uuid references public.spaces(id) on delete cascade,
  action_type    text not null check (action_type in ('notify', 'move_to_stage', 'set_priority')),
  action_config  jsonb not null default '{}'::jsonb,
  is_active      boolean not null default false,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint automation_rules_stage_chk check ((trigger_event = 'stage_entered') = (trigger_stage is not null)),
  constraint automation_rules_stage_valida_chk check (trigger_stage is null or trigger_stage in ('backlog', 'planejamento', 'em_producao', 'revisao', 'aprovacao', 'concluido')),
  constraint automation_rules_cfg_chk check (
    (action_type = 'notify'
       and action_config->>'to' in ('members', 'creator', 'admins')
       and length(btrim(coalesce(action_config->>'message', ''))) > 0)
    or (action_type = 'move_to_stage'
       and action_config->>'stage' in ('backlog', 'planejamento', 'em_producao', 'revisao', 'aprovacao', 'concluido'))
    or (action_type = 'set_priority'
       and action_config->>'priority' in ('low', 'medium', 'high', 'critical'))
  )
);
create index if not exists idx_automation_rules_ws on public.automation_rules (workspace_id, is_active);

create table if not exists public.automation_rule_runs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  rule_id       uuid references public.automation_rules(id) on delete set null,
  rule_name     text not null,
  card_id       uuid references public.cards(id) on delete set null,
  card_title    text,
  trigger_event text not null,
  outcome       text not null check (outcome in ('done', 'error')),
  detail        text,
  ran_at        timestamptz not null default now()
);
create index if not exists idx_automation_rule_runs_ws on public.automation_rule_runs (workspace_id, ran_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_rule_runs enable row level security;

create policy automation_rules_select on public.automation_rules for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));
create policy automation_rules_insert on public.automation_rules for insert
  with check (
    public.has_admin_access((select auth.uid()), workspace_id)
    and created_by = (select auth.uid())
    and (space_id is null or exists (select 1 from public.spaces s where s.id = space_id and s.workspace_id = automation_rules.workspace_id))
  );
create policy automation_rules_update on public.automation_rules for update
  using (public.has_admin_access((select auth.uid()), workspace_id))
  with check (
    public.has_admin_access((select auth.uid()), workspace_id)
    and (space_id is null or exists (select 1 from public.spaces s where s.id = space_id and s.workspace_id = automation_rules.workspace_id))
  );
create policy automation_rules_delete on public.automation_rules for delete
  using (public.has_admin_access((select auth.uid()), workspace_id));

-- O historico so e escrito pela funcao do servidor; quem esta no workspace apenas le.
create policy automation_rule_runs_select on public.automation_rule_runs for select
  using (public.is_workspace_member((select auth.uid()), workspace_id));

create or replace function public.automation_rules_guard()
returns trigger language plpgsql as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'workspace e autoria da regra nao mudam';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_automation_rules_guard on public.automation_rules;
create trigger trg_automation_rules_guard before update on public.automation_rules
  for each row execute function public.automation_rules_guard();

-- Executa as regras ativas de um evento para um card. So e chamada pelos gatilhos abaixo.
create or replace function public.run_automation_rules(p_event text, p_card_id uuid, p_stage text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
  r record;
  v_n int;
  v_msg text;
  v_cur text;
  v_entrou timestamptz;
  v_to text;
  v_status card_status;
  v_wf uuid;
  v_detail text;
begin
  -- Sem cascata: uma acao de regra nao dispara outra regra.
  if coalesce(current_setting('flowalt.em_regra', true), '') = '1' then return; end if;

  select id, workspace_id, space_id, title, status, created_by into c from public.cards where id = p_card_id;
  if not found or c.status = 'archived' then return; end if;

  for r in
    select * from public.automation_rules
    where workspace_id = c.workspace_id
      and is_active
      and trigger_event = p_event
      and (trigger_event <> 'stage_entered' or trigger_stage = p_stage)
      and (space_id is null or space_id = c.space_id)
    order by created_at
  loop
    begin
      perform set_config('flowalt.em_regra', '1', true);
      v_detail := null;

      if r.action_type = 'notify' then
        v_msg := replace(coalesce(r.action_config->>'message', ''), '{{card}}', c.title);
        insert into public.notifications (user_id, workspace_id, type, title, message, metadata)
        select distinct x.u, c.workspace_id, 'automation', r.name, v_msg,
               jsonb_build_object('card_id', c.id, 'space_id', c.space_id, 'rule_id', r.id)
        from (
          select cm.user_id as u from public.card_members cm where cm.card_id = c.id and r.action_config->>'to' = 'members'
          union
          select c.created_by where r.action_config->>'to' = 'creator'
          union
          select ur.user_id from public.user_roles ur
           where ur.workspace_id = c.workspace_id and r.action_config->>'to' = 'admins'
             and ur.role in ('super_admin', 'owner', 'admin', 'coordinator')
        ) x
        join public.workspace_members wm on wm.user_id = x.u and wm.workspace_id = c.workspace_id and wm.is_active
        where x.u is not null;
        get diagnostics v_n = row_count;
        v_detail := v_n || case when v_n = 1 then ' pessoa avisada' else ' pessoas avisadas' end;

      elsif r.action_type = 'move_to_stage' then
        v_to := r.action_config->>'stage';
        select current_stage, stage_entered_at into v_cur, v_entrou from public.cards where id = c.id;
        if v_cur is not distinct from v_to then
          v_detail := 'o card ja estava na etapa ' || v_to;
        else
          v_status := case v_to
            when 'backlog' then 'backlog' when 'planejamento' then 'todo' when 'em_producao' then 'in_progress'
            when 'revisao' then 'review' when 'aprovacao' then 'approved' when 'concluido' then 'delivered' end;
          select id into v_wf from public.workflows where workspace_id = c.workspace_id order by created_at limit 1;
          if v_wf is null then raise exception 'workspace sem fluxo de etapas'; end if;
          update public.cards set current_stage = v_to, status = v_status, stage_entered_at = now() where id = c.id;
          insert into public.card_stage_history (card_id, workflow_id, from_stage, to_stage, transition_type, triggered_by, reason, time_in_previous_stage)
          values (c.id, v_wf, v_cur, v_to, 'normal', null, 'Regra automatica: ' || r.name,
                  case when v_entrou is not null then now() - v_entrou end);
          v_detail := 'movido de ' || coalesce(v_cur, '(sem etapa)') || ' para ' || v_to;
        end if;

      elsif r.action_type = 'set_priority' then
        update public.cards set urgency = (r.action_config->>'priority')::card_urgency where id = c.id;
        v_detail := 'prioridade ' || (r.action_config->>'priority');
      end if;

      insert into public.automation_rule_runs (workspace_id, rule_id, rule_name, card_id, card_title, trigger_event, outcome, detail)
      values (c.workspace_id, r.id, r.name, c.id, c.title, p_event, 'done', v_detail);
    exception when others then
      insert into public.automation_rule_runs (workspace_id, rule_id, rule_name, card_id, card_title, trigger_event, outcome, detail)
      values (c.workspace_id, r.id, r.name, c.id, c.title, p_event, 'error', sqlerrm);
    end;
    perform set_config('flowalt.em_regra', '0', true);
  end loop;
end;
$$;
revoke execute on function public.run_automation_rules(text, uuid, text) from public, anon, authenticated;

create or replace function public.trg_regras_ao_mudar_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_stage is distinct from old.current_stage and new.current_stage is not null then
    begin
      perform public.run_automation_rules('stage_entered', new.id, new.current_stage);
    exception when others then
      raise warning 'regras automaticas (etapa) falharam: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.trg_regras_ao_mudar_etapa() from public, anon, authenticated;
drop trigger if exists on_card_stage_automation_rules on public.cards;
create trigger on_card_stage_automation_rules after update of current_stage on public.cards
  for each row execute function public.trg_regras_ao_mudar_etapa();

create or replace function public.trg_regras_ao_decidir_aprovacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'changes_requested') then
    begin
      perform public.run_automation_rules(case new.status when 'approved' then 'approval_approved' else 'approval_changes_requested' end, new.card_id, null);
    exception when others then
      raise warning 'regras automaticas (aprovacao) falharam: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.trg_regras_ao_decidir_aprovacao() from public, anon, authenticated;
drop trigger if exists on_approval_automation_rules on public.approval_requests;
create trigger on_approval_automation_rules after update of status on public.approval_requests
  for each row execute function public.trg_regras_ao_decidir_aprovacao();

-- Gatilho antigo: so gravava "sucesso" sem executar nada. Sai para nao produzir registros falsos.
drop trigger if exists on_card_status_change_automation on public.cards;

-- Modelos prontos, todos desligados. O admin liga os que fizerem sentido.
insert into public.automation_rules (workspace_id, name, description, trigger_event, trigger_stage, action_type, action_config)
select w.id, m.nome, m.descricao, m.evento, m.etapa, m.acao, m.config::jsonb
from public.workspaces w
join (values
  ('Cliente pediu ajustes: voltar para Em Produção', 'Quando o cliente pede ajustes na aprovação, o card volta para a etapa Em Produção.', 'approval_changes_requested', null, 'move_to_stage', '{"stage":"em_producao"}'),
  ('Cliente pediu ajustes: avisar os responsáveis', 'Avisa quem trabalha no card quando o cliente pede ajustes.', 'approval_changes_requested', null, 'notify', '{"to":"members","message":"O cliente pediu ajustes em \"{{card}}\"."}'),
  ('Entrou em Aprovação: avisar a coordenação', 'Avisa coordenação e administradores quando um card chega à etapa Aprovação.', 'stage_entered', 'aprovacao', 'notify', '{"to":"admins","message":"\"{{card}}\" chegou à etapa Aprovação."}')
) as m(nome, descricao, evento, etapa, acao, config) on true
where w.id = '10a7ca16-6328-490f-a6bd-28974a91ef8f'
  and not exists (select 1 from public.automation_rules x where x.workspace_id = w.id and x.name = m.nome);

commit;
