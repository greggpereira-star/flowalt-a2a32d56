-- Fix unique constraint to allow multiple historical invites while still preventing duplicate *pending* invites
-- Current constraint blocks revoking when a revoked row already exists for same (workspace_id, email).

DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'workspace_invites'
      AND c.conname = 'workspace_invites_workspace_id_email_status_key'
  ) THEN
    EXECUTE 'ALTER TABLE public.workspace_invites DROP CONSTRAINT workspace_invites_workspace_id_email_status_key';
  END IF;
END $$;

-- Create a partial unique index to ensure only one pending invite per email per workspace
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_unique_pending_email_per_workspace
  ON public.workspace_invites (workspace_id, email)
  WHERE status = 'pending';
