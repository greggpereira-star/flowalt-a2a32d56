
-- ============================================================
-- SPRINT 5: LICENÇAS & ASSINATURAS SaaS
-- ============================================================

-- 1. Função para verificar alertas de renovação
CREATE OR REPLACE FUNCTION check_subscription_renewal_alerts()
RETURNS TRIGGER AS $$
DECLARE
  v_days_until_renewal INTEGER;
  v_alert_type TEXT;
  v_alert_level TEXT;
BEGIN
  -- Only for active subscriptions
  IF NEW.status NOT IN ('active', 'expiring') OR NEW.is_active = false THEN
    -- Remove existing alerts
    DELETE FROM public.financial_alerts 
    WHERE entity_type = 'subscription' AND entity_id = NEW.id::text 
      AND alert_type IN ('subscription_renewal_30', 'subscription_renewal_15', 'subscription_renewal_7', 'subscription_expired');
    RETURN NEW;
  END IF;

  v_days_until_renewal := (NEW.renewal_date - CURRENT_DATE);
  
  -- Delete existing renewal alerts
  DELETE FROM public.financial_alerts 
  WHERE entity_type = 'subscription' AND entity_id = NEW.id::text 
    AND alert_type IN ('subscription_renewal_30', 'subscription_renewal_15', 'subscription_renewal_7', 'subscription_expired');
  
  -- Determine alert
  IF v_days_until_renewal <= 0 THEN
    v_alert_type := 'subscription_expired';
    v_alert_level := 'critical';
  ELSIF v_days_until_renewal <= 7 THEN
    v_alert_type := 'subscription_renewal_7';
    v_alert_level := 'critical';
  ELSIF v_days_until_renewal <= 15 THEN
    v_alert_type := 'subscription_renewal_15';
    v_alert_level := 'warning';
  ELSIF v_days_until_renewal <= 30 THEN
    v_alert_type := 'subscription_renewal_30';
    v_alert_level := 'info';
  ELSE
    v_alert_type := NULL;
  END IF;
  
  IF v_alert_type IS NOT NULL THEN
    INSERT INTO public.financial_alerts (
      workspace_id, alert_type, alert_level, entity_type, entity_id, title, message, metadata
    ) VALUES (
      NEW.workspace_id, v_alert_type, v_alert_level, 'subscription', NEW.id::text,
      CASE WHEN v_alert_type = 'subscription_expired' THEN 'Licença Vencida' ELSE 'Renovação Próxima' END,
      CASE 
        WHEN v_alert_type = 'subscription_expired' THEN 
          format('%s (%s) venceu em %s', NEW.product_name, NEW.vendor, NEW.renewal_date)
        ELSE 
          format('%s (%s) renova em %s dias - R$ %s/%s', NEW.product_name, NEW.vendor, v_days_until_renewal, NEW.cost_per_cycle, NEW.billing_cycle)
      END,
      jsonb_build_object(
        'subscription_id', NEW.id,
        'vendor', NEW.vendor,
        'product_name', NEW.product_name,
        'cost_per_cycle', NEW.cost_per_cycle,
        'billing_cycle', NEW.billing_cycle,
        'renewal_date', NEW.renewal_date,
        'days_until_renewal', v_days_until_renewal,
        'auto_renew', NEW.auto_renew
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Função para verificar subutilização de seats
CREATE OR REPLACE FUNCTION check_subscription_utilization_alerts()
RETURNS TRIGGER AS $$
DECLARE
  v_utilization NUMERIC;
BEGIN
  -- Only check if seats are configured
  IF NEW.seats_total IS NULL OR NEW.seats_total = 0 OR NEW.status != 'active' THEN
    DELETE FROM public.financial_alerts 
    WHERE entity_type = 'subscription' AND entity_id = NEW.id::text AND alert_type = 'subscription_underutilized';
    RETURN NEW;
  END IF;

  v_utilization := COALESCE(NEW.seats_used, 0)::numeric / NEW.seats_total::numeric;
  
  -- Delete existing underutilization alert
  DELETE FROM public.financial_alerts 
  WHERE entity_type = 'subscription' AND entity_id = NEW.id::text AND alert_type = 'subscription_underutilized';
  
  -- Create alert if utilization < 50%
  IF v_utilization < 0.5 THEN
    INSERT INTO public.financial_alerts (
      workspace_id, alert_type, alert_level, entity_type, entity_id, title, message, metadata
    ) VALUES (
      NEW.workspace_id, 'subscription_underutilized', 'warning', 'subscription', NEW.id::text,
      'Licença Subutilizada',
      format('%s: usando %s de %s licenças (%s%%). Considere downgrade.', 
        NEW.product_name, COALESCE(NEW.seats_used, 0), NEW.seats_total, ROUND(v_utilization * 100)),
      jsonb_build_object(
        'subscription_id', NEW.id,
        'vendor', NEW.vendor,
        'product_name', NEW.product_name,
        'seats_total', NEW.seats_total,
        'seats_used', NEW.seats_used,
        'utilization_percent', ROUND(v_utilization * 100),
        'monthly_cost', CASE WHEN NEW.billing_cycle = 'monthly' THEN NEW.cost_per_cycle ELSE NEW.cost_per_cycle / 12 END,
        'potential_savings', ROUND((NEW.cost_per_cycle * (1 - v_utilization))::numeric, 2)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Triggers
DROP TRIGGER IF EXISTS check_subscription_renewal_trigger ON subscription_licenses;
CREATE TRIGGER check_subscription_renewal_trigger
  AFTER INSERT OR UPDATE OF renewal_date, status, is_active ON subscription_licenses
  FOR EACH ROW EXECUTE FUNCTION check_subscription_renewal_alerts();

DROP TRIGGER IF EXISTS check_subscription_utilization_trigger ON subscription_licenses;
CREATE TRIGGER check_subscription_utilization_trigger
  AFTER INSERT OR UPDATE OF seats_total, seats_used, status ON subscription_licenses
  FOR EACH ROW EXECUTE FUNCTION check_subscription_utilization_alerts();

-- 4. Job para verificar todas as assinaturas
CREATE OR REPLACE FUNCTION run_subscription_check_job()
RETURNS void AS $$
BEGIN
  UPDATE public.subscription_licenses SET updated_at = NOW() WHERE is_active = true AND status IN ('active', 'expiring');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. View de status de licenças
CREATE OR REPLACE VIEW subscription_status_view 
WITH (security_invoker = true) AS
SELECT 
  sl.id,
  sl.workspace_id,
  sl.vendor,
  sl.product_name,
  sl.plan_name,
  sl.billing_cycle,
  sl.renewal_date,
  sl.auto_renew,
  sl.seats_total,
  sl.seats_used,
  sl.cost_per_cycle,
  sl.status,
  sl.is_active,
  (sl.renewal_date - CURRENT_DATE) as days_until_renewal,
  CASE 
    WHEN sl.seats_total IS NULL OR sl.seats_total = 0 THEN NULL
    ELSE ROUND((COALESCE(sl.seats_used, 0)::numeric / sl.seats_total::numeric) * 100, 1)
  END as utilization_percent,
  CASE 
    WHEN sl.billing_cycle = 'monthly' THEN sl.cost_per_cycle
    WHEN sl.billing_cycle = 'yearly' THEN sl.cost_per_cycle / 12
    ELSE sl.cost_per_cycle
  END as monthly_cost,
  CASE 
    WHEN (sl.renewal_date - CURRENT_DATE) <= 0 THEN 'expired'
    WHEN (sl.renewal_date - CURRENT_DATE) <= 7 THEN 'critical'
    WHEN (sl.renewal_date - CURRENT_DATE) <= 15 THEN 'warning'
    WHEN (sl.renewal_date - CURRENT_DATE) <= 30 THEN 'attention'
    ELSE 'ok'
  END as renewal_status
FROM subscription_licenses sl
WHERE sl.is_active = true;

-- 6. View de custos consolidados
CREATE OR REPLACE VIEW subscription_costs_summary_view 
WITH (security_invoker = true) AS
SELECT 
  workspace_id,
  COUNT(*) as total_subscriptions,
  SUM(CASE WHEN billing_cycle = 'monthly' THEN cost_per_cycle ELSE cost_per_cycle / 12 END) as total_monthly_cost,
  SUM(CASE WHEN billing_cycle = 'yearly' THEN cost_per_cycle ELSE cost_per_cycle * 12 END) as total_yearly_cost,
  SUM(seats_total) as total_seats,
  SUM(seats_used) as total_seats_used,
  COUNT(*) FILTER (WHERE (renewal_date - CURRENT_DATE) <= 30) as expiring_soon_count
FROM subscription_licenses
WHERE is_active = true AND status = 'active'
GROUP BY workspace_id;

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscription_licenses(renewal_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscription_licenses(status, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_subscription ON financial_alerts(alert_type) WHERE alert_type LIKE 'subscription%';
