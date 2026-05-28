
-- Weekly tasks (checklist) for Social Media weekly view, scoped to folder
CREATE TABLE public.weekly_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_tasks_folder ON public.weekly_tasks(folder_id);
CREATE INDEX idx_weekly_tasks_workspace ON public.weekly_tasks(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_tasks TO authenticated;
GRANT ALL ON public.weekly_tasks TO service_role;

ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_tasks_select_members" ON public.weekly_tasks
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "weekly_tasks_insert_members" ON public.weekly_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "weekly_tasks_update_members" ON public.weekly_tasks
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "weekly_tasks_delete_members" ON public.weekly_tasks
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_weekly_tasks_updated_at
  BEFORE UPDATE ON public.weekly_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ideas Bank (free-form references, folders/clients/campaigns)
CREATE TABLE public.ideas_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  reference_url text,
  reference_type text NOT NULL DEFAULT 'other',
  tags text[] NOT NULL DEFAULT '{}',
  client_name text,
  thumbnail_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ideas_bank_folder ON public.ideas_bank(folder_id);
CREATE INDEX idx_ideas_bank_workspace ON public.ideas_bank(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideas_bank TO authenticated;
GRANT ALL ON public.ideas_bank TO service_role;

ALTER TABLE public.ideas_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ideas_bank_select_members" ON public.ideas_bank
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ideas_bank_insert_members" ON public.ideas_bank
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ideas_bank_update_members" ON public.ideas_bank
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ideas_bank_delete_members" ON public.ideas_bank
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_ideas_bank_updated_at
  BEFORE UPDATE ON public.ideas_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
