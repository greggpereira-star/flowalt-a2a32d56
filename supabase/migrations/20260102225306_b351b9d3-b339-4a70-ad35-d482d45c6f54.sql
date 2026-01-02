-- Adicionar campo cost_center_id na tabela external_collaborators
ALTER TABLE public.external_collaborators 
ADD COLUMN cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- Adicionar campo responsible_user_id na tabela cost_centers (sócio responsável)
ALTER TABLE public.cost_centers 
ADD COLUMN responsible_user_id uuid;

-- Criar índice para melhor performance
CREATE INDEX idx_external_collaborators_cost_center ON public.external_collaborators(cost_center_id);
CREATE INDEX idx_cost_centers_responsible_user ON public.cost_centers(responsible_user_id);

-- Comentários para documentação
COMMENT ON COLUMN public.external_collaborators.cost_center_id IS 'Centro de custo ao qual o colaborador está vinculado';
COMMENT ON COLUMN public.cost_centers.responsible_user_id IS 'Sócio/usuário responsável pelo centro de custo';