-- Fix: Criar função SECURITY DEFINER para verificar membership de folder sem causar recursão
CREATE OR REPLACE FUNCTION public.is_folder_member(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folder_members
    WHERE user_id = _user_id
      AND folder_id = _folder_id
  )
$$;

-- Recriar policy de folders sem a subconsulta problemática
DROP POLICY IF EXISTS "folders_select_workspace_members" ON public.folders;

CREATE POLICY "folders_select_workspace_members" ON public.folders
  FOR SELECT
  USING (
    -- Membro do workspace
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      -- Admin tem acesso total
      has_admin_access(auth.uid(), workspace_id)
      -- Dono da pasta
      OR owner_id = auth.uid()
      -- Pasta não é restrita
      OR COALESCE(is_restricted, false) = false
      -- Membro explícito da pasta (usando função SECURITY DEFINER)
      OR is_folder_member(auth.uid(), id)
    )
    -- Super admin com sessão ativa
    OR is_super_admin_with_session(auth.uid(), workspace_id)
  );

-- Também corrigir a policy de folder_members para evitar recursão do outro lado
DROP POLICY IF EXISTS "folder_members_select" ON public.folder_members;

-- Criar função para verificar se user tem acesso admin ao workspace da folder
CREATE OR REPLACE FUNCTION public.has_folder_admin_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders f
    JOIN public.user_roles ur ON ur.workspace_id = f.workspace_id
    WHERE f.id = _folder_id
      AND ur.user_id = _user_id
      AND ur.role IN ('super_admin', 'owner', 'admin', 'coordinator')
  )
$$;

CREATE POLICY "folder_members_select" ON public.folder_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR has_folder_admin_access(auth.uid(), folder_id)
  );

-- Corrigir também a policy ALL de folder_members
DROP POLICY IF EXISTS "folder_members_manage_admins" ON public.folder_members;

-- Criar função para verificar se é dono da folder
CREATE OR REPLACE FUNCTION public.is_folder_owner(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.folders
    WHERE id = _folder_id
      AND owner_id = _user_id
  )
$$;

CREATE POLICY "folder_members_manage_admins" ON public.folder_members
  FOR ALL
  USING (
    has_folder_admin_access(auth.uid(), folder_id)
    OR is_folder_owner(auth.uid(), folder_id)
  )
  WITH CHECK (
    has_folder_admin_access(auth.uid(), folder_id)
    OR is_folder_owner(auth.uid(), folder_id)
  );