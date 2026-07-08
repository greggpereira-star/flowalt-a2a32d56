DO $$
DECLARE
  v_user_id uuid := '6397a360-e6da-4a4f-8d39-a744be93faff'::uuid;
  v_workspace_id uuid := '10a7ca16-6328-490f-a6bd-28974a91ef8f'::uuid;
  v_avatar_url text := 'https://vnohlxerngxizmzyptyw.supabase.co/storage/v1/object/public/avatars/6397a360-e6da-4a4f-8d39-a744be93faff/avatar.jpg?t=' || extract(epoch from now())::bigint;
  v_birthday date := '1993-12-22'::date;
BEGIN
  UPDATE public.profiles
  SET
    avatar_url = COALESCE(NULLIF(avatar_url, ''), v_avatar_url),
    birthday = COALESCE(birthday, v_birthday),
    updated_at = now()
  WHERE id = v_user_id
    AND email = 'contato.lucasfilmer@gmail.com'
    AND (avatar_url IS NULL OR avatar_url = '' OR birthday IS NULL);

  INSERT INTO public.user_birthdays (user_id, workspace_id, birth_date, visibility, updated_at)
  VALUES (v_user_id, v_workspace_id, v_birthday, 'team', now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    workspace_id = EXCLUDED.workspace_id,
    birth_date = COALESCE(public.user_birthdays.birth_date, EXCLUDED.birth_date),
    visibility = COALESCE(public.user_birthdays.visibility, EXCLUDED.visibility),
    updated_at = now();
END;
$$;