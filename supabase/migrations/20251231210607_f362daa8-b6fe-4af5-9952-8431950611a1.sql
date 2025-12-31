
-- ============================================================
-- SPRINT 3: FUNÇÕES E TRIGGERS
-- ============================================================

-- 1. Função para verificar garantias vencendo/vencidas
CREATE OR REPLACE FUNCTION check_warranty_alerts()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id UUID;
  v_days_until_expiry INTEGER;
  v_item_name TEXT;
  v_alert_type TEXT;
  v_alert_level TEXT;
BEGIN
  -- Get workspace_id from unit
  v_workspace_id := NEW.workspace_id;
  
  -- Get item name
  SELECT ii.name INTO v_item_name
  FROM inventory_items ii
  WHERE ii.id = NEW.item_id;

  -- Only check if warranty_end_date is set
  IF NEW.warranty_end_date IS NOT NULL THEN
    v_days_until_expiry := (NEW.warranty_end_date - CURRENT_DATE);
    
    -- Delete existing warranty alerts for this unit
    DELETE FROM financial_alerts 
    WHERE entity_type = 'inventory_unit' 
      AND entity_id = NEW.id::text 
      AND alert_type IN ('warranty_expiring_30', 'warranty_expiring_15', 'warranty_expiring_7', 'warranty_expired');
    
    -- Determine alert type based on days
    IF v_days_until_expiry <= 0 THEN
      v_alert_type := 'warranty_expired';
      v_alert_level := 'critical';
    ELSIF v_days_until_expiry <= 7 THEN
      v_alert_type := 'warranty_expiring_7';
      v_alert_level := 'critical';
    ELSIF v_days_until_expiry <= 15 THEN
      v_alert_type := 'warranty_expiring_15';
      v_alert_level := 'warning';
    ELSIF v_days_until_expiry <= 30 THEN
      v_alert_type := 'warranty_expiring_30';
      v_alert_level := 'info';
    ELSE
      v_alert_type := NULL;
    END IF;
    
    -- Create alert if needed
    IF v_alert_type IS NOT NULL THEN
      INSERT INTO financial_alerts (
        workspace_id,
        alert_type,
        alert_level,
        entity_type,
        entity_id,
        title,
        message,
        metadata
      ) VALUES (
        v_workspace_id,
        v_alert_type,
        v_alert_level,
        'inventory_unit',
        NEW.id::text,
        CASE 
          WHEN v_alert_type = 'warranty_expired' THEN 'Garantia Vencida'
          ELSE 'Garantia Vencendo'
        END,
        CASE 
          WHEN v_alert_type = 'warranty_expired' THEN 
            format('Garantia do equipamento %s (S/N: %s) venceu em %s', v_item_name, COALESCE(NEW.serial_number, 'N/A'), NEW.warranty_end_date)
          ELSE 
            format('Garantia do equipamento %s (S/N: %s) vence em %s dias (%s)', v_item_name, COALESCE(NEW.serial_number, 'N/A'), v_days_until_expiry, NEW.warranty_end_date)
        END,
        jsonb_build_object(
          'item_id', NEW.item_id,
          'unit_id', NEW.id,
          'serial_number', NEW.serial_number,
          'warranty_end_date', NEW.warranty_end_date,
          'days_until_expiry', v_days_until_expiry
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para verificar garantias ao inserir/atualizar unidade
DROP TRIGGER IF EXISTS check_warranty_alerts_trigger ON inventory_units;
CREATE TRIGGER check_warranty_alerts_trigger
  AFTER INSERT OR UPDATE OF warranty_end_date ON inventory_units
  FOR EACH ROW
  EXECUTE FUNCTION check_warranty_alerts();

-- 2. Função para criar lançamento financeiro quando manutenção é concluída com custo
CREATE OR REPLACE FUNCTION maintenance_to_financial()
RETURNS TRIGGER AS $$
DECLARE
  v_item_name TEXT;
  v_unit_serial TEXT;
BEGIN
  -- Only create transaction if cost > 0 and status changed to completed
  IF NEW.cost > 0 AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get item and unit info
    SELECT ii.name INTO v_item_name
    FROM inventory_items ii
    WHERE ii.id = NEW.item_id;
    
    IF NEW.unit_id IS NOT NULL THEN
      SELECT iu.serial_number INTO v_unit_serial
      FROM inventory_units iu
      WHERE iu.id = NEW.unit_id;
    END IF;
    
    -- Create expense transaction
    INSERT INTO transactions (
      workspace_id,
      type,
      category,
      amount,
      description,
      date,
      status,
      metadata
    ) VALUES (
      NEW.workspace_id,
      'expense',
      'Manutenção de Equipamentos',
      NEW.cost,
      format('Manutenção: %s - %s (S/N: %s)', COALESCE(NEW.maintenance_type, 'Geral'), v_item_name, COALESCE(v_unit_serial, 'N/A')),
      COALESCE(NEW.completed_date, CURRENT_DATE),
      'completed',
      jsonb_build_object(
        'maintenance_id', NEW.id,
        'item_id', NEW.item_id,
        'unit_id', NEW.unit_id,
        'maintenance_type', NEW.maintenance_type,
        'source', 'maintenance_record'
      )
    );
    
    -- Emit domain event
    PERFORM emit_domain_event(
      NEW.workspace_id,
      'maintenance',
      NEW.id,
      'MaintenanceCostRecorded',
      jsonb_build_object(
        'maintenance_id', NEW.id,
        'item_name', v_item_name,
        'cost', NEW.cost,
        'maintenance_type', NEW.maintenance_type
      ),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para manutenção → financeiro
DROP TRIGGER IF EXISTS maintenance_to_financial_trigger ON maintenance_records;
CREATE TRIGGER maintenance_to_financial_trigger
  AFTER UPDATE OF status ON maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION maintenance_to_financial();

-- 3. Função para atualizar status da unidade após manutenção
CREATE OR REPLACE FUNCTION update_unit_after_maintenance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    -- When maintenance starts (in_progress), set unit to maintenance status
    IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status = 'scheduled') THEN
      UPDATE inventory_units 
      SET current_status = 'maintenance',
          item_condition = 'needs_repair'
      WHERE id = NEW.unit_id;
    
    -- When maintenance completes, restore unit status
    ELSIF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
      UPDATE inventory_units 
      SET current_status = 'in_stock',
          item_condition = 'good'
      WHERE id = NEW.unit_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar unidade após manutenção
DROP TRIGGER IF EXISTS update_unit_after_maintenance_trigger ON maintenance_records;
CREATE TRIGGER update_unit_after_maintenance_trigger
  AFTER UPDATE OF status ON maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_unit_after_maintenance();

-- 4. Job para verificar todas as garantias (chamado periodicamente)
CREATE OR REPLACE FUNCTION run_warranty_check_job()
RETURNS void AS $$
DECLARE
  v_unit RECORD;
BEGIN
  FOR v_unit IN 
    SELECT id FROM inventory_units WHERE warranty_end_date IS NOT NULL
  LOOP
    UPDATE inventory_units SET updated_at = NOW() WHERE id = v_unit.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. View consolidada de garantias
CREATE OR REPLACE VIEW warranty_status_view AS
SELECT 
  iu.id as unit_id,
  iu.serial_number,
  iu.warranty_start_date,
  iu.warranty_end_date,
  iu.warranty_provider,
  ii.id as item_id,
  ii.name as item_name,
  iu.workspace_id,
  iu.current_status,
  iu.item_condition,
  (iu.warranty_end_date - CURRENT_DATE) as days_until_expiry,
  CASE 
    WHEN iu.warranty_end_date IS NULL THEN 'no_warranty'
    WHEN (iu.warranty_end_date - CURRENT_DATE) <= 0 THEN 'expired'
    WHEN (iu.warranty_end_date - CURRENT_DATE) <= 7 THEN 'critical'
    WHEN (iu.warranty_end_date - CURRENT_DATE) <= 15 THEN 'warning'
    WHEN (iu.warranty_end_date - CURRENT_DATE) <= 30 THEN 'attention'
    ELSE 'ok'
  END as warranty_status
FROM inventory_units iu
JOIN inventory_items ii ON ii.id = iu.item_id;

-- 6. View de manutenções com custo
CREATE OR REPLACE VIEW maintenance_costs_view AS
SELECT 
  mr.id,
  mr.workspace_id,
  mr.item_id,
  mr.unit_id,
  ii.name as item_name,
  iu.serial_number,
  mr.maintenance_type,
  mr.problem_description,
  mr.solution_description,
  mr.cost,
  mr.status,
  mr.is_resolved,
  mr.is_warranty_claim,
  mr.scheduled_date,
  mr.completed_date,
  mr.performed_by,
  mr.vendor,
  mr.created_at,
  EXTRACT(MONTH FROM COALESCE(mr.completed_date, mr.scheduled_date)) as month,
  EXTRACT(YEAR FROM COALESCE(mr.completed_date, mr.scheduled_date)) as year
FROM maintenance_records mr
JOIN inventory_items ii ON ii.id = mr.item_id
LEFT JOIN inventory_units iu ON iu.id = mr.unit_id;
