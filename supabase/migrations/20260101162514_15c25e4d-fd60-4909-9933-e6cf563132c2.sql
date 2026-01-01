
-- =====================================================
-- BLUEPRINT GOVERNANCE: STEP 3 - Space-Level ACL
-- + Update Financial RLS to use has_finance_access
-- =====================================================

-- STEP 3: Add access control columns to spaces
ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'operational' 
  CHECK (access_level IN ('operational', 'restricted'));

ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS allowed_roles app_role[] DEFAULT NULL;

-- Create function to check space access
CREATE OR REPLACE FUNCTION public.can_access_space(_user_id UUID, _space_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.spaces s
    JOIN public.user_roles ur ON ur.workspace_id = s.workspace_id AND ur.user_id = _user_id
    WHERE s.id = _space_id
      AND (
        -- Admins can access all spaces
        ur.role IN ('super_admin', 'owner', 'admin')
        -- Operational spaces are accessible to all members
        OR s.access_level = 'operational'
        -- Restricted spaces check allowed_roles
        OR (s.access_level = 'restricted' AND ur.role = ANY(s.allowed_roles))
      )
  )
$$;

-- Update spaces RLS to use new ACL
DROP POLICY IF EXISTS "Members can view spaces" ON public.spaces;

CREATE POLICY "spaces_select_with_acl"
  ON public.spaces FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      -- Admins see all
      has_admin_access(auth.uid(), workspace_id)
      -- Operational spaces visible to all
      OR access_level = 'operational'
      -- Restricted spaces check allowed_roles
      OR (
        access_level = 'restricted' 
        AND EXISTS (
          SELECT 1 FROM user_roles ur 
          WHERE ur.workspace_id = spaces.workspace_id 
          AND ur.user_id = auth.uid() 
          AND ur.role = ANY(allowed_roles)
        )
      )
    )
  );

-- STEP 7 CONTINUED: Update financial tables RLS to use has_finance_access

-- transactions: Replace is_workspace_member with has_finance_access
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can manage transactions" ON public.transactions;

CREATE POLICY "transactions_select_finance"
  ON public.transactions FOR SELECT
  USING (
    has_finance_access(auth.uid(), workspace_id)
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "transactions_insert_finance"
  ON public.transactions FOR INSERT
  WITH CHECK (
    has_finance_access(auth.uid(), workspace_id)
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "transactions_update_finance"
  ON public.transactions FOR UPDATE
  USING (
    has_finance_access(auth.uid(), workspace_id)
    OR has_admin_access(auth.uid(), workspace_id)
  );

CREATE POLICY "transactions_delete_finance"
  ON public.transactions FOR DELETE
  USING (
    has_finance_access(auth.uid(), workspace_id)
    OR has_admin_access(auth.uid(), workspace_id)
  );

-- collaborator_payroll: Only Owner can see (salary data)
DROP POLICY IF EXISTS "Members can view payroll" ON public.collaborator_payroll;
DROP POLICY IF EXISTS "Admins can manage payroll" ON public.collaborator_payroll;

CREATE POLICY "payroll_select_owner_only"
  ON public.collaborator_payroll FOR SELECT
  USING (has_salary_access(auth.uid(), workspace_id));

CREATE POLICY "payroll_manage_owner_only"
  ON public.collaborator_payroll FOR ALL
  USING (has_salary_access(auth.uid(), workspace_id));

-- salary_history: Only Owner can see
DROP POLICY IF EXISTS "Admins can manage salary history" ON public.salary_history;
DROP POLICY IF EXISTS "Collaborators can view their own salary history" ON public.salary_history;

CREATE POLICY "salary_history_select_owner"
  ON public.salary_history FOR SELECT
  USING (
    has_salary_access(auth.uid(), workspace_id)
    OR (
      -- Users can see their own salary history
      EXISTS (
        SELECT 1 FROM collaborator_details cd
        JOIN workspace_members wm ON wm.id = cd.member_id
        WHERE cd.id = salary_history.collaborator_id
        AND wm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "salary_history_manage_owner"
  ON public.salary_history FOR ALL
  USING (has_salary_access(auth.uid(), workspace_id));

-- client_financials: Owner + Finance only (not coordinator)
DROP POLICY IF EXISTS "client_financials_select_coordinators" ON public.client_financials;
DROP POLICY IF EXISTS "client_financials_update_coordinators" ON public.client_financials;
DROP POLICY IF EXISTS "client_financials_insert_coordinators" ON public.client_financials;
DROP POLICY IF EXISTS "client_financials_delete_admins" ON public.client_financials;

CREATE POLICY "client_financials_select_finance"
  ON public.client_financials FOR SELECT
  USING (has_finance_access(auth.uid(), workspace_id));

CREATE POLICY "client_financials_manage_finance"
  ON public.client_financials FOR ALL
  USING (has_finance_access(auth.uid(), workspace_id));

-- invoices: Update to use has_finance_access
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members with financial access can manage invoices" ON public.invoices;

CREATE POLICY "invoices_select_finance"
  ON public.invoices FOR SELECT
  USING (has_finance_access(auth.uid(), workspace_id));

CREATE POLICY "invoices_manage_finance"
  ON public.invoices FOR ALL
  USING (has_finance_access(auth.uid(), workspace_id));

-- financial_reports: Owner + Finance only
DROP POLICY IF EXISTS "Admins can manage reports" ON public.financial_reports;
DROP POLICY IF EXISTS "Members with financial access can view reports" ON public.financial_reports;

CREATE POLICY "financial_reports_select_finance"
  ON public.financial_reports FOR SELECT
  USING (has_finance_access(auth.uid(), workspace_id));

CREATE POLICY "financial_reports_manage_finance"
  ON public.financial_reports FOR ALL
  USING (has_finance_access(auth.uid(), workspace_id));

-- financial_audit_trail: Owner only (super sensitive)
DROP POLICY IF EXISTS "Admins can view financial audit trail" ON public.financial_audit_trail;

CREATE POLICY "financial_audit_trail_select_owner"
  ON public.financial_audit_trail FOR SELECT
  USING (has_salary_access(auth.uid(), workspace_id));
