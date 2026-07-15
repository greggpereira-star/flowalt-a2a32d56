CREATE OR REPLACE FUNCTION public.mirror_card_to_space(_card_id uuid, _target_space_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
  v_target_workspace_id uuid;
  v_folder_id uuid;
BEGIN
  -- Validate caller is a member of the target space workspace
  SELECT workspace_id INTO v_target_workspace_id FROM public.spaces WHERE id = _target_space_id;
  IF v_target_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Target space not found';
  END IF;
  IF NOT public.is_workspace_member(auth.uid(), v_target_workspace_id) THEN
    RAISE EXCEPTION 'Not a workspace member';
  END IF;

  SELECT workspace_id INTO v_workspace_id FROM public.cards WHERE id = _card_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Card not found';
  END IF;
  IF v_workspace_id <> v_target_workspace_id THEN
    RAISE EXCEPTION 'Cross-workspace mirroring not allowed';
  END IF;

  -- Link card to target space (idempotent)
  INSERT INTO public.card_spaces (card_id, space_id)
  VALUES (_card_id, _target_space_id)
  ON CONFLICT DO NOTHING;

  -- Find a default (first, non-archived) folder in the target space, bypassing per-folder ACL
  SELECT id INTO v_folder_id
  FROM public.folders
  WHERE space_id = _target_space_id AND is_archived = false
  ORDER BY sort_order ASC NULLS LAST, created_at ASC
  LIMIT 1;

  -- If none exists, create a Backlog folder
  IF v_folder_id IS NULL THEN
    INSERT INTO public.folders (workspace_id, space_id, name, icon, color)
    VALUES (v_workspace_id, _target_space_id, 'Backlog', 'list', '#6366f1')
    RETURNING id INTO v_folder_id;
  END IF;

  -- Link card to the folder (idempotent)
  INSERT INTO public.card_folders (card_id, folder_id)
  VALUES (_card_id, v_folder_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mirror_card_to_space(uuid, uuid) TO authenticated;