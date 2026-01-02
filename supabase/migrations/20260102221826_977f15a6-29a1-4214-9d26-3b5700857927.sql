-- Tabela para colaboradores externos (sem acesso ao Flowalt)
-- Ex: faxineira, contador, motorista, estoquista
CREATE TABLE public.external_collaborators (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    cpf TEXT,
    rg TEXT,
    birth_date DATE,
    hire_date DATE,
    termination_date DATE,
    contract_type TEXT DEFAULT 'clt',
    job_title TEXT,
    department TEXT,
    bank_name TEXT,
    bank_agency TEXT,
    bank_account TEXT,
    pix_key TEXT,
    base_salary NUMERIC DEFAULT 0,
    weekly_hours INTEGER DEFAULT 40,
    address JSONB DEFAULT '{}',
    emergency_contact JSONB DEFAULT '{}',
    documents JSONB DEFAULT '[]',
    notes TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Apenas owner e finance podem ver colaboradores externos (dados sensíveis)
CREATE POLICY "External collaborators viewable by owner and finance"
ON public.external_collaborators
FOR SELECT
USING (
    workspace_id IN (
        SELECT ur.workspace_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'finance', 'super_admin')
    )
);

CREATE POLICY "External collaborators insertable by owner and finance"
ON public.external_collaborators
FOR INSERT
WITH CHECK (
    workspace_id IN (
        SELECT ur.workspace_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'finance', 'super_admin')
    )
);

CREATE POLICY "External collaborators updatable by owner and finance"
ON public.external_collaborators
FOR UPDATE
USING (
    workspace_id IN (
        SELECT ur.workspace_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'finance', 'super_admin')
    )
);

CREATE POLICY "External collaborators deletable by owner and finance"
ON public.external_collaborators
FOR DELETE
USING (
    workspace_id IN (
        SELECT ur.workspace_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'finance', 'super_admin')
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_external_collaborators_updated_at
BEFORE UPDATE ON public.external_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de salário para colaboradores externos
CREATE TABLE public.external_collaborator_salary_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    collaborator_id UUID NOT NULL REFERENCES external_collaborators(id) ON DELETE CASCADE,
    previous_salary NUMERIC,
    new_salary NUMERIC NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.external_collaborator_salary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "External salary history viewable by owner and finance"
ON public.external_collaborator_salary_history
FOR SELECT
USING (
    collaborator_id IN (
        SELECT ec.id FROM external_collaborators ec
        JOIN user_roles ur ON ur.workspace_id = ec.workspace_id
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'finance', 'super_admin')
    )
);

CREATE POLICY "External salary history insertable by owner and finance"
ON public.external_collaborator_salary_history
FOR INSERT
WITH CHECK (
    collaborator_id IN (
        SELECT ec.id FROM external_collaborators ec
        JOIN user_roles ur ON ur.workspace_id = ec.workspace_id
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'finance', 'super_admin')
    )
);