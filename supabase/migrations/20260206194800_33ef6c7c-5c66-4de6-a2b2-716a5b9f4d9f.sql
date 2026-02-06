-- Add missing columns to space_templates
ALTER TABLE space_templates 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';

-- Add unique constraint on id for user templates
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_templates_id ON space_templates(id) WHERE id IS NOT NULL;