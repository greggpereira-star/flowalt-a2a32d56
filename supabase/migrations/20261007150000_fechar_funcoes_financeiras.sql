-- Fecha o acesso a funções financeiras que qualquer pessoa (inclusive sem login) conseguia executar.
-- Antes: 10 funções SECURITY DEFINER com EXECUTE para anon/authenticated e sem checagem de permissão
-- (algumas gravavam: folha de pagamento, depreciação lançada como despesa, snapshots).
-- Depois: cada função confere o papel no workspace; service_role/postgres (cron, edge functions) seguem passando.
-- Regra: financeiro = super_admin, owner (sócio/master) e finance; folha = super_admin e owner.

create or replace function public._guarda_acesso(p_workspace_id uuid, p_nivel text)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- 'role' é o papel de quem chamou (PostgREST faz set role); 'none' = conexão direta do administrador.
  if coalesce(auth.role(), '') = 'service_role' or current_setting('role') in ('none', 'postgres', 'supabase_admin', 'service_role') then
    return;
  end if;
  if auth.uid() is null or p_workspace_id is null then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_nivel = 'salario' and public.has_salary_access(auth.uid(), p_workspace_id) then return; end if;
  if p_nivel = 'financeiro' and public.has_finance_access(auth.uid(), p_workspace_id) then return; end if;
  if p_nivel = 'membro' and public.is_workspace_member(auth.uid(), p_workspace_id) then return; end if;
  raise exception 'Acesso negado' using errcode = '42501';
end $$;
revoke all on function public._guarda_acesso(uuid, text) from public, anon, authenticated;

-- Renomeia as originais e coloca um invólucro com a checagem no lugar.
alter function public.calculate_monthly_depreciation(uuid, date) rename to calculate_monthly_depreciation__impl;
alter function public.compute_daily_snapshot(uuid) rename to compute_daily_snapshot__impl;
alter function public.compute_dashboard_snapshot(uuid, text) rename to compute_dashboard_snapshot__impl;
alter function public.compute_executive_kpis(uuid) rename to compute_executive_kpis__impl;
alter function public.generate_payroll(uuid, date, uuid) rename to generate_payroll__impl;
alter function public.get_card_financial_summary(uuid) rename to get_card_financial_summary__impl;
alter function public.get_item_movement_timeline(uuid, integer) rename to get_item_movement_timeline__impl;
alter function public.match_dda_with_transactions(uuid, integer, numeric) rename to match_dda_with_transactions__impl;

create function public.calculate_monthly_depreciation(p_workspace_id uuid, p_month_ref date)
returns table(items_processed integer, total_depreciation numeric, dre_entry_id uuid)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso(p_workspace_id, 'financeiro');
  return query select * from public.calculate_monthly_depreciation__impl(p_workspace_id, p_month_ref);
end $$;

create function public.compute_daily_snapshot(p_workspace_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso(p_workspace_id, 'financeiro');
  return public.compute_daily_snapshot__impl(p_workspace_id);
end $$;

create function public.compute_dashboard_snapshot(p_workspace_id uuid, p_snapshot_type text)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso(p_workspace_id, case when p_snapshot_type = 'financial' then 'financeiro' else 'membro' end);
  perform public.compute_dashboard_snapshot__impl(p_workspace_id, p_snapshot_type);
end $$;

create function public.compute_executive_kpis(p_workspace_id uuid)
returns json
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso(p_workspace_id, 'financeiro');
  return public.compute_executive_kpis__impl(p_workspace_id);
end $$;

create function public.generate_payroll(p_workspace_id uuid, p_reference_month date, p_collaborator_id uuid default null)
returns integer
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso(p_workspace_id, 'salario');
  return public.generate_payroll__impl(p_workspace_id, p_reference_month, p_collaborator_id);
end $$;

create function public.get_card_financial_summary(p_card_id uuid)
returns table(total_income numeric, total_expenses numeric, kit_estimated_cost numeric, movements_count integer, transactions_count integer)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso((select workspace_id from public.cards where id = p_card_id), 'financeiro');
  return query select * from public.get_card_financial_summary__impl(p_card_id);
end $$;

create function public.get_item_movement_timeline(p_item_id uuid, p_limit integer default 50)
returns table(id uuid, movement_type text, quantity integer, stock_delta integer, serial_number text, card_title text, department_name text, notes text, occurred_at timestamptz, running_balance integer)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso((select workspace_id from public.inventory_items where id = p_item_id), 'membro');
  return query select * from public.get_item_movement_timeline__impl(p_item_id, p_limit);
end $$;

create function public.match_dda_with_transactions(p_workspace_id uuid, p_tolerance_days integer, p_tolerance_amount numeric)
returns table(boleto_id uuid, transaction_id uuid, match_score numeric, match_reason text)
language plpgsql security definer set search_path to 'public' as $$
begin
  perform public._guarda_acesso(p_workspace_id, 'financeiro');
  return query select * from public.match_dda_with_transactions__impl(p_workspace_id, p_tolerance_days, p_tolerance_amount);
end $$;

-- Originais: só postgres e service_role. Invólucros: só quem está logado (anônimo não chama nada).
revoke all on function public.calculate_monthly_depreciation__impl(uuid, date) from public, anon, authenticated;
revoke all on function public.compute_daily_snapshot__impl(uuid) from public, anon, authenticated;
revoke all on function public.compute_dashboard_snapshot__impl(uuid, text) from public, anon, authenticated;
revoke all on function public.compute_executive_kpis__impl(uuid) from public, anon, authenticated;
revoke all on function public.generate_payroll__impl(uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.get_card_financial_summary__impl(uuid) from public, anon, authenticated;
revoke all on function public.get_item_movement_timeline__impl(uuid, integer) from public, anon, authenticated;
revoke all on function public.match_dda_with_transactions__impl(uuid, integer, numeric) from public, anon, authenticated;

revoke all on function public.calculate_monthly_depreciation(uuid, date) from public, anon;
revoke all on function public.compute_daily_snapshot(uuid) from public, anon;
revoke all on function public.compute_dashboard_snapshot(uuid, text) from public, anon;
revoke all on function public.compute_executive_kpis(uuid) from public, anon;
revoke all on function public.generate_payroll(uuid, date, uuid) from public, anon;
revoke all on function public.get_card_financial_summary(uuid) from public, anon;
revoke all on function public.get_item_movement_timeline(uuid, integer) from public, anon;
revoke all on function public.match_dda_with_transactions(uuid, integer, numeric) from public, anon;
grant execute on function public.calculate_monthly_depreciation(uuid, date), public.compute_daily_snapshot(uuid),
  public.compute_dashboard_snapshot(uuid, text), public.compute_executive_kpis(uuid), public.generate_payroll(uuid, date, uuid),
  public.get_card_financial_summary(uuid), public.get_item_movement_timeline(uuid, integer),
  public.match_dda_with_transactions(uuid, integer, numeric) to authenticated, service_role;

-- Migração pontual de dados, sem chamador no sistema: ninguém de fora precisa executar.
revoke all on function public.migrate_clients_to_client_cards(uuid) from public, anon, authenticated;
