
-- Fix security warnings: Set search_path for functions
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'IN' THEN
    UPDATE public.inventory_items SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'OUT' THEN
    UPDATE public.inventory_items SET current_stock = current_stock - NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'RETURN' THEN
    UPDATE public.inventory_items SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'ADJUST' THEN
    UPDATE public.inventory_items SET current_stock = NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  END IF;
  
  IF NEW.unit_id IS NOT NULL THEN
    IF NEW.movement_type = 'OUT' THEN
      UPDATE public.inventory_units SET current_status = 'checked_out', current_holder_id = NEW.responsible_user_id, updated_at = now() WHERE id = NEW.unit_id;
    ELSIF NEW.movement_type IN ('RETURN', 'IN') THEN
      UPDATE public.inventory_units SET current_status = 'in_stock', current_holder_id = NULL, updated_at = now() WHERE id = NEW.unit_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_depreciation(p_workspace_id UUID, p_month DATE)
RETURNS INTEGER AS $$
DECLARE
  item_record RECORD;
  depreciable_base NUMERIC;
  monthly_depreciation NUMERIC;
  accumulated NUMERIC;
  book_value NUMERIC;
  records_created INTEGER := 0;
BEGIN
  FOR item_record IN
    SELECT i.*, 
           COALESCE((SELECT SUM(accumulated_depreciation) FROM public.depreciation_schedules WHERE item_id = i.id), 0) as current_accumulated
    FROM public.inventory_items i
    WHERE i.workspace_id = p_workspace_id
      AND i.is_active = true
      AND (i.category = 'asset' OR (i.category = 'equipment' AND i.purchase_value >= i.capitalization_threshold))
      AND i.purchase_date IS NOT NULL
      AND i.purchase_date <= p_month
  LOOP
    depreciable_base := item_record.purchase_value - item_record.residual_value;
    monthly_depreciation := CASE 
      WHEN item_record.useful_life_months > 0 THEN depreciable_base / item_record.useful_life_months
      ELSE 0
    END;
    
    accumulated := item_record.current_accumulated + monthly_depreciation;
    
    IF accumulated > depreciable_base THEN
      monthly_depreciation := GREATEST(0, depreciable_base - item_record.current_accumulated);
      accumulated := depreciable_base;
    END IF;
    
    book_value := item_record.purchase_value - accumulated;
    
    IF monthly_depreciation > 0 THEN
      INSERT INTO public.depreciation_schedules (workspace_id, item_id, month_ref, depreciation_amount, accumulated_depreciation, book_value)
      VALUES (p_workspace_id, item_record.id, p_month, monthly_depreciation, accumulated, book_value)
      ON CONFLICT (workspace_id, item_id, month_ref) DO NOTHING;
      
      records_created := records_created + 1;
    END IF;
  END LOOP;
  
  RETURN records_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
