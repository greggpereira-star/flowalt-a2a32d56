-- Função para limpar convites antigos automaticamente quando um novo convite é criado
-- Isso evita duplicatas e garante que apenas o convite mais recente seja válido

CREATE OR REPLACE FUNCTION public.cleanup_old_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Revogar todos os convites pendentes anteriores para o mesmo email/workspace
  UPDATE workspace_invites
  SET status = 'revoked', 
      revoked_at = now(),
      updated_at = now()
  WHERE workspace_id = NEW.workspace_id
    AND email = NEW.email
    AND id != NEW.id
    AND status = 'pending';
  
  RETURN NEW;
END;
$$;

-- Trigger que executa antes de inserir um novo convite
DROP TRIGGER IF EXISTS trigger_cleanup_old_invites ON workspace_invites;
CREATE TRIGGER trigger_cleanup_old_invites
  AFTER INSERT ON workspace_invites
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_invites();

-- Também criar uma função para limpar convites expirados periodicamente (pode ser chamada por cron)
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workspace_invites
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;