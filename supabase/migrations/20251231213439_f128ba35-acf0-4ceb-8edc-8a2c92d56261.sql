
-- Drop e recria a função compute_executive_kpis
DROP FUNCTION IF EXISTS public.compute_executive_kpis(UUID);

CREATE OR REPLACE FUNCTION public.compute_executive_kpis(p_workspace_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_cards_total INT;
  v_cards_in_progress INT;
  v_cards_overdue INT;
  v_cards_completed_week INT;
  v_cards_completed_month INT;
  v_hours_logged_week NUMERIC;
  v_hours_logged_month NUMERIC;
  v_active_members INT;
  v_members_with_activity_week INT;
  v_revenue_month NUMERIC;
  v_expenses_month NUMERIC;
  v_active_clients INT;
  v_avg_completion_time_hours NUMERIC;
  v_inventory_kpis RECORD;
BEGIN
  SELECT COUNT(*) INTO v_cards_total FROM cards WHERE workspace_id = p_workspace_id AND status != 'done';
  SELECT COUNT(*) INTO v_cards_in_progress FROM cards WHERE workspace_id = p_workspace_id AND status = 'doing';
  SELECT COUNT(*) INTO v_cards_overdue FROM cards WHERE workspace_id = p_workspace_id AND status != 'done' AND due_date < NOW();
  SELECT COUNT(*) INTO v_cards_completed_week FROM cards WHERE workspace_id = p_workspace_id AND status = 'done' AND completed_at >= NOW() - INTERVAL '7 days';
  SELECT COUNT(*) INTO v_cards_completed_month FROM cards WHERE workspace_id = p_workspace_id AND status = 'done' AND completed_at >= NOW() - INTERVAL '30 days';
  
  SELECT COALESCE(SUM(hours), 0) INTO v_hours_logged_week FROM time_entries WHERE workspace_id = p_workspace_id AND entry_date >= CURRENT_DATE - INTERVAL '7 days';
  SELECT COALESCE(SUM(hours), 0) INTO v_hours_logged_month FROM time_entries WHERE workspace_id = p_workspace_id AND entry_date >= CURRENT_DATE - INTERVAL '30 days';
  
  SELECT COUNT(*) INTO v_active_members FROM workspace_members WHERE workspace_id = p_workspace_id;
  SELECT COUNT(DISTINCT user_id) INTO v_members_with_activity_week FROM time_entries WHERE workspace_id = p_workspace_id AND entry_date >= CURRENT_DATE - INTERVAL '7 days';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue_month FROM transactions WHERE workspace_id = p_workspace_id AND type = 'income' AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE);
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses_month FROM transactions WHERE workspace_id = p_workspace_id AND type = 'expense' AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE);
  
  SELECT COUNT(*) INTO v_active_clients FROM clients WHERE workspace_id = p_workspace_id AND is_active = true;
  
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600), 0) INTO v_avg_completion_time_hours
  FROM cards WHERE workspace_id = p_workspace_id AND status = 'done' AND completed_at IS NOT NULL AND completed_at >= NOW() - INTERVAL '30 days';
  
  SELECT * INTO v_inventory_kpis FROM inventory_exec_kpis WHERE workspace_id = p_workspace_id;
  
  v_result := json_build_object(
    'timestamp', NOW(),
    'workspace_id', p_workspace_id,
    'cards_total', v_cards_total,
    'cards_in_progress', v_cards_in_progress,
    'cards_overdue', v_cards_overdue,
    'cards_completed_week', v_cards_completed_week,
    'cards_completed_month', v_cards_completed_month,
    'hours_logged_week', ROUND(v_hours_logged_week, 1),
    'hours_logged_month', ROUND(v_hours_logged_month, 1),
    'active_members', v_active_members,
    'members_with_activity_week', v_members_with_activity_week,
    'revenue_month', ROUND(v_revenue_month, 2),
    'expenses_month', ROUND(v_expenses_month, 2),
    'profit_month', ROUND(v_revenue_month - v_expenses_month, 2),
    'margin_month', CASE WHEN v_revenue_month > 0 THEN ROUND(((v_revenue_month - v_expenses_month) / v_revenue_month) * 100, 1) ELSE 0 END,
    'active_clients', v_active_clients,
    'cards_per_client', CASE WHEN v_active_clients > 0 THEN ROUND(v_cards_total::NUMERIC / v_active_clients, 1) ELSE 0 END,
    'avg_completion_time_hours', ROUND(v_avg_completion_time_hours, 1),
    'inventory', json_build_object(
      'total_items', COALESCE(v_inventory_kpis.total_items, 0),
      'total_units', COALESCE(v_inventory_kpis.total_units, 0),
      'total_asset_value', ROUND(COALESCE(v_inventory_kpis.total_asset_value, 0), 2),
      'total_book_value', ROUND(COALESCE(v_inventory_kpis.total_book_value, 0), 2),
      'monthly_license_cost', ROUND(COALESCE(v_inventory_kpis.monthly_license_cost, 0), 2),
      'yearly_license_cost', ROUND(COALESCE(v_inventory_kpis.yearly_license_cost, 0), 2),
      'yearly_maintenance_cost', ROUND(COALESCE(v_inventory_kpis.yearly_maintenance_cost, 0), 2),
      'low_stock_count', COALESCE(v_inventory_kpis.low_stock_count, 0),
      'expiring_subscriptions_count', COALESCE(v_inventory_kpis.expiring_subscriptions_count, 0),
      'underutilized_licenses_count', COALESCE(v_inventory_kpis.underutilized_licenses_count, 0),
      'pending_maintenance_count', COALESCE(v_inventory_kpis.pending_maintenance_count, 0),
      'overdue_returns_count', COALESCE(v_inventory_kpis.overdue_returns_count, 0)
    )
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_executive_kpis(UUID) TO authenticated;
