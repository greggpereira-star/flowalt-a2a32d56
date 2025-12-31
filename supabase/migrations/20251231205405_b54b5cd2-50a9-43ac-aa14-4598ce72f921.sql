-- Corrigir views para usar SECURITY INVOKER (padrão seguro)

-- 1. Drop e recriar view inventory_stock_summary com SECURITY INVOKER
DROP VIEW IF EXISTS public.inventory_stock_summary;
CREATE VIEW public.inventory_stock_summary 
WITH (security_invoker = true)
AS
SELECT 
  i.id as item_id,
  i.workspace_id,
  i.code,
  i.name,
  i.category,
  i.department_id,
  i.current_stock,
  i.min_stock,
  i.status_condition,
  i.is_serialized,
  i.purchase_value,
  i.residual_value,
  i.useful_life_months,
  CASE 
    WHEN i.category = 'consumable' AND i.min_stock IS NOT NULL AND i.current_stock < i.min_stock THEN 'low_stock'
    WHEN i.category = 'consumable' AND i.current_stock = 0 THEN 'out_of_stock'
    WHEN i.status_condition = 'maintenance' THEN 'maintenance'
    ELSE 'available'
  END as stock_status,
  (SELECT COUNT(*) FROM inventory_units u WHERE u.item_id = i.id AND u.current_status = 'in_stock') as units_in_stock,
  (SELECT COUNT(*) FROM inventory_units u WHERE u.item_id = i.id AND u.current_status = 'checked_out') as units_checked_out,
  (SELECT COUNT(*) FROM inventory_units u WHERE u.item_id = i.id AND u.current_status = 'maintenance') as units_in_maintenance
FROM inventory_items i
WHERE i.is_active = true;

-- 2. Drop e recriar view financial_alerts_summary com SECURITY INVOKER
DROP VIEW IF EXISTS public.financial_alerts_summary;
CREATE VIEW public.financial_alerts_summary 
WITH (security_invoker = true)
AS
SELECT 
  workspace_id,
  COUNT(*) FILTER (WHERE status = 'active') as active_alerts,
  COUNT(*) FILTER (WHERE status = 'active' AND severity = 'critical') as critical_alerts,
  COUNT(*) FILTER (WHERE status = 'active' AND severity = 'high') as high_alerts,
  COUNT(*) FILTER (WHERE status = 'active' AND severity = 'medium') as medium_alerts,
  COUNT(*) FILTER (WHERE status = 'active' AND severity = 'low') as low_alerts,
  COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_alerts,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts
FROM financial_alerts
GROUP BY workspace_id;