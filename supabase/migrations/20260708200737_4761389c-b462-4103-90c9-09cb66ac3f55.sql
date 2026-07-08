
DROP POLICY IF EXISTS "collaborator_payroll_manage_owner_v2" ON public.collaborator_payroll;
DROP POLICY IF EXISTS "collaborator_payroll_sel_owner_v2" ON public.collaborator_payroll;

DROP POLICY IF EXISTS "folder_views_select_via_folder" ON public.folder_views;
CREATE POLICY "folder_views_select_workspace_member" ON public.folder_views
FOR SELECT USING (
  is_workspace_member(auth.uid(), workspace_id)
  AND EXISTS (
    SELECT 1 FROM public.folders f
    WHERE f.id = folder_views.folder_id
      AND f.workspace_id = folder_views.workspace_id
  )
);

DROP POLICY IF EXISTS "notifications_insert_workspace_member" ON public.notifications;
CREATE POLICY "notifications_insert_workspace_member" ON public.notifications
FOR INSERT WITH CHECK (
  (current_setting('role', true) = 'service_role')
  OR (user_id = auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      WHERE wm1.workspace_id = notifications.workspace_id
        AND wm1.user_id = auth.uid()
        AND COALESCE(wm1.is_active, true) = true
    )
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm2
      WHERE wm2.workspace_id = notifications.workspace_id
        AND wm2.user_id = notifications.user_id
        AND COALESCE(wm2.is_active, true) = true
    )
  )
);

DROP POLICY IF EXISTS "Users can view invites for cards they can access" ON public.card_invites;
CREATE POLICY "Users can view invites for cards they can access" ON public.card_invites
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = card_invites.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
  )
  OR (lower(email) = lower((auth.jwt() ->> 'email')))
);

DROP POLICY IF EXISTS "Invite creators can update their invites" ON public.card_invites;
CREATE POLICY "Invite creators can update their invites" ON public.card_invites
FOR UPDATE USING (
  invited_by = auth.uid()
  OR lower(email) = lower((auth.jwt() ->> 'email'))
);

DROP POLICY IF EXISTS "Users can insert categories in own workspace" ON public.financial_categories;

DROP POLICY IF EXISTS "Anyone can read space templates" ON public.space_templates;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images accessible to authenticated" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public can view client logos" ON storage.objects;
CREATE POLICY "Client logos accessible to authenticated" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "Public can view mindmap attachments" ON storage.objects;
CREATE POLICY "Mindmap attachments accessible to authenticated" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'mindmap-attachments');

DROP POLICY IF EXISTS "Social media files are publicly accessible" ON storage.objects;
CREATE POLICY "Social media files accessible to authenticated" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'social-media');

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_idea_board(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon;
