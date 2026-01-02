-- Função para verificar limite (simplificada)
CREATE OR REPLACE FUNCTION public.check_saved_views_limit(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT COUNT(*) FROM user_saved_views WHERE workspace_id = p_workspace_id AND user_id = p_user_id) < 20
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_user_saved_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_saved_views_updated_at ON public.user_saved_views;
CREATE TRIGGER trg_user_saved_views_updated_at
  BEFORE UPDATE ON public.user_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_saved_views_updated_at();

-- Trigger para garantir apenas 1 default por escopo
CREATE OR REPLACE FUNCTION public.ensure_single_default_view()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_saved_views
    SET is_default = false
    WHERE workspace_id = NEW.workspace_id AND user_id = NEW.user_id AND scope_type = NEW.scope_type
      AND COALESCE(scope_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.scope_id, '00000000-0000-0000-0000-000000000000')
      AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_view ON public.user_saved_views;
CREATE TRIGGER trg_ensure_single_default_view
  BEFORE INSERT OR UPDATE ON public.user_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_view();