-- Create function to award badge if not already earned
CREATE OR REPLACE FUNCTION public.award_badge(
  p_user_id UUID,
  p_workspace_id UUID,
  p_badge_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert badge if not exists
  INSERT INTO public.user_badges (user_id, workspace_id, badge_type)
  VALUES (p_user_id, p_workspace_id, p_badge_type)
  ON CONFLICT (user_id, workspace_id, badge_type) DO NOTHING;
  
  -- Create notification if badge was inserted
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, workspace_id, type, title, message, metadata)
    VALUES (
      p_user_id, 
      p_workspace_id, 
      'badge_earned', 
      'Nova conquista desbloqueada!',
      CASE p_badge_type
        WHEN 'first_card' THEN 'Você ganhou o badge "Primeiro Card"'
        WHEN 'time_tracker' THEN 'Você ganhou o badge "Pontual"'
        WHEN 'commenter' THEN 'Você ganhou o badge "Comunicador"'
        WHEN 'checklist_master' THEN 'Você ganhou o badge "Organizador"'
        WHEN 'five_cards' THEN 'Você ganhou o badge "Produtivo"'
        WHEN 'ten_hours' THEN 'Você ganhou o badge "Dedicado"'
        WHEN 'space_creator' THEN 'Você ganhou o badge "Arquiteto"'
        WHEN 'collaborator' THEN 'Você ganhou o badge "Colaborador"'
        ELSE 'Você ganhou um novo badge!'
      END,
      jsonb_build_object('badge_type', p_badge_type)
    );
  END IF;
END;
$$;

-- Trigger function for first card badge
CREATE OR REPLACE FUNCTION public.check_card_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  card_count INTEGER;
BEGIN
  -- Award first_card badge
  PERFORM award_badge(NEW.created_by, NEW.workspace_id, 'first_card');
  
  -- Check for five_cards badge
  SELECT COUNT(*) INTO card_count
  FROM public.cards
  WHERE created_by = NEW.created_by AND workspace_id = NEW.workspace_id;
  
  IF card_count >= 5 THEN
    PERFORM award_badge(NEW.created_by, NEW.workspace_id, 'five_cards');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for time tracking badge
CREATE OR REPLACE FUNCTION public.check_time_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_hours NUMERIC;
BEGIN
  -- Award time_tracker badge on first time entry
  PERFORM award_badge(NEW.user_id, NEW.workspace_id, 'time_tracker');
  
  -- Check for ten_hours badge
  SELECT COALESCE(SUM(duration_seconds) / 3600.0, 0) INTO total_hours
  FROM public.time_entries
  WHERE user_id = NEW.user_id AND workspace_id = NEW.workspace_id;
  
  IF total_hours >= 10 THEN
    PERFORM award_badge(NEW.user_id, NEW.workspace_id, 'ten_hours');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for comment badge
CREATE OR REPLACE FUNCTION public.check_comment_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Get workspace_id from the card
  SELECT workspace_id INTO v_workspace_id
  FROM public.cards
  WHERE id = NEW.card_id;
  
  -- Award commenter badge
  PERFORM award_badge(NEW.user_id, v_workspace_id, 'commenter');
  
  RETURN NEW;
END;
$$;

-- Trigger function for checklist badge
CREATE OR REPLACE FUNCTION public.check_checklist_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id UUID;
  v_created_by UUID;
BEGIN
  -- Get workspace_id and created_by from the card
  SELECT workspace_id, created_by INTO v_workspace_id, v_created_by
  FROM public.cards
  WHERE id = NEW.card_id;
  
  -- Award checklist_master badge to the card owner
  IF v_created_by IS NOT NULL THEN
    PERFORM award_badge(v_created_by, v_workspace_id, 'checklist_master');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for card member badge
CREATE OR REPLACE FUNCTION public.check_collaborator_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID;
BEGIN
  -- Get workspace_id and owner from the card
  SELECT workspace_id, owner_id INTO v_workspace_id, v_owner_id
  FROM public.cards
  WHERE id = NEW.card_id;
  
  -- Award collaborator badge to the card owner for adding a member
  IF v_owner_id IS NOT NULL THEN
    PERFORM award_badge(v_owner_id, v_workspace_id, 'collaborator');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for space creator badge
CREATE OR REPLACE FUNCTION public.check_space_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- We need to get the user from context since spaces don't have created_by
  -- This will only work if called in context of a user
  IF auth.uid() IS NOT NULL THEN
    PERFORM award_badge(auth.uid(), NEW.workspace_id, 'space_creator');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the triggers
CREATE TRIGGER on_card_created_check_badges
  AFTER INSERT ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.check_card_badges();

CREATE TRIGGER on_time_entry_created_check_badges
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_time_badges();

CREATE TRIGGER on_comment_created_check_badges
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_comment_badges();

CREATE TRIGGER on_checklist_created_check_badges
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.check_checklist_badges();

CREATE TRIGGER on_card_member_added_check_badges
  AFTER INSERT ON public.card_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_collaborator_badges();

CREATE TRIGGER on_space_created_check_badges
  AFTER INSERT ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.check_space_badges();