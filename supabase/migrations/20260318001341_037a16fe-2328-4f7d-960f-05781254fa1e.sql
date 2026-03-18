CREATE OR REPLACE FUNCTION audit_transaction_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'TransactionCreated';
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'TransactionUpdated';
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'paid' THEN
        PERFORM emit_domain_event(
          NEW.workspace_id,
          'TransactionPaid',
          'Transaction',
          NEW.id,
          jsonb_build_object('amount', NEW.amount, 'paid_at', NEW.paid_date)
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