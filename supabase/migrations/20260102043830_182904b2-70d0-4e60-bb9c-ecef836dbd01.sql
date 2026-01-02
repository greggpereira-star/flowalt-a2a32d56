-- Fix generate_birthday_notices function - profiles.id instead of profiles.user_id
CREATE OR REPLACE FUNCTION public.generate_birthday_notices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  user_name text;
BEGIN
  FOR r IN
    SELECT ub.user_id, ub.workspace_id, ub.visibility
    FROM user_birthdays ub
    WHERE EXTRACT(MONTH FROM ub.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM ub.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
      AND ub.visibility != 'private'
  LOOP
    -- Get user name from profiles (profiles.id = user_id)
    SELECT COALESCE(p.full_name, 'Colega') INTO user_name 
    FROM profiles p WHERE p.id = r.user_id;

    -- Check if notice already exists for today
    IF NOT EXISTS (
      SELECT 1 FROM notices
      WHERE source_type = 'birthday'
        AND source_id = r.user_id
        AND workspace_id = r.workspace_id
        AND DATE(starts_at) = CURRENT_DATE
    ) THEN
      -- Insert birthday notice
      INSERT INTO notices (
        workspace_id, title, content, category, priority, status,
        requires_confirmation, auto_generated, source_type, source_id,
        starts_at, ends_at, target_roles
      ) VALUES (
        r.workspace_id,
        '🎉 Hoje é aniversário de ' || COALESCE(user_name, 'Colega') || '!',
        'Desejamos um excelente novo ano! 🎂🎈',
        'birthday',
        'normal',
        'active',
        false,
        true,
        'birthday',
        r.user_id,
        CURRENT_DATE::timestamptz,
        (CURRENT_DATE + INTERVAL '1 day')::timestamptz,
        CASE WHEN r.visibility = 'public' 
          THEN ARRAY['member', 'coordinator', 'finance', 'admin', 'owner']::text[]
          ELSE ARRAY['coordinator', 'admin', 'owner']::text[]
        END
      );
    END IF;
  END LOOP;
END;
$$;