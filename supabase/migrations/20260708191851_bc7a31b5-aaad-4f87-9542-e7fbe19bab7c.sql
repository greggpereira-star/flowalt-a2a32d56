CREATE INDEX IF NOT EXISTS idx_time_entries_workspace_user_running ON public.time_entries (workspace_id, user_id, is_running) WHERE is_running = true;

CREATE INDEX IF NOT EXISTS idx_time_entries_workspace_running ON public.time_entries (workspace_id, is_running) WHERE is_running = true;

CREATE INDEX IF NOT EXISTS idx_events_workspace_start_end ON public.events (workspace_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_folder_templates_type_workspace_default ON public.folder_templates (space_type, workspace_id, is_default DESC);

CREATE INDEX IF NOT EXISTS idx_view_templates_type_workspace_sort ON public.view_templates (space_type, workspace_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_active_workspace ON public.workspace_members (user_id, is_active, workspace_id) WHERE is_active = true;