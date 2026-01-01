-- Drop functions with conflicting signatures
DROP FUNCTION IF EXISTS public.promote_to_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid, uuid) CASCADE;

-- promote_to_owner (only owners can execute)
CREATE FUNCTION public.promote_to_owner(p_workspace_id UUID, p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only owners can promote to owner';
  END IF;
  
  INSERT INTO user_roles (workspace_id, user_id, role)
  VALUES (p_workspace_id, p_target_user_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
  
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_workspace_id, auth.uid(), 'promote_to_owner', 'user', p_target_user_id, 
    jsonb_build_object('target_user_id', p_target_user_id, 'new_role', 'owner'));
  
  RETURN true;
END;
$$;

-- transfer_ownership
CREATE FUNCTION public.transfer_ownership(p_workspace_id UUID, p_new_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only owners can transfer ownership';
  END IF;
  
  INSERT INTO user_roles (workspace_id, user_id, role)
  VALUES (p_workspace_id, p_new_owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
  
  INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_workspace_id, auth.uid(), 'ownership_transferred', 'workspace', p_workspace_id, 
    jsonb_build_object('from_user_id', auth.uid(), 'to_user_id', p_new_owner_id));
  
  RETURN true;
END;
$$;