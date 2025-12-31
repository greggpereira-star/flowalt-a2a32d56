
-- Sprint 7: View e função simplificadas para KPIs executivos

-- View: inventory_exec_kpis - KPIs executivos de inventário (simplificada)
CREATE OR REPLACE VIEW public.inventory_exec_kpis AS
SELECT
  i.workspace_id,
  COUNT(DISTINCT i.id) AS total_items,
  COUNT(DISTINCT u.id) AS total_units,
  COALESCE(SUM(i.purchase_value * COALESCE(i.current_stock, 0)), 0) AS total_asset_value,
  COALESCE(SUM(i.purchase_value * COALESCE(i.current_stock, 0)), 0) AS total_book_value,
  0::NUMERIC AS total_accumulated_depreciation,
  
  (SELECT COALESCE(SUM(CASE 
    WHEN sl.billing_cycle = 'monthly' THEN sl.cost_per_cycle
    WHEN sl.billing_cycle = 'quarterly' THEN sl.cost_per_cycle / 3
    WHEN sl.billing_cycle = 'yearly' THEN sl.cost_per_cycle / 12
    ELSE sl.cost_per_cycle END), 0)
  FROM subscription_licenses sl WHERE sl.workspace_id = i.workspace_id AND sl.status = 'active') AS monthly_license_cost,
  
  (SELECT COALESCE(SUM(CASE 
    WHEN sl.billing_cycle = 'monthly' THEN sl.cost_per_cycle * 12
    WHEN sl.billing_cycle = 'quarterly' THEN sl.cost_per_cycle * 4
    WHEN sl.billing_cycle = 'yearly' THEN sl.cost_per_cycle
    ELSE sl.cost_per_cycle * 12 END), 0)
  FROM subscription_licenses sl WHERE sl.workspace_id = i.workspace_id AND sl.status = 'active') AS yearly_license_cost,
  
  (SELECT COALESCE(SUM(mr.cost), 0) FROM maintenance_records mr 
   WHERE mr.workspace_id = i.workspace_id AND mr.status = 'completed'
   AND mr.completed_date >= CURRENT_DATE - INTERVAL '12 months') AS yearly_maintenance_cost,
  
  (SELECT COUNT(*) FROM inventory_items ii WHERE ii.workspace_id = i.workspace_id AND ii.current_stock <= ii.min_stock) AS low_stock_count,
  
  (SELECT COUNT(*) FROM subscription_licenses sl2 WHERE sl2.workspace_id = i.workspace_id 
   AND sl2.status = 'active' AND sl2.renewal_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS expiring_subscriptions_count,
  
  (SELECT COUNT(*) FROM subscription_licenses sl3 WHERE sl3.workspace_id = i.workspace_id 
   AND sl3.status = 'active' AND sl3.seats_total > 0 AND (COALESCE(sl3.seats_used, 0)::NUMERIC / sl3.seats_total) < 0.5) AS underutilized_licenses_count,
  
  (SELECT COUNT(*) FROM maintenance_records mr2 WHERE mr2.workspace_id = i.workspace_id AND mr2.status IN ('pending', 'in_progress')) AS pending_maintenance_count,
  
  (SELECT COUNT(*) FROM card_kits ck WHERE ck.workspace_id = i.workspace_id AND ck.status = 'checked_out' AND ck.expected_return_date < NOW()) AS overdue_returns_count

FROM inventory_items i
LEFT JOIN inventory_units u ON u.item_id = i.id
GROUP BY i.workspace_id;

-- Grant permissions
GRANT SELECT ON public.inventory_exec_kpis TO authenticated;
