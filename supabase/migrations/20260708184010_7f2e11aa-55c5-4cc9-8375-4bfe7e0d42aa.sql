WITH ranked AS (
  SELECT id, workspace_id,
         row_number() OVER (PARTITION BY workspace_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.workflows
  WHERE is_default = true AND is_active = true
)
DELETE FROM public.workflows w
USING ranked r
WHERE w.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflows_default_per_workspace
  ON public.workflows (workspace_id)
  WHERE is_default = true AND is_active = true;