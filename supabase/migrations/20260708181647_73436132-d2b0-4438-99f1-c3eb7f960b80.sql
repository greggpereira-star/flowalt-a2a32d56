
CREATE INDEX IF NOT EXISTS idx_cards_workspace_status_created ON public.cards (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_workspace_status_sort ON public.cards (workspace_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_cards_space_status_sort ON public.cards (space_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_cards_client_status ON public.cards (client_id, status) WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_workspace_created ON public.notifications (user_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklists_card_sort ON public.checklists (card_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_folders_space_archived_sort ON public.folders (space_id, is_archived, sort_order);

CREATE INDEX IF NOT EXISTS idx_folder_views_folder_sort ON public.folder_views (folder_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_transactions_workspace_status_due ON public.transactions (workspace_id, status, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_card_members_card ON public.card_members (card_id);
CREATE INDEX IF NOT EXISTS idx_card_members_user ON public.card_members (user_id);

CREATE INDEX IF NOT EXISTS idx_access_logs_workspace_created ON public.access_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_workspace_created ON public.domain_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_spaces_space_card ON public.card_spaces (space_id, card_id);
CREATE INDEX IF NOT EXISTS idx_card_custom_fields_card ON public.card_custom_fields (card_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_workspace ON public.user_badges (user_id, workspace_id);
