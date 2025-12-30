
-- Create enum for transaction types
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense', 'transfer');

-- Create enum for transaction status
CREATE TYPE public.transaction_status AS ENUM ('pending', 'paid', 'cancelled', 'overdue');

-- Create enum for recurrence type
CREATE TYPE public.recurrence_type AS ENUM ('none', 'monthly', 'yearly');

-- Create categories table
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type transaction_type NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table (main financial entries)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  collaborator_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  recurrence recurrence_type DEFAULT 'none',
  installment_number INTEGER,
  total_installments INTEGER,
  parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collaborator_details table (extended employee info)
CREATE TABLE public.collaborator_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  full_name TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  hire_date DATE,
  contract_type TEXT DEFAULT 'clt',
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  pix_key TEXT,
  base_salary NUMERIC(12, 2) DEFAULT 0,
  weekly_hours INTEGER DEFAULT 40,
  address JSONB DEFAULT '{}',
  emergency_contact JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

-- Create salary_history table
CREATE TABLE public.salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborator_details(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  previous_salary NUMERIC(12, 2),
  new_salary NUMERIC(12, 2) NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_categories
CREATE POLICY "Admins can manage financial categories"
  ON public.financial_categories FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view financial categories"
  ON public.financial_categories FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for transactions
CREATE POLICY "Admins can manage transactions"
  ON public.transactions FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for collaborator_details
CREATE POLICY "Admins can manage collaborator details"
  ON public.collaborator_details FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view their own details"
  ON public.collaborator_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.id = collaborator_details.member_id
      AND wm.user_id = auth.uid()
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

-- RLS Policies for salary_history
CREATE POLICY "Admins can manage salary history"
  ON public.salary_history FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "Collaborators can view their own salary history"
  ON public.salary_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collaborator_details cd
      JOIN workspace_members wm ON wm.id = cd.member_id
      WHERE cd.id = salary_history.collaborator_id
      AND wm.user_id = auth.uid()
    )
    OR has_admin_access(auth.uid(), workspace_id)
  );

-- Create triggers for updated_at
CREATE TRIGGER update_financial_categories_updated_at
  BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collaborator_details_updated_at
  BEFORE UPDATE ON public.collaborator_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_transactions_workspace ON public.transactions(workspace_id);
CREATE INDEX idx_transactions_due_date ON public.transactions(due_date);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_collaborator_details_workspace ON public.collaborator_details(workspace_id);
