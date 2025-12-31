-- ============================================================
-- SPRINT 1: FUNDAÇÃO FINANCEIRA & DOMÍNIO - ARQUITETURA EDA
-- ============================================================

-- 1. Índices adicionais para domain_events (performance)
CREATE INDEX IF NOT EXISTS idx_domain_events_workspace ON domain_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events(event_type);
CREATE INDEX IF NOT EXISTS idx_domain_events_unprocessed ON domain_events(workspace_id, is_processed) WHERE is_processed = false;
CREATE INDEX IF NOT EXISTS idx_domain_events_correlation ON domain_events(correlation_id) WHERE correlation_id IS NOT NULL;

-- 2. Função para registrar eventos de domínio
CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_workspace_id uuid,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_payload jsonb,
  p_correlation_id uuid DEFAULT NULL,
  p_causation_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_version integer;
BEGIN
  -- Get next version for this aggregate
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM domain_events
  WHERE aggregate_type = p_aggregate_type AND aggregate_id = p_aggregate_id;

  -- Insert the event
  INSERT INTO domain_events (
    workspace_id,
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    metadata,
    correlation_id,
    causation_id,
    version,
    is_processed
  ) VALUES (
    p_workspace_id,
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    p_payload,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('emitted_at', now(), 'user_id', auth.uid()),
    p_correlation_id,
    p_causation_id,
    v_version,
    false
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 3. Trigger para auditoria automática de inventory_items
CREATE OR REPLACE FUNCTION public.audit_inventory_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'InventoryItemCreated';
    v_payload := to_jsonb(NEW);
    
    PERFORM emit_domain_event(
      NEW.workspace_id,
      v_event_type,
      'InventoryItem',
      NEW.id,
      v_payload
    );
    
    -- Also log to audit
    INSERT INTO financial_audit_trail (
      workspace_id, user_id, entity_type, entity_id, action, new_data
    ) VALUES (
      NEW.workspace_id,
      COALESCE(NEW.created_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'inventory_item',
      NEW.id::text,
      'create',
      to_jsonb(NEW)
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'InventoryItemUpdated';
    v_payload := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW),
      'changes', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
        FROM (
          SELECT key, OLD_t.value as old_val, NEW_t.value as new_val
          FROM jsonb_each(to_jsonb(OLD)) as OLD_t(key, value)
          FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) as NEW_t(key, value) USING (key)
          WHERE OLD_t.value IS DISTINCT FROM NEW_t.value
            AND key NOT IN ('updated_at', 'created_at')
        ) diff
      )
    );
    
    PERFORM emit_domain_event(
      NEW.workspace_id,
      v_event_type,
      'InventoryItem',
      NEW.id,
      v_payload
    );
    
    INSERT INTO financial_audit_trail (
      workspace_id, user_id, entity_type, entity_id, action, old_data, new_data, changes
    ) VALUES (
      NEW.workspace_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'inventory_item',
      NEW.id::text,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_payload->'changes'
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'InventoryItemDeleted';
    v_payload := to_jsonb(OLD);
    
    PERFORM emit_domain_event(
      OLD.workspace_id,
      v_event_type,
      'InventoryItem',
      OLD.id,
      v_payload
    );
    
    INSERT INTO financial_audit_trail (
      workspace_id, user_id, entity_type, entity_id, action, old_data
    ) VALUES (
      OLD.workspace_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'inventory_item',
      OLD.id::text,
      'delete',
      to_jsonb(OLD)
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_inventory_items ON inventory_items;
CREATE TRIGGER trg_audit_inventory_items
AFTER INSERT OR UPDATE OR DELETE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION audit_inventory_item_changes();

-- 4. Trigger para auditoria de inventory_movements
CREATE OR REPLACE FUNCTION public.audit_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM emit_domain_event(
    NEW.workspace_id,
    'InventoryMovementCreated',
    'InventoryMovement',
    NEW.id,
    jsonb_build_object(
      'movement_type', NEW.movement_type,
      'item_id', NEW.item_id,
      'unit_id', NEW.unit_id,
      'quantity', NEW.quantity,
      'card_id', NEW.card_id,
      'department_id', NEW.department_id,
      'occurred_at', NEW.occurred_at
    )
  );
  
  INSERT INTO financial_audit_trail (
    workspace_id, user_id, entity_type, entity_id, action, new_data
  ) VALUES (
    NEW.workspace_id,
    COALESCE(NEW.created_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    'inventory_movement',
    NEW.id::text,
    'create',
    to_jsonb(NEW)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_inventory_movements ON inventory_movements;
CREATE TRIGGER trg_audit_inventory_movements
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION audit_inventory_movement();

-- 5. Trigger para atualizar estoque automaticamente
CREATE OR REPLACE FUNCTION public.update_inventory_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity_delta integer;
BEGIN
  -- Determine quantity change based on movement type
  CASE NEW.movement_type
    WHEN 'IN' THEN
      v_quantity_delta := NEW.quantity;
    WHEN 'OUT' THEN
      v_quantity_delta := -NEW.quantity;
    WHEN 'RETURN' THEN
      v_quantity_delta := NEW.quantity;
    WHEN 'ADJUST' THEN
      -- For adjustments, the quantity is the absolute new value difference
      v_quantity_delta := NEW.quantity; -- Can be positive or negative
    WHEN 'TRANSFER' THEN
      -- Transfers don't change total stock
      v_quantity_delta := 0;
    ELSE
      v_quantity_delta := 0;
  END CASE;
  
  -- Update item stock
  UPDATE inventory_items
  SET current_stock = GREATEST(0, current_stock + v_quantity_delta),
      updated_at = now()
  WHERE id = NEW.item_id;
  
  -- Emit stock changed event if quantity changed
  IF v_quantity_delta != 0 THEN
    PERFORM emit_domain_event(
      NEW.workspace_id,
      'InventoryStockChanged',
      'InventoryItem',
      NEW.item_id,
      jsonb_build_object(
        'movement_id', NEW.id,
        'movement_type', NEW.movement_type,
        'quantity_delta', v_quantity_delta,
        'occurred_at', NEW.occurred_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_inventory_stock ON inventory_movements;
CREATE TRIGGER trg_update_inventory_stock
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION update_inventory_stock();

-- 6. Trigger para auditoria de transactions
CREATE OR REPLACE FUNCTION public.audit_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'TransactionCreated';
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'TransactionUpdated';
    -- Special events for status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'paid' THEN
        PERFORM emit_domain_event(
          NEW.workspace_id,
          'TransactionPaid',
          'Transaction',
          NEW.id,
          jsonb_build_object('amount', NEW.amount, 'paid_at', NEW.paid_at)
        );
      ELSIF NEW.status = 'cancelled' THEN
        PERFORM emit_domain_event(
          NEW.workspace_id,
          'TransactionCancelled',
          'Transaction',
          NEW.id,
          jsonb_build_object('amount', NEW.amount)
        );
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'TransactionDeleted';
    
    PERFORM emit_domain_event(
      OLD.workspace_id,
      v_event_type,
      'Transaction',
      OLD.id,
      to_jsonb(OLD)
    );
    
    RETURN OLD;
  END IF;
  
  PERFORM emit_domain_event(
    NEW.workspace_id,
    v_event_type,
    'Transaction',
    NEW.id,
    to_jsonb(NEW)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_transactions ON transactions;
CREATE TRIGGER trg_audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION audit_transaction_changes();

-- 7. Trigger para auditoria de maintenance_records
CREATE OR REPLACE FUNCTION public.audit_maintenance_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'MaintenanceRecordCreated';
    
    PERFORM emit_domain_event(
      NEW.workspace_id,
      v_event_type,
      'MaintenanceRecord',
      NEW.id,
      jsonb_build_object(
        'item_id', NEW.item_id,
        'unit_id', NEW.unit_id,
        'cost', NEW.cost,
        'is_warranty_claim', NEW.is_warranty_claim,
        'service_date', NEW.service_date
      )
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if resolved
    IF OLD.is_resolved = false AND NEW.is_resolved = true THEN
      PERFORM emit_domain_event(
        NEW.workspace_id,
        'MaintenanceRecordResolved',
        'MaintenanceRecord',
        NEW.id,
        jsonb_build_object(
          'item_id', NEW.item_id,
          'unit_id', NEW.unit_id,
          'cost', NEW.cost,
          'solution', NEW.solution_description
        )
      );
    ELSE
      PERFORM emit_domain_event(
        NEW.workspace_id,
        'MaintenanceRecordUpdated',
        'MaintenanceRecord',
        NEW.id,
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_maintenance_records ON maintenance_records;
CREATE TRIGGER trg_audit_maintenance_records
AFTER INSERT OR UPDATE ON maintenance_records
FOR EACH ROW EXECUTE FUNCTION audit_maintenance_record();

-- 8. Trigger para depreciation_schedules
CREATE OR REPLACE FUNCTION public.audit_depreciation_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM emit_domain_event(
    NEW.workspace_id,
    'DepreciationScheduleCreated',
    'DepreciationSchedule',
    NEW.id,
    jsonb_build_object(
      'item_id', NEW.item_id,
      'unit_id', NEW.unit_id,
      'month_ref', NEW.month_ref,
      'depreciation_amount', NEW.depreciation_amount,
      'accumulated_depreciation', NEW.accumulated_depreciation,
      'book_value', NEW.book_value
    )
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_depreciation_schedules ON depreciation_schedules;
CREATE TRIGGER trg_audit_depreciation_schedules
AFTER INSERT ON depreciation_schedules
FOR EACH ROW EXECUTE FUNCTION audit_depreciation_schedule();

-- 9. Função para buscar eventos não processados
CREATE OR REPLACE FUNCTION public.get_unprocessed_events(
  p_workspace_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb,
  metadata jsonb,
  correlation_id uuid,
  version integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, event_type, aggregate_type, aggregate_id, payload, metadata, correlation_id, version, created_at
  FROM domain_events
  WHERE workspace_id = p_workspace_id
    AND is_processed = false
  ORDER BY created_at ASC
  LIMIT p_limit;
$$;

-- 10. Função para marcar eventos como processados
CREATE OR REPLACE FUNCTION public.mark_events_processed(
  p_event_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE domain_events
  SET is_processed = true,
      processed_at = now()
  WHERE id = ANY(p_event_ids);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 11. View para read model de estoque consolidado
CREATE OR REPLACE VIEW public.inventory_stock_summary AS
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

-- 12. View para read model de alertas consolidados
CREATE OR REPLACE VIEW public.financial_alerts_summary AS
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