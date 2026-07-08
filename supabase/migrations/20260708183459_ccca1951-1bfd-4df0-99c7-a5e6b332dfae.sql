CREATE OR REPLACE FUNCTION public.complete_user_profile(
  p_birthday date,
  p_avatar_url text,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_full_name text;
  v_workspace_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_user_email := lower(NULLIF(auth.jwt() ->> 'email', ''));
  v_full_name := NULLIF(trim(COALESCE(p_full_name, auth.jwt() -> 'user_metadata' ->> 'full_name', '')), '');

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMAIL_NOT_AVAILABLE');
  END IF;

  IF p_birthday IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BIRTHDAY_REQUIRED');
  END IF;

  IF p_birthday > current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'BIRTHDAY_IN_FUTURE');
  END IF;

  IF NULLIF(trim(COALESCE(p_avatar_url, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AVATAR_REQUIRED');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, birthday, avatar_url, updated_at)
  VALUES (
    v_user_id,
    v_user_email,
    COALESCE(v_full_name, split_part(v_user_email, '@', 1)),
    p_birthday,
    p_avatar_url,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    birthday = EXCLUDED.birthday,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();

  SELECT wm.workspace_id
  INTO v_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = v_user_id
    AND wm.is_active = true
  ORDER BY wm.joined_at DESC NULLS LAST
  LIMIT 1;

  IF v_workspace_id IS NOT NULL THEN
    INSERT INTO public.user_birthdays (user_id, workspace_id, birth_date, visibility, updated_at)
    VALUES (v_user_id, v_workspace_id, p_birthday, 'team', now())
    ON CONFLICT (user_id) DO UPDATE
    SET
      workspace_id = EXCLUDED.workspace_id,
      birth_date = EXCLUDED.birth_date,
      visibility = COALESCE(public.user_birthdays.visibility, EXCLUDED.visibility),
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_user_id,
    'workspace_id', v_workspace_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_user_profile(date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_user_profile(date, text, text) TO authenticated;