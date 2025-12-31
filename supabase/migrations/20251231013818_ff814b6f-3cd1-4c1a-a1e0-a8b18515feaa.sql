-- Função para criar transação financeira automaticamente quando folha é aprovada
CREATE OR REPLACE FUNCTION public.create_payroll_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_collaborator_name TEXT;
  v_month_label TEXT;
  v_category_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Só executa quando status muda para 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Buscar nome do colaborador
    SELECT COALESCE(cd.full_name, p.full_name, p.email) INTO v_collaborator_name
    FROM collaborator_details cd
    JOIN workspace_members wm ON wm.id = cd.member_id
    JOIN profiles p ON p.id = wm.user_id
    WHERE cd.id = NEW.collaborator_id;
    
    -- Formatar mês para exibição (ex: "Janeiro/2025")
    v_month_label := TO_CHAR(NEW.reference_month::DATE, 'TMMonth/YYYY');
    
    -- Buscar ou criar categoria "Folha de Pagamento"
    SELECT id INTO v_category_id
    FROM financial_categories
    WHERE workspace_id = NEW.workspace_id 
      AND name = 'Folha de Pagamento' 
      AND type = 'expense'
    LIMIT 1;
    
    -- Se não existir, criar a categoria
    IF v_category_id IS NULL THEN
      INSERT INTO financial_categories (workspace_id, name, type, color, icon)
      VALUES (NEW.workspace_id, 'Folha de Pagamento', 'expense', '#6366F1', 'users')
      RETURNING id INTO v_category_id;
    END IF;
    
    -- Criar a transação de despesa
    INSERT INTO transactions (
      workspace_id,
      type,
      description,
      amount,
      due_date,
      category_id,
      status,
      recurrence,
      notes,
      created_at
    ) VALUES (
      NEW.workspace_id,
      'expense',
      'Salário - ' || v_collaborator_name || ' - ' || v_month_label,
      NEW.net_salary,
      COALESCE(NEW.payment_date::DATE, (NEW.reference_month::DATE + INTERVAL '1 month' - INTERVAL '5 days')::DATE),
      v_category_id,
      'pending',
      'none',
      'Folha de pagamento gerada automaticamente. ID: ' || NEW.id,
      NOW()
    )
    RETURNING id INTO v_transaction_id;
    
    -- Atualizar a folha com o ID da transação
    NEW.transaction_id := v_transaction_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela collaborator_payroll
DROP TRIGGER IF EXISTS trigger_create_payroll_transaction ON collaborator_payroll;
CREATE TRIGGER trigger_create_payroll_transaction
  BEFORE UPDATE ON collaborator_payroll
  FOR EACH ROW
  EXECUTE FUNCTION create_payroll_transaction();

-- Também criar trigger para quando folha é inserida já como aprovada (edge case)
DROP TRIGGER IF EXISTS trigger_create_payroll_transaction_insert ON collaborator_payroll;
CREATE TRIGGER trigger_create_payroll_transaction_insert
  BEFORE INSERT ON collaborator_payroll
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION create_payroll_transaction();