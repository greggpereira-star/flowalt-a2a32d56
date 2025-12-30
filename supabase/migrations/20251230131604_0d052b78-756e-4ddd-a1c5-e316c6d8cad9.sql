-- Usage tracking per module
CREATE TABLE public.module_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  module_name TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for module usage
CREATE POLICY "Users can insert their own usage"
ON public.module_usage FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view usage in their workspace"
ON public.module_usage FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Process templates table (for V2)
CREATE TABLE public.process_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  default_assignments JSONB DEFAULT '{}',
  estimated_duration_hours DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for templates
CREATE POLICY "Users can view templates in their workspace"
ON public.process_templates FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage templates in their workspace"
ON public.process_templates FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- AI estimates table (for V2)
CREATE TABLE public.ai_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  estimated_hours DECIMAL(10,2) NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  model_version TEXT NOT NULL DEFAULT 'v1',
  input_features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_estimates ENABLE ROW LEVEL SECURITY;

-- RLS policies for AI estimates
CREATE POLICY "Users can view AI estimates in their workspace"
ON public.ai_estimates FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert AI estimates"
ON public.ai_estimates FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Internal feedback table
CREATE TABLE public.internal_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  page_url TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedback
CREATE POLICY "Users can submit feedback"
ON public.internal_feedback FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view feedback in their workspace"
ON public.internal_feedback FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX idx_module_usage_workspace ON public.module_usage(workspace_id);
CREATE INDEX idx_module_usage_module ON public.module_usage(module_name);
CREATE INDEX idx_module_usage_created ON public.module_usage(created_at);
CREATE INDEX idx_process_templates_workspace ON public.process_templates(workspace_id);
CREATE INDEX idx_ai_estimates_card ON public.ai_estimates(card_id);
CREATE INDEX idx_internal_feedback_workspace ON public.internal_feedback(workspace_id);

-- Update trigger for process_templates
CREATE TRIGGER update_process_templates_updated_at
BEFORE UPDATE ON public.process_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();