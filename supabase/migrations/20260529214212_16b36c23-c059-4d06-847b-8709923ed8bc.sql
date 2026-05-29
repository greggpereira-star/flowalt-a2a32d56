
-- Public sharing fields on idea_boards
ALTER TABLE public.idea_boards
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_idea_boards_share_token ON public.idea_boards(share_token) WHERE share_token IS NOT NULL;

-- Function to enable/refresh a public share for a board (owner/member only via RLS check)
CREATE OR REPLACE FUNCTION public.enable_idea_board_share(_board_id uuid, _expires_at timestamptz DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_workspace uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO v_workspace FROM public.idea_boards WHERE id = _board_id;
  IF v_workspace IS NULL THEN
    RAISE EXCEPTION 'Board not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_workspace AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.idea_boards
     SET is_public = true,
         share_token = v_token,
         share_expires_at = _expires_at,
         updated_at = now()
   WHERE id = _board_id;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_idea_board_share(_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT workspace_id INTO v_workspace FROM public.idea_boards WHERE id = _board_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'Board not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.idea_boards
     SET is_public = false, share_token = NULL, share_expires_at = NULL, updated_at = now()
   WHERE id = _board_id;
END;
$$;

-- Public read RPC for shared board + references (no auth required)
CREATE OR REPLACE FUNCTION public.get_public_idea_board(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_board public.idea_boards%ROWTYPE;
  v_refs jsonb;
BEGIN
  SELECT * INTO v_board FROM public.idea_boards
   WHERE share_token = _token AND is_public = true AND archived_at IS NULL
   LIMIT 1;

  IF v_board.id IS NULL THEN RETURN NULL; END IF;
  IF v_board.share_expires_at IS NOT NULL AND v_board.share_expires_at < now() THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'type', r.type,
    'title', r.title,
    'description', r.description,
    'source_url', r.source_url,
    'thumbnail_url', r.thumbnail_url,
    'media_url', r.media_url,
    'file_url', r.file_url,
    'file_name', r.file_name,
    'tags', r.tags,
    'category', r.category,
    'is_favorite', r.is_favorite,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_refs
  FROM public.idea_references r
  WHERE r.board_id = v_board.id AND r.archived_at IS NULL;

  RETURN jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board.id,
      'name', v_board.name,
      'description', v_board.description,
      'cover_url', v_board.cover_url,
      'category', v_board.category,
      'tags', v_board.tags,
      'created_at', v_board.created_at,
      'updated_at', v_board.updated_at
    ),
    'references', v_refs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enable_idea_board_share(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_idea_board_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_idea_board(uuid) TO anon, authenticated;
