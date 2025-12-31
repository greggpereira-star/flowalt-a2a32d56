
-- ============================================================
-- SPRINT 3: MANUTENÇÃO & GARANTIAS
-- Adaptado para schema existente
-- ============================================================

-- 1. Adicionar coluna item_condition se não existir
ALTER TABLE inventory_units 
ADD COLUMN IF NOT EXISTS item_condition TEXT DEFAULT 'good';

-- 2. Adicionar coluna status em maintenance_records para workflow completo
ALTER TABLE maintenance_records 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- Atualizar registros existentes baseado em is_resolved
UPDATE maintenance_records 
SET status = CASE WHEN is_resolved = true THEN 'completed' ELSE 'scheduled' END
WHERE status IS NULL OR status = 'scheduled';

-- 3. Adicionar colunas faltantes em maintenance_records
ALTER TABLE maintenance_records 
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS completed_date DATE,
ADD COLUMN IF NOT EXISTS performed_by TEXT;

-- Migrar dados existentes
UPDATE maintenance_records 
SET scheduled_date = service_date,
    completed_date = CASE WHEN is_resolved = true THEN service_date ELSE NULL END
WHERE scheduled_date IS NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_units_warranty_end ON inventory_units(warranty_end_date) WHERE warranty_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_cost ON maintenance_records(cost) WHERE cost > 0;
CREATE INDEX IF NOT EXISTS idx_alerts_warranty ON financial_alerts(alert_type) WHERE alert_type LIKE 'warranty%';
