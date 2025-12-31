
-- ============================================
-- FLOWALT FINANCIAL MODULE - INVENTORY & ASSETS
-- Multi-tenant | EDA-ready | Full Audit
-- ============================================

-- ENUM Types for better data integrity
CREATE TYPE inventory_category AS ENUM ('consumable', 'equipment', 'asset');
CREATE TYPE item_condition AS ENUM ('good', 'fair', 'defective', 'maintenance');
CREATE TYPE unit_status AS ENUM ('in_stock', 'checked_out', 'maintenance', 'retired');
CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'RETURN', 'TRANSFER', 'ADJUST');
CREATE TYPE depreciation_method AS ENUM ('straight_line', 'declining_balance', 'units_of_production');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'yearly', 'custom');
CREATE TYPE subscription_status AS ENUM ('active', 'expiring', 'expired', 'cancelled');
CREATE TYPE alert_type_inventory AS ENUM ('warranty_expiring', 'subscription_expiring', 'low_stock', 'preventive_maintenance_due', 'insurance_expiring', 'license_underutilized', 'item_eol');
CREATE TYPE alert_severity_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_status_type AS ENUM ('open', 'acknowledged', 'resolved', 'snoozed');

-- 1) INVENTORY ITEM (Catalog)
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  manufacturer TEXT,
  model TEXT,
  category inventory_category NOT NULL DEFAULT 'consumable',
  department_id UUID REFERENCES public.cost_centers(id),
  status_condition item_condition NOT NULL DEFAULT 'good',
  min_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  is_serialized BOOLEAN DEFAULT false,
  purchase_date DATE,
  purchase_value NUMERIC(15,2) DEFAULT 0,
  residual_value NUMERIC(15,2) DEFAULT 0,
  useful_life_months INTEGER DEFAULT 60,
  depreciation_method depreciation_method DEFAULT 'straight_line',
  capitalization_threshold NUMERIC(15,2) DEFAULT 1000,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(workspace_id, code)
);

-- 2) INVENTORY UNIT (Serialized items)
CREATE TABLE public.inventory_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  serial_number TEXT,
  tag_qr_code TEXT,
  current_location_id UUID REFERENCES public.cost_centers(id),
  current_status unit_status NOT NULL DEFAULT 'in_stock',
  current_holder_id UUID,
  warranty_start_date DATE,
  warranty_end_date DATE,
  warranty_provider TEXT,
  warranty_terms_url TEXT,
  invoice_ref TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, item_id, serial_number)
);

-- 3) INVENTORY MOVEMENT (Stock movements)
CREATE TABLE public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  movement_type movement_type NOT NULL,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.inventory_units(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  from_location_id UUID REFERENCES public.cost_centers(id),
  to_location_id UUID REFERENCES public.cost_centers(id),
  requested_by_user_id UUID,
  responsible_user_id UUID,
  department_id UUID REFERENCES public.cost_centers(id),
  card_id UUID REFERENCES public.cards(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  checkout_term_accepted BOOLEAN DEFAULT false,
  checkin_condition item_condition,
  checkin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- 4) MAINTENANCE RECORD
CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.inventory_units(id),
  service_date DATE NOT NULL,
  problem_description TEXT NOT NULL,
  solution_description TEXT,
  cost NUMERIC(15,2) DEFAULT 0,
  vendor TEXT,
  vendor_contact TEXT,
  is_resolved BOOLEAN DEFAULT false,
  is_warranty_claim BOOLEAN DEFAULT false,
  warranty_until DATE,
  linked_card_id UUID REFERENCES public.cards(id),
  linked_financial_entry_id UUID,
  maintenance_type TEXT DEFAULT 'corrective',
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- 5) DEPRECIATION SCHEDULE
CREATE TABLE public.depreciation_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.inventory_units(id),
  month_ref DATE NOT NULL,
  depreciation_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
  book_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_posted_to_dre BOOLEAN DEFAULT false,
  financial_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, item_id, month_ref)
);

