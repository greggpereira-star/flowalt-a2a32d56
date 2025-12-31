-- Corrigir views para usar SECURITY INVOKER

-- Recriar system_health_view com SECURITY INVOKER
DROP VIEW IF EXISTS public.system_health_view;
CREATE VIEW public.system_health_view 
WITH (security_invoker = on)
AS
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  (SELECT COUNT(*) FROM cards c WHERE c.workspace_id = w.id) as total_cards,
  (SELECT COUNT(*) FROM cards c WHERE c.workspace_id = w.id AND c.status = 'in_progress') as active_cards,
  (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as team_size,
  (SELECT MAX(created_at) FROM cards c WHERE c.workspace_id = w.id) as last_card_created,
  (SELECT MAX(started_at) FROM time_entries te WHERE te.workspace_id = w.id) as last_time_entry,
  (SELECT COUNT(*) FROM application_logs al WHERE al.workspace_id = w.id AND al.level = 'error' AND al.created_at > now() - INTERVAL '24 hours') as errors_24h
FROM workspaces w;

-- Recriar inventory_exec_kpis com SECURITY INVOKER
DROP VIEW IF EXISTS public.inventory_exec_kpis;
CREATE VIEW public.inventory_exec_kpis
WITH (security_invoker = on)
AS
SELECT 
  i.workspace_id,
  COUNT(*) as total_items,
  COALESCE(SUM(i.current_stock * COALESCE(i.purchase_value, 0)), 0) as total_asset_value,
  0 as book_value,
  0 as total_depreciation,
  COUNT(*) FILTER (WHERE i.current_stock <= i.min_stock AND i.min_stock > 0) as low_stock_count,
  COUNT(*) FILTER (WHERE i.current_stock = 0) as out_of_stock_count,
  0 as monthly_license_cost,
  0 as yearly_license_cost,
  0 as potential_savings,
  0 as underutilized_licenses,
  0 as expiring_warranties_30d,
  0 as expired_warranties,
  0 as pending_maintenance,
  0 as monthly_maintenance_cost,
  0 as expiring_subscriptions_30d,
  0 as overdue_returns
FROM inventory_items i
GROUP BY i.workspace_id;