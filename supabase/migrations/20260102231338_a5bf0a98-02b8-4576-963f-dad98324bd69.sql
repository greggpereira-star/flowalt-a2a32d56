-- Adicionar tipo de centro (custo/lucro/ambos)
ALTER TABLE cost_centers 
ADD COLUMN IF NOT EXISTS center_type TEXT DEFAULT 'cost' 
CHECK (center_type IN ('cost', 'profit', 'both'));

-- Adicionar meta de receita para centros de lucro
ALTER TABLE cost_centers 
ADD COLUMN IF NOT EXISTS revenue_target_monthly NUMERIC DEFAULT 0;