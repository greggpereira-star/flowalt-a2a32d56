
-- Enable realtime for social_jobs table
ALTER TABLE social_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_jobs;

-- Enable realtime for social_platform_assets table
ALTER TABLE social_platform_assets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_platform_assets;

-- Add RLS policy for social_jobs INSERT (missing)
CREATE POLICY "Service role can insert jobs"
  ON social_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_jobs.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin', 'coordinator')
    )
  );

-- Add RLS policy for social_jobs UPDATE
CREATE POLICY "Elevated roles can update jobs"
  ON social_jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_jobs.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Add RLS policy for social_jobs DELETE
CREATE POLICY "Elevated roles can delete jobs"
  ON social_jobs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.workspace_id = social_jobs.workspace_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  );
