-- Add columns to space_templates for user-created templates
ALTER TABLE space_templates 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS is_user_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS folders_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS views_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custom_fields_config JSONB DEFAULT '[]'::jsonb;

-- Create index for workspace lookup
CREATE INDEX IF NOT EXISTS idx_space_templates_workspace ON space_templates(workspace_id) WHERE workspace_id IS NOT NULL;

-- RLS Policies for user templates
DROP POLICY IF EXISTS "Users can view system and workspace templates" ON space_templates;
CREATE POLICY "Users can view system and workspace templates" 
ON space_templates 
FOR SELECT 
USING (
  workspace_id IS NULL -- System templates (visible to all)
  OR workspace_id IN (
    SELECT workspace_id FROM user_roles WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can create workspace templates" ON space_templates;
CREATE POLICY "Admins can create workspace templates" 
ON space_templates 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can update workspace templates" ON space_templates;
CREATE POLICY "Admins can update workspace templates" 
ON space_templates 
FOR UPDATE 
USING (
  workspace_id IN (
    SELECT workspace_id FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Admins can delete workspace templates" ON space_templates;
CREATE POLICY "Admins can delete workspace templates" 
ON space_templates 
FOR DELETE 
USING (
  is_user_template = true
  AND workspace_id IN (
    SELECT workspace_id FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);