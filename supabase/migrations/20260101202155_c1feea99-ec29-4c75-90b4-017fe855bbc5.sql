
-- FLOWALT SECURITY HARDENING - PART 3 (Audit Triggers)

-- Audit triggers for critical tables
DROP TRIGGER IF EXISTS trigger_audit_user_roles ON public.user_roles;
CREATE TRIGGER trigger_audit_user_roles 
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_workspace_members ON public.workspace_members;
CREATE TRIGGER trigger_audit_workspace_members 
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_spaces ON public.spaces;
CREATE TRIGGER trigger_audit_spaces 
  AFTER DELETE ON public.spaces 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_folders ON public.folders;
CREATE TRIGGER trigger_audit_folders 
  AFTER DELETE ON public.folders 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_cards ON public.cards;
CREATE TRIGGER trigger_audit_cards 
  AFTER DELETE ON public.cards 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_client_financials ON public.client_financials;
CREATE TRIGGER trigger_audit_client_financials 
  AFTER INSERT OR UPDATE OR DELETE ON public.client_financials 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();

DROP TRIGGER IF EXISTS trigger_audit_collaborator_details ON public.collaborator_details;
CREATE TRIGGER trigger_audit_collaborator_details 
  AFTER INSERT OR UPDATE OR DELETE ON public.collaborator_details 
  FOR EACH ROW EXECUTE FUNCTION public.audit_entity_changes();
