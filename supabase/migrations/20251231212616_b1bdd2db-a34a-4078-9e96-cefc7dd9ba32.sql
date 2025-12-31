
-- ============================================================
-- SPRINT 6: INTEGRAÇÃO COM CARDS (Corrigido)
-- ============================================================

-- 1. View de histórico financeiro por card (sem UNION para evitar type mismatch)
CREATE OR REPLACE VIEW card_financial_history_view 
WITH (security_invoker = true) AS
SELECT 
  t.card_id,
  t.workspace_id,
  t.id as entry_id,
  t.type::text as entry_type,
  t.amount,
  t.description,
  t.due_date as entry_date,
  t.status::text as entry_status,
  t.metadata,
  t.created_at,
  'transaction' as source_type
FROM transactions t
WHERE t.card_id IS NOT NULL;

-- 2. View separada para movimentos por card
CREATE OR REPLACE VIEW card_movements_history_view 
WITH (security_invoker = true) AS
SELECT 
  im.card_id,
  im.workspace_id,
  im.id as entry_id,
  im.movement_type as entry_type,
  COALESCE(ii.purchase_value, 0) * im.quantity as estimated_value,
  ii.name as item_name,
  im.quantity,
  im.occurred_at as entry_date,
  im.notes,
  im.created_at
FROM inventory_movements im
JOIN inventory_items ii ON ii.id = im.item_id
WHERE im.card_id IS NOT NULL;

-- 3. Função para calcular custo total do kit
CREATE OR REPLACE FUNCTION calculate_card_kit_cost(p_card_id UUID)
RETURNS TABLE(total_cost NUMERIC, items_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(COALESCE(ii.purchase_value, 0) * COALESCE(ck.quantity_required, 1)), 0) as total_cost,
    COUNT(*)::integer as items_count
  FROM public.card_kits ck
  JOIN public.inventory_items ii ON ii.id = ck.item_id
  WHERE ck.card_id = p_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Função para resumo financeiro do card
CREATE OR REPLACE FUNCTION get_card_financial_summary(p_card_id UUID)
RETURNS TABLE(
  total_income NUMERIC,
  total_expenses NUMERIC,
  kit_estimated_cost NUMERIC,
  movements_count INTEGER,
  transactions_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE card_id = p_card_id AND type = 'income'), 0) as total_income,
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE card_id = p_card_id AND type = 'expense'), 0) as total_expenses,
    COALESCE((SELECT SUM(COALESCE(ii.purchase_value, 0) * COALESCE(ck.quantity_required, 1)) 
              FROM public.card_kits ck JOIN public.inventory_items ii ON ii.id = ck.item_id 
              WHERE ck.card_id = p_card_id), 0) as kit_estimated_cost,
    (SELECT COUNT(*)::integer FROM public.inventory_movements WHERE card_id = p_card_id) as movements_count,
    (SELECT COUNT(*)::integer FROM public.transactions WHERE card_id = p_card_id) as transactions_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_card_kits_card ON card_kits(card_id);
CREATE INDEX IF NOT EXISTS idx_card_kits_status ON card_kits(status);
CREATE INDEX IF NOT EXISTS idx_transactions_card ON transactions(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movements_card ON inventory_movements(card_id) WHERE card_id IS NOT NULL;