-- 6) SUBSCRIPTION/LICENSE
CREATE TABLE public.subscription_licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  product_name TEXT NOT NULL,
  plan_name TEXT,
  description TEXT,
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  renewal_date DATE,
  auto_renew BOOLEAN DEFAULT true,
  seats_total INTEGER DEFAULT 1,
  seats_used INTEGER DEFAULT 0,
  cost_per_cycle NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  department_id UUID REFERENCES public.cost_centers(id),
  owner_user_id UUID,
  cancellation_terms_url TEXT,
  status subscription_status NOT NULL DEFAULT 'active',
  linked_financial_entry_id UUID,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- 7) INSURANCE CONTRACT
CREATE TABLE public.insurance_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  insurer TEXT NOT NULL,
  policy_number TEXT,
  coverage_summary TEXT,
  start_date DATE,
  renewal_date DATE,
  cost_per_cycle NUMERIC(15,2) DEFAULT 0,
  billing_cycle billing_cycle DEFAULT 'yearly',
  department_id UUID REFERENCES public.cost_centers(id),
  owner_user_id UUID,
  status TEXT DEFAULT 'active',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- 8) INSURANCE-ITEM LINK (many-to-many)
CREATE TABLE public.insurance_item_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurance_id UUID NOT NULL REFERENCES public.insurance_contracts(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.inventory_units(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) ADD COLUMNS TO FINANCIAL_ALERTS FOR INVENTORY
ALTER TABLE public.financial_alerts 
ADD COLUMN IF NOT EXISTS alert_category TEXT,
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS entity_id UUID,
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID,
ADD COLUMN IF NOT EXISTS assigned_to_role TEXT,
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 10) CARD KIT (Materials/Equipment for cards)
CREATE TABLE public.card_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.inventory_units(id),
  quantity_required INTEGER DEFAULT 1,
  quantity_checked_out INTEGER DEFAULT 0,
  responsible_user_id UUID,
  checkout_date DATE,
  expected_return_date DATE,
  actual_return_date DATE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_id, item_id, unit_id)
);

-- 11) KIT TEMPLATES (Smart templates by task type)
CREATE TABLE public.kit_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  space_type TEXT,
  department_id UUID REFERENCES public.cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE public.kit_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.kit_templates(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT true,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12) EVENT OUTBOX (EDA)
CREATE TABLE public.domain_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  correlation_id UUID,
  causation_id UUID,
  version INTEGER DEFAULT 1,
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_inventory_items_workspace ON public.inventory_items(workspace_id);
CREATE INDEX idx_inventory_items_category ON public.inventory_items(workspace_id, category);
CREATE INDEX idx_inventory_items_department ON public.inventory_items(department_id);

CREATE INDEX idx_inventory_units_workspace ON public.inventory_units(workspace_id);
CREATE INDEX idx_inventory_units_item ON public.inventory_units(item_id);
CREATE INDEX idx_inventory_units_status ON public.inventory_units(workspace_id, current_status);

CREATE INDEX idx_inventory_movements_workspace ON public.inventory_movements(workspace_id);
CREATE INDEX idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX idx_inventory_movements_card ON public.inventory_movements(card_id) WHERE card_id IS NOT NULL;

CREATE INDEX idx_maintenance_records_workspace ON public.maintenance_records(workspace_id);
CREATE INDEX idx_maintenance_records_item ON public.maintenance_records(item_id);

CREATE INDEX idx_depreciation_schedules_workspace ON public.depreciation_schedules(workspace_id);
CREATE INDEX idx_depreciation_schedules_item_month ON public.depreciation_schedules(item_id, month_ref);

CREATE INDEX idx_subscription_licenses_workspace ON public.subscription_licenses(workspace_id);
CREATE INDEX idx_subscription_licenses_renewal ON public.subscription_licenses(workspace_id, renewal_date, status);

CREATE INDEX idx_card_kits_card ON public.card_kits(card_id);
CREATE INDEX idx_card_kits_item ON public.card_kits(item_id);

