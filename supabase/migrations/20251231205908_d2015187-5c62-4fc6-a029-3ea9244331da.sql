-- ============================================================
-- SPRINT 2: ALMOXARIFADO OPERACIONAL - VALIDAÇÕES E ALERTAS
-- ============================================================

-- 1. Função para validar disponibilidade antes de check-out
CREATE OR REPLACE FUNCTION public.validate_checkout_availability(
  p_item_id uuid,
  p_unit_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item inventory_items%ROWTYPE;
  v_unit inventory_units%ROWTYPE;
  v_available_stock integer;
  v_result jsonb;
BEGIN
  -- Get item info
  SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'ITEM_NOT_FOUND',
      'message', 'Item não encontrado'
    );
  END IF;

  -- For serialized items, check unit availability
  IF v_item.is_serialized AND p_unit_id IS NOT NULL THEN
    SELECT * INTO v_unit FROM inventory_units WHERE id = p_unit_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'UNIT_NOT_FOUND',
        'message', 'Unidade não encontrada'
      );
    END IF;
    
    IF v_unit.current_status != 'in_stock' THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'UNIT_NOT_AVAILABLE',
        'message', 'Unidade não está disponível. Status atual: ' || v_unit.current_status,
        'current_status', v_unit.current_status
      );
    END IF;
    
    -- Check if unit is in maintenance
    IF EXISTS (
      SELECT 1 FROM maintenance_records 
      WHERE (item_id = p_item_id OR unit_id = p_unit_id)
        AND is_resolved = false
    ) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'UNIT_IN_MAINTENANCE',
        'message', 'Unidade está em manutenção pendente'
      );
    END IF;
    
    RETURN jsonb_build_object(
      'valid', true,
      'item_name', v_item.name,
      'unit_serial', v_unit.serial_number,
      'message', 'Unidade disponível para retirada'
    );
    
  ELSE
    -- For non-serialized items, check stock quantity
    v_available_stock := COALESCE(v_item.current_stock, 0);
    
    IF v_available_stock < p_quantity THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'INSUFFICIENT_STOCK',
        'message', 'Estoque insuficiente. Disponível: ' || v_available_stock || ', Solicitado: ' || p_quantity,
        'available', v_available_stock,
        'requested', p_quantity
      );
    END IF;
    
    -- Warning if it will leave stock below minimum
    IF v_item.min_stock IS NOT NULL AND (v_available_stock - p_quantity) < v_item.min_stock THEN
      RETURN jsonb_build_object(
        'valid', true,
        'warning', 'LOW_STOCK_WARNING',
        'message', 'Atenção: Após esta retirada, o estoque ficará abaixo do mínimo',
        'available', v_available_stock,
        'after_checkout', v_available_stock - p_quantity,
        'min_stock', v_item.min_stock
      );
    END IF;
    
    RETURN jsonb_build_object(
      'valid', true,
      'item_name', v_item.name,
      'available', v_available_stock,
      'after_checkout', v_available_stock - p_quantity,
      'message', 'Estoque disponível para retirada'
    );
  END IF;
END;
$$;

-- 2. Trigger para gerar alertas automáticos de estoque baixo
CREATE OR REPLACE FUNCTION public.check_stock_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item inventory_items%ROWTYPE;
  v_alert_exists boolean;
