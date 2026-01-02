-- FIX: All remaining functions with entity_id::text issue

-- 1. Fix check_stock_alerts
CREATE OR REPLACE FUNCTION public.check_stock_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  -- Check low stock alerts for items after movement
  FOR v_item IN 
    SELECT ii.id, ii.name, ii.workspace_id, ii.min_stock, ii.current_stock
    FROM inventory_items ii
    WHERE ii.id = NEW.item_id
      AND ii.min_stock > 0
      AND ii.current_stock <= ii.min_stock
  LOOP
    -- Check if alert already exists and is active
    IF NOT EXISTS (
      SELECT 1 FROM financial_alerts 
      WHERE workspace_id = v_item.workspace_id 
        AND entity_type = 'inventory_item'
        AND entity_id = v_item.id
        AND alert_type = 'low_stock'
        AND status = 'active'
    ) THEN
      INSERT INTO financial_alerts (
        workspace_id, alert_type, severity, title, message,
        entity_type, entity_id, status
      ) VALUES (
        v_item.workspace_id,
        'low_stock',
        CASE WHEN v_item.current_stock = 0 THEN 'critical' ELSE 'high' END,
        'Estoque baixo: ' || v_item.name,
        'O item ' || v_item.name || ' está com estoque baixo (' || v_item.current_stock || '/' || v_item.min_stock || ')',
        'inventory_item',
        v_item.id,
        'active'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 2. Fix check_subscription_renewal_alerts
CREATE OR REPLACE FUNCTION public.check_subscription_renewal_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if renewal is coming up in next 30 days
  IF NEW.renewal_date IS NOT NULL AND NEW.renewal_date <= CURRENT_DATE + INTERVAL '30 days' AND NEW.status = 'active' THEN
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM financial_alerts 
      WHERE workspace_id = NEW.workspace_id 
        AND entity_type = 'subscription'
        AND entity_id = NEW.id
        AND alert_type = 'subscription_renewal'
        AND status = 'active'
    ) THEN
      INSERT INTO financial_alerts (
        workspace_id, alert_type, severity, title, message,
        entity_type, entity_id, status
      ) VALUES (
        NEW.workspace_id,
        'subscription_renewal',
        CASE 
          WHEN NEW.renewal_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
          WHEN NEW.renewal_date <= CURRENT_DATE + INTERVAL '14 days' THEN 'high'
          ELSE 'medium'
        END,
        'Renovação próxima: ' || NEW.name,
        'A licença ' || NEW.name || ' será renovada em ' || (NEW.renewal_date - CURRENT_DATE) || ' dias',
        'subscription',
        NEW.id,
        'active'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Fix check_subscription_utilization_alerts
CREATE OR REPLACE FUNCTION public.check_subscription_utilization_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check underutilization (less than 50% seats used)
  IF NEW.total_seats > 0 AND NEW.used_seats::float / NEW.total_seats < 0.5 THEN
    IF NOT EXISTS (
      SELECT 1 FROM financial_alerts 
      WHERE workspace_id = NEW.workspace_id 
        AND entity_type = 'subscription'
        AND entity_id = NEW.id
        AND alert_type = 'low_utilization'
        AND status = 'active'
    ) THEN
      INSERT INTO financial_alerts (
        workspace_id, alert_type, severity, title, message,
        entity_type, entity_id, status
      ) VALUES (
        NEW.workspace_id,
        'low_utilization',
        'medium',
        'Subutilização: ' || NEW.name,
        'A licença ' || NEW.name || ' está com baixa utilização (' || NEW.used_seats || '/' || NEW.total_seats || ' assentos)',
        'subscription',
        NEW.id,
        'active'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Fix check_warranty_alerts  
CREATE OR REPLACE FUNCTION public.check_warranty_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if warranty is expiring in next 30 days
  IF NEW.warranty_end_date IS NOT NULL AND NEW.warranty_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    IF NOT EXISTS (
      SELECT 1 FROM financial_alerts 
      WHERE workspace_id = NEW.workspace_id 
        AND entity_type = 'inventory_item'
        AND entity_id = NEW.id
        AND alert_type = 'warranty_expiring'
        AND status = 'active'
    ) THEN
      INSERT INTO financial_alerts (
        workspace_id, alert_type, severity, title, message,
        entity_type, entity_id, status
      ) VALUES (
        NEW.workspace_id,
        'warranty_expiring',
        CASE 
          WHEN NEW.warranty_end_date <= CURRENT_DATE THEN 'critical'
          WHEN NEW.warranty_end_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'high'
          ELSE 'medium'
        END,
        'Garantia expirando: ' || NEW.name,
        'A garantia do item ' || NEW.name || ' expira em ' || (NEW.warranty_end_date - CURRENT_DATE) || ' dias',
        'inventory_item',
        NEW.id,
        'active'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;