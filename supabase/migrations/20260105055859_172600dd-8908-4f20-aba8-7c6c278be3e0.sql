-- Add partner_percentage column for partners (sócio)
ALTER TABLE public.collaborator_details 
ADD COLUMN partner_percentage numeric DEFAULT NULL;

COMMENT ON COLUMN public.collaborator_details.partner_percentage IS 'Percentage for partners (sócio) - used instead of base_salary when contract_type is socio';