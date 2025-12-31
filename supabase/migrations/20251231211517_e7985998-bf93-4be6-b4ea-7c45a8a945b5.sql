
-- ============================================================
-- SPRINT 4: DEPRECIAÇÃO & DRE (Final)
-- ============================================================

-- 1. Função para calcular depreciação mensal
CREATE OR REPLACE FUNCTION calculate_monthly_depreciation(p_workspace_id UUID, p_month_ref DATE)
RETURNS TABLE(items_processed INTEGER, total_depreciation NUMERIC, dre_entry_id UUID) AS $$
DECLARE
  v_item RECORD;
  v_monthly_depreciation NUMERIC;
  v_previous_accumulated NUMERIC;
  v_new_accumulated NUMERIC;
  v_book_value NUMERIC;
  v_items_count INTEGER := 0;
  v_total_depreciation NUMERIC := 0;
  v_dre_id UUID;
  v_depreciable_base NUMERIC;
BEGIN
  FOR v_item IN 
    SELECT id, name, purchase_value, residual_value, useful_life_months, department_id
    FROM public.inventory_items
    WHERE workspace_id = p_workspace_id AND category = 'asset' AND useful_life_months > 0 AND purchase_value > 0
  LOOP
    IF EXISTS (SELECT 1 FROM public.depreciation_schedules WHERE item_id = v_item.id AND month_ref = p_month_ref) THEN
      CONTINUE;
    END IF;

    v_depreciable_base := COALESCE(v_item.purchase_value, 0) - COALESCE(v_item.residual_value, 0);
    v_monthly_depreciation := v_depreciable_base / GREATEST(v_item.useful_life_months, 1);

    SELECT COALESCE(accumulated_depreciation, 0) INTO v_previous_accumulated
    FROM public.depreciation_schedules WHERE item_id = v_item.id ORDER BY month_ref DESC LIMIT 1;
    IF v_previous_accumulated IS NULL THEN v_previous_accumulated := 0; END IF;

    v_new_accumulated := v_previous_accumulated + v_monthly_depreciation;
    v_book_value := v_item.purchase_value - v_new_accumulated;

    IF v_book_value > COALESCE(v_item.residual_value, 0) THEN
      INSERT INTO public.depreciation_schedules (workspace_id, item_id, month_ref, depreciation_amount, accumulated_depreciation, book_value)
      VALUES (p_workspace_id, v_item.id, p_month_ref, v_monthly_depreciation, v_new_accumulated, GREATEST(v_book_value, COALESCE(v_item.residual_value, 0)));
      v_items_count := v_items_count + 1;
      v_total_depreciation := v_total_depreciation + v_monthly_depreciation;
    END IF;
  END LOOP;

  IF v_total_depreciation > 0 THEN
    INSERT INTO public.transactions (workspace_id, type, amount, description, due_date, status, metadata)
    VALUES (
      p_workspace_id, 'expense', v_total_depreciation,
      format('Depreciação Mensal - %s', to_char(p_month_ref, 'MM/YYYY')),
      (p_month_ref + interval '1 month - 1 day')::date, 'paid',
      jsonb_build_object('is_non_cash', true, 'depreciation_month', p_month_ref, 'items_count', v_items_count, 'source', 'depreciation_job')
    ) RETURNING id INTO v_dre_id;

    UPDATE public.depreciation_schedules SET is_posted_to_dre = true, financial_entry_id = v_dre_id
    WHERE workspace_id = p_workspace_id AND month_ref = p_month_ref AND is_posted_to_dre IS NOT TRUE;

    PERFORM public.emit_domain_event(p_workspace_id, 'depreciation', v_dre_id, 'MonthlyDepreciationCalculated',
      jsonb_build_object('month_ref', p_month_ref, 'items_count', v_items_count, 'total_depreciation', v_total_depreciation, 'transaction_id', v_dre_id), NULL);
  END IF;

  RETURN QUERY SELECT v_items_count, v_total_depreciation, v_dre_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. View de depreciação por departamento
CREATE OR REPLACE VIEW depreciation_by_department_view WITH (security_invoker = true) AS
SELECT ds.workspace_id, ii.department_id, ds.month_ref, COUNT(DISTINCT ds.item_id) as items_count,
  SUM(ds.depreciation_amount) as total_depreciation, SUM(ds.book_value) as total_book_value, SUM(ds.accumulated_depreciation) as total_accumulated
FROM depreciation_schedules ds JOIN inventory_items ii ON ii.id = ds.item_id
GROUP BY ds.workspace_id, ii.department_id, ds.month_ref;

-- 3. View resumo de depreciação
CREATE OR REPLACE VIEW depreciation_summary_view WITH (security_invoker = true) AS
WITH latest_schedules AS (
  SELECT DISTINCT ON (item_id) workspace_id, item_id, depreciation_amount, accumulated_depreciation, book_value, month_ref, is_posted_to_dre
  FROM depreciation_schedules ORDER BY item_id, month_ref DESC
)
SELECT workspace_id, COUNT(*) as total_items, SUM(depreciation_amount) as monthly_depreciation,
  SUM(accumulated_depreciation) as total_accumulated, SUM(book_value) as total_book_value, MAX(month_ref) as last_calculation
FROM latest_schedules GROUP BY workspace_id;

-- 4. View para DRE com separação caixa vs não-caixa
CREATE OR REPLACE VIEW dre_summary_view WITH (security_invoker = true) AS
SELECT 
  workspace_id,
  EXTRACT(YEAR FROM due_date) as year,
  EXTRACT(MONTH FROM due_date) as month,
  type,
  SUM(amount) as total_amount,
  SUM(CASE WHEN (metadata->>'is_non_cash')::boolean = true THEN amount ELSE 0 END) as non_cash_amount,
  SUM(CASE WHEN (metadata->>'is_non_cash')::boolean IS NOT TRUE THEN amount ELSE 0 END) as cash_amount
FROM transactions WHERE status IN ('paid', 'pending')
GROUP BY workspace_id, EXTRACT(YEAR FROM due_date), EXTRACT(MONTH FROM due_date), type;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_depreciation_month ON depreciation_schedules(month_ref);
CREATE INDEX IF NOT EXISTS idx_depreciation_item ON depreciation_schedules(item_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_posted ON depreciation_schedules(is_posted_to_dre);
