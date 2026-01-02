-- Continue hardening: policies that failed above due to existing names
-- We first drop all old policies then recreate with unique names

-- TRANSACTIONS
DROP POLICY IF EXISTS "transactions_select_finance" ON public.transactions;
DROP POLICY IF EXISTS "transactions_manage_finance" ON public.transactions;
CREATE POLICY "transactions_select_finance_v2"
ON public.transactions
FOR SELECT
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = transactions.workspace_id AND ur.role = 'finance'
  )
);
CREATE POLICY "transactions_manage_finance_v2"
ON public.transactions
FOR ALL
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = transactions.workspace_id AND ur.role = 'finance'
  )
)
WITH CHECK (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = transactions.workspace_id AND ur.role = 'finance'
  )
);

-- COLLABORATOR_PAYROLL: drop existing then create
DROP POLICY IF EXISTS "collab_pay_owner" ON public.collaborator_payroll;
DROP POLICY IF EXISTS "collab_pay_manage_owner" ON public.collaborator_payroll;

CREATE POLICY "collaborator_payroll_sel_owner_v2"
ON public.collaborator_payroll
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.collaborator_details cd ON cd.id = collaborator_payroll.collaborator_id
    WHERE ur.user_id = auth.uid()
      AND ur.workspace_id = cd.workspace_id
      AND ur.role IN ('owner', 'super_admin')
  )
);

CREATE POLICY "collaborator_payroll_manage_owner_v2"
ON public.collaborator_payroll
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.collaborator_details cd ON cd.id = collaborator_payroll.collaborator_id
    WHERE ur.user_id = auth.uid()
      AND ur.workspace_id = cd.workspace_id
      AND ur.role IN ('owner', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.collaborator_details cd ON cd.id = collaborator_payroll.collaborator_id
    WHERE ur.user_id = auth.uid()
      AND ur.workspace_id = cd.workspace_id
      AND ur.role IN ('owner', 'super_admin')
  )
);

-- CLIENT_CARDS
DROP POLICY IF EXISTS "client_cards_select_members" ON public.client_cards;
DROP POLICY IF EXISTS "client_cards_manage_admin" ON public.client_cards;
CREATE POLICY "client_cards_select_members_v2"
ON public.client_cards
FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "client_cards_manage_admin_v2"
ON public.client_cards
FOR ALL
USING (has_admin_access(auth.uid(), workspace_id))
WITH CHECK (has_admin_access(auth.uid(), workspace_id));

-- FINANCIAL_REPORTS
DROP POLICY IF EXISTS "fin_rep_finance" ON public.financial_reports;
CREATE POLICY "financial_reports_finance_v2"
ON public.financial_reports
FOR SELECT
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = financial_reports.workspace_id AND ur.role = 'finance'
  )
);

-- BANK_RECONCILIATIONS
DROP POLICY IF EXISTS "bank_rec_finance" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "bank_rec_manage_finance" ON public.bank_reconciliations;

CREATE POLICY "bank_rec_finance_v2"
ON public.bank_reconciliations
FOR SELECT
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = bank_reconciliations.workspace_id AND ur.role = 'finance'
  )
);

CREATE POLICY "bank_rec_manage_finance_v2"
ON public.bank_reconciliations
FOR ALL
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = bank_reconciliations.workspace_id AND ur.role = 'finance'
  )
)
WITH CHECK (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = bank_reconciliations.workspace_id AND ur.role = 'finance'
  )
);

-- INVOICES
DROP POLICY IF EXISTS "invoices_finance" ON public.invoices;
DROP POLICY IF EXISTS "invoices_manage_finance" ON public.invoices;

CREATE POLICY "invoices_finance_v2"
ON public.invoices
FOR SELECT
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = invoices.workspace_id AND ur.role = 'finance'
  )
);

CREATE POLICY "invoices_manage_finance_v2"
ON public.invoices
FOR ALL
USING (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = invoices.workspace_id AND ur.role = 'finance'
  )
)
WITH CHECK (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.workspace_id = invoices.workspace_id AND ur.role = 'finance'
  )
);

-- WORKSPACE_MEMBERS – prevent self-insert
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_admin_v2"
ON public.workspace_members
FOR INSERT
WITH CHECK (
  has_admin_access(auth.uid(), workspace_id)
  OR EXISTS (
    SELECT 1 FROM public.workspace_invites wi
    WHERE wi.workspace_id = workspace_members.workspace_id
      AND wi.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND wi.status = 'accepted'
  )
);

-- USER_ROLES – only admins can manage (prevent self-promotion)
DROP POLICY IF EXISTS "user_roles_manage_admin" ON public.user_roles;
CREATE POLICY "user_roles_manage_admin_v2"
ON public.user_roles
FOR ALL
USING (has_admin_access(auth.uid(), workspace_id))
WITH CHECK (has_admin_access(auth.uid(), workspace_id));