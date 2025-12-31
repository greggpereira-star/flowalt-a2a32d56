-- Create view templates table for individual view templates (not folder kits)
CREATE TABLE IF NOT EXISTS public.view_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  view_type TEXT NOT NULL, -- kanban, calendar, list
  icon TEXT DEFAULT 'layout-grid',
  default_config JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.view_templates ENABLE ROW LEVEL SECURITY;

-- Allow reading system templates (workspace_id IS NULL) and workspace templates
CREATE POLICY "view_templates_select" ON public.view_templates
  FOR SELECT USING (
    workspace_id IS NULL OR 
    workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id)
  );

-- Allow workspace members to create custom templates
CREATE POLICY "view_templates_insert" ON public.view_templates
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL AND
    workspace_id IN (SELECT id FROM workspaces WHERE id = workspace_id)
  );

-- Insert default view templates for social_media
INSERT INTO public.view_templates (space_type, name, description, view_type, icon, default_config, sort_order, is_system)
VALUES
  ('social_media', 'Kanban de Conteúdo', 'Quadro kanban com colunas do workflow editorial', 'kanban', 'kanban', 
   '{"columns": [
     {"id": "backlog", "name": "Ideias / Backlog", "color": "#94a3b8"},
     {"id": "briefing", "name": "Em Briefing", "color": "#f97316"},
     {"id": "production", "name": "Em Produção", "color": "#3b82f6"},
     {"id": "approval", "name": "Em Aprovação", "color": "#eab308"},
     {"id": "scheduled", "name": "Programado", "color": "#8b5cf6"},
     {"id": "posted", "name": "Postado", "color": "#22c55e"},
     {"id": "archived", "name": "Arquivado", "color": "#64748b"}
   ]}'::jsonb, 0, true),
  
  ('social_media', 'Calendário Editorial', 'Visualização em calendário por data de postagem', 'calendar', 'calendar',
   '{"date_field": "post_date", "color_by": "platform", "display_fields": ["platform", "editorial_status"]}'::jsonb, 1, true),
  
  ('social_media', 'Lista de Tarefas', 'Lista ordenada por prioridade e prazo', 'list', 'list',
   '{"show_checkboxes": true, "sort_by": ["due_date", "urgency"], "display_fields": ["assignee", "due_date", "status"]}'::jsonb, 2, true),
  
  ('social_media', 'Banco de Ideias', 'Lista simples com tags e links para ideias', 'list', 'lightbulb',
   '{"filters": [{"field": "status", "operator": "eq", "value": "backlog"}], "display_fields": ["tags", "description"]}'::jsonb, 3, true),
  
  ('social_media', 'Aprovações', 'Lista filtrada por itens pendentes de aprovação', 'list', 'check-circle',
   '{"filters": [{"field": "editorial_status", "operator": "in", "values": ["Em Aprovação", "Ajustes Solicitados"]}], "display_fields": ["client", "approval_link", "assignee"]}'::jsonb, 4, true),
  
  ('social_media', 'Campanhas', 'Agrupamento por período/campanha', 'list', 'megaphone',
   '{"group_by": "campaign_period", "display_fields": ["platform", "piece_type", "post_date"]}'::jsonb, 5, true),
  
  ('social_media', 'Relatórios', 'Registro de resultados e KPIs', 'list', 'bar-chart',
   '{"display_fields": ["post_date", "platform", "kpi_reach", "kpi_engagement", "observations"], "sort_by": ["post_date"]}'::jsonb, 6, true);

-- Add column to folder_views to track source template (optional)
ALTER TABLE public.folder_views ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.view_templates(id);

-- Create user_preferences table for storing UI state like expanded folders
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, workspace_id, preference_key)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "user_preferences_select" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_insert" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_preferences_update" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_preferences_delete" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);