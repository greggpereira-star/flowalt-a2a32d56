-- Create client_policies table for client-specific rules
CREATE TABLE public.client_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_card_id UUID NOT NULL REFERENCES public.client_cards(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Scope limits
  max_monthly_hours NUMERIC DEFAULT NULL,
  max_tasks_per_month INTEGER DEFAULT NULL,
  max_budget_per_month NUMERIC DEFAULT NULL,
  
  -- Approval rules
  requires_briefing_approval BOOLEAN DEFAULT false,
  briefing_approvers UUID[] DEFAULT '{}',
  requires_delivery_approval BOOLEAN DEFAULT false,
  delivery_approvers UUID[] DEFAULT '{}',
  
  -- Alert thresholds
  hours_alert_threshold NUMERIC DEFAULT 80,
  budget_alert_threshold NUMERIC DEFAULT 80,
  margin_alert_threshold NUMERIC DEFAULT 20,
  
  -- Auto-pause rules
  auto_pause_on_overdue_payment BOOLEAN DEFAULT false,
  overdue_days_to_pause INTEGER DEFAULT 30,
  auto_pause_on_negative_margin BOOLEAN DEFAULT false,
  
  -- Communication rules
  weekly_report_enabled BOOLEAN DEFAULT true,
  monthly_report_enabled BOOLEAN DEFAULT true,
  report_recipients TEXT[] DEFAULT '{}',
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.client_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view client policies in their workspace"
ON public.client_policies
FOR SELECT
USING (
  workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.is_active = true
  )
);

CREATE POLICY "Coordinators and above can manage client policies"
ON public.client_policies
FOR ALL
USING (
  workspace_id IN (
    SELECT ur.workspace_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'coordinator')
  )
);

-- Create client_upsell_suggestions table
CREATE TABLE public.client_upsell_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_card_id UUID NOT NULL REFERENCES public.client_cards(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Suggestion details
  suggestion_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Data-driven justification
  trigger_metric TEXT NOT NULL,
  trigger_value NUMERIC,
  suggested_value NUMERIC,
  potential_revenue_increase NUMERIC,
  
  -- Status
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Validity
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_upsell_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies for upsell suggestions
CREATE POLICY "Coordinators and above can view upsell suggestions"
ON public.client_upsell_suggestions
FOR SELECT
USING (
  workspace_id IN (
    SELECT ur.workspace_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'coordinator')
  )
);

CREATE POLICY "Coordinators and above can manage upsell suggestions"
ON public.client_upsell_suggestions
FOR ALL
USING (
  workspace_id IN (
    SELECT ur.workspace_id FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin', 'coordinator')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_client_policies_updated_at
BEFORE UPDATE ON public.client_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_upsell_suggestions_updated_at
BEFORE UPDATE ON public.client_upsell_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();