CREATE INDEX idx_domain_events_unprocessed ON public.domain_events(workspace_id, is_processed, created_at) WHERE NOT is_processed;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "inventory_items_workspace_access" ON public.inventory_items
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "inventory_units_workspace_access" ON public.inventory_units
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "inventory_movements_workspace_access" ON public.inventory_movements
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "maintenance_records_workspace_access" ON public.maintenance_records
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "depreciation_schedules_workspace_access" ON public.depreciation_schedules
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "subscription_licenses_workspace_access" ON public.subscription_licenses
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "insurance_contracts_workspace_access" ON public.insurance_contracts
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "insurance_item_links_workspace_access" ON public.insurance_item_links
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "card_kits_workspace_access" ON public.card_kits
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "kit_templates_workspace_access" ON public.kit_templates
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "kit_template_items_workspace_access" ON public.kit_template_items
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "domain_events_workspace_access" ON public.domain_events
  FOR ALL USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- ============================================
-- TRIGGERS FOR STOCK MANAGEMENT
-- ============================================

CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'IN' THEN
    UPDATE inventory_items SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'OUT' THEN
    UPDATE inventory_items SET current_stock = current_stock - NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'RETURN' THEN
    UPDATE inventory_items SET current_stock = current_stock + NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  ELSIF NEW.movement_type = 'ADJUST' THEN
    UPDATE inventory_items SET current_stock = NEW.quantity, updated_at = now() WHERE id = NEW.item_id;
  END IF;
  
  IF NEW.unit_id IS NOT NULL THEN
    IF NEW.movement_type = 'OUT' THEN
      UPDATE inventory_units SET current_status = 'checked_out', current_holder_id = NEW.responsible_user_id, updated_at = now() WHERE id = NEW.unit_id;
    ELSIF NEW.movement_type IN ('RETURN', 'IN') THEN
      UPDATE inventory_units SET current_status = 'in_stock', current_holder_id = NULL, updated_at = now() WHERE id = NEW.unit_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_stock
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION update_stock_on_movement();

-- Updated_at triggers
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_units_updated_at BEFORE UPDATE ON public.inventory_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maintenance_records_updated_at BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscription_licenses_updated_at BEFORE UPDATE ON public.subscription_licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_insurance_contracts_updated_at BEFORE UPDATE ON public.insurance_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_card_kits_updated_at BEFORE UPDATE ON public.card_kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kit_templates_updated_at BEFORE UPDATE ON public.kit_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FUNCTION: Calculate Monthly Depreciation
-- ============================================

CREATE OR REPLACE FUNCTION calculate_depreciation(p_workspace_id UUID, p_month DATE)
RETURNS INTEGER AS $$
DECLARE
  item_record RECORD;
  depreciable_base NUMERIC;
  monthly_depreciation NUMERIC;
  accumulated NUMERIC;
  book_value NUMERIC;
  records_created INTEGER := 0;
BEGIN
  FOR item_record IN
    SELECT i.*, 
           COALESCE((SELECT SUM(accumulated_depreciation) FROM depreciation_schedules WHERE item_id = i.id), 0) as current_accumulated
    FROM inventory_items i
    WHERE i.workspace_id = p_workspace_id
      AND i.is_active = true
      AND (i.category = 'asset' OR (i.category = 'equipment' AND i.purchase_value >= i.capitalization_threshold))
      AND i.purchase_date IS NOT NULL
      AND i.purchase_date <= p_month
  LOOP
    depreciable_base := item_record.purchase_value - item_record.residual_value;
    monthly_depreciation := CASE 
      WHEN item_record.useful_life_months > 0 THEN depreciable_base / item_record.useful_life_months
      ELSE 0
    END;
    
    accumulated := item_record.current_accumulated + monthly_depreciation;
    
    IF accumulated > depreciable_base THEN
      monthly_depreciation := GREATEST(0, depreciable_base - item_record.current_accumulated);
      accumulated := depreciable_base;
    END IF;
    
    book_value := item_record.purchase_value - accumulated;
    
    IF monthly_depreciation > 0 THEN
      INSERT INTO depreciation_schedules (workspace_id, item_id, month_ref, depreciation_amount, accumulated_depreciation, book_value)
      VALUES (p_workspace_id, item_record.id, p_month, monthly_depreciation, accumulated, book_value)
      ON CONFLICT (workspace_id, item_id, month_ref) DO NOTHING;
      
      records_created := records_created + 1;
    END IF;
  END LOOP;
  
  RETURN records_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