BEGIN
  -- Get updated item
  SELECT * INTO v_item FROM inventory_items WHERE id = NEW.item_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Check if item is consumable with min_stock defined
  IF v_item.category = 'consumable' AND v_item.min_stock IS NOT NULL THEN
    
    -- Out of stock alert
    IF v_item.current_stock = 0 THEN
      -- Check if alert already exists
      SELECT EXISTS(
        SELECT 1 FROM financial_alerts 
        WHERE workspace_id = v_item.workspace_id 
          AND entity_type = 'inventory_item'
          AND entity_id = v_item.id::text
          AND alert_type = 'out_of_stock'
          AND status = 'active'
      ) INTO v_alert_exists;
      
      IF NOT v_alert_exists THEN
        INSERT INTO financial_alerts (
          workspace_id, alert_type, alert_category, severity, title, message,
          entity_type, entity_id, status, suggested_actions
        ) VALUES (
          v_item.workspace_id,
          'out_of_stock',
          'inventory',
          'critical',
          'Estoque Zerado: ' || v_item.name,
          'O item "' || v_item.code || ' - ' || v_item.name || '" está sem estoque.',
          'inventory_item',
          v_item.id::text,
          'active',
          jsonb_build_object(
            'actions', ARRAY['Fazer pedido de reposição', 'Verificar fornecedores', 'Atualizar previsão de entrega']
          )
        );
      END IF;
      
    -- Low stock alert
    ELSIF v_item.current_stock < v_item.min_stock THEN
      SELECT EXISTS(
        SELECT 1 FROM financial_alerts 
        WHERE workspace_id = v_item.workspace_id 
          AND entity_type = 'inventory_item'
          AND entity_id = v_item.id::text
          AND alert_type = 'low_stock'
          AND status = 'active'
      ) INTO v_alert_exists;
      
      IF NOT v_alert_exists THEN
        INSERT INTO financial_alerts (
          workspace_id, alert_type, alert_category, severity, title, message,
          entity_type, entity_id, status, data, suggested_actions
        ) VALUES (
          v_item.workspace_id,
          'low_stock',
          'inventory',
          'high',
          'Estoque Baixo: ' || v_item.name,
          'O item "' || v_item.code || ' - ' || v_item.name || '" está abaixo do estoque mínimo. Atual: ' || v_item.current_stock || ', Mínimo: ' || v_item.min_stock,
          'inventory_item',
          v_item.id::text,
          'active',
          jsonb_build_object('current_stock', v_item.current_stock, 'min_stock', v_item.min_stock),
          jsonb_build_object(
            'actions', ARRAY['Programar reposição', 'Verificar consumo médio']
          )
        );
      END IF;
      
    -- If stock is back above minimum, resolve existing alerts
    ELSE
      UPDATE financial_alerts
      SET status = 'resolved',
          resolved_at = now()
      WHERE workspace_id = v_item.workspace_id
        AND entity_type = 'inventory_item'
        AND entity_id = v_item.id::text
        AND alert_type IN ('low_stock', 'out_of_stock')
        AND status = 'active';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on inventory_movements to check stock after each movement
DROP TRIGGER IF EXISTS trg_check_stock_alerts ON inventory_movements;
CREATE TRIGGER trg_check_stock_alerts
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION check_stock_alerts();

-- 3. View para histórico de movimentações por item
CREATE OR REPLACE VIEW public.inventory_movement_history 
WITH (security_invoker = true)
AS
SELECT 
  m.id,
  m.workspace_id,
  m.movement_type,
  m.item_id,
  i.code as item_code,
  i.name as item_name,
  m.unit_id,
  u.serial_number,
  m.quantity,
  m.card_id,
  c.title as card_title,
  m.department_id,
  cc.name as department_name,
  m.occurred_at,
  m.notes,
  m.created_at,
  CASE m.movement_type
    WHEN 'IN' THEN m.quantity
    WHEN 'OUT' THEN -m.quantity
    WHEN 'RETURN' THEN m.quantity
    WHEN 'ADJUST' THEN m.quantity
    ELSE 0
  END as stock_delta
FROM inventory_movements m
LEFT JOIN inventory_items i ON i.id = m.item_id
LEFT JOIN inventory_units u ON u.id = m.unit_id
LEFT JOIN cards c ON c.id = m.card_id
LEFT JOIN cost_centers cc ON cc.id = m.department_id;

-- 4. Função para obter timeline de movimentações de um item
CREATE OR REPLACE FUNCTION public.get_item_movement_timeline(
  p_item_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  movement_type text,
  quantity integer,
  stock_delta integer,
  serial_number text,
  card_title text,
  department_name text,
  notes text,
  occurred_at timestamptz,
  running_balance integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH movements AS (
    SELECT 
      m.id,
      m.movement_type::text,
      m.quantity,
      CASE m.movement_type
        WHEN 'IN' THEN m.quantity
        WHEN 'OUT' THEN -m.quantity
        WHEN 'RETURN' THEN m.quantity
        WHEN 'ADJUST' THEN m.quantity
        ELSE 0
      END as stock_delta,
      u.serial_number,
      c.title as card_title,
      cc.name as department_name,
      m.notes,
      m.occurred_at
    FROM inventory_movements m
    LEFT JOIN inventory_units u ON u.id = m.unit_id
    LEFT JOIN cards c ON c.id = m.card_id
    LEFT JOIN cost_centers cc ON cc.id = m.department_id
    WHERE m.item_id = p_item_id
    ORDER BY m.occurred_at DESC
    LIMIT p_limit
  )
  SELECT 
    movements.*,
    SUM(stock_delta) OVER (ORDER BY occurred_at ASC) as running_balance
  FROM movements
  ORDER BY occurred_at DESC;
$$;

-- 5. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_financial_alerts_entity ON financial_alerts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_occurred ON inventory_movements(item_id, occurred_at DESC);