-- Weekly goals system
CREATE TABLE public.weekly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  goal_type TEXT NOT NULL, -- 'cards_created', 'cards_completed', 'hours_logged', 'comments_made'
  target_value INTEGER NOT NULL,
  reward_badge TEXT, -- Badge type to award on completion
  reward_points INTEGER DEFAULT 100,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, week_start, goal_type)
);

-- User progress on weekly goals
CREATE TABLE public.user_goal_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.weekly_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  current_value INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  reward_claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(goal_id, user_id)
);

-- Ranking history for charts
CREATE TABLE public.ranking_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  cards_created INTEGER DEFAULT 0,
  cards_completed INTEGER DEFAULT 0,
  hours_logged NUMERIC DEFAULT 0,
  badges_count INTEGER DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, recorded_at)
);

-- Push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Weekly goals policies
CREATE POLICY "Members can view weekly goals"
  ON public.weekly_goals FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Admins can manage weekly goals"
  ON public.weekly_goals FOR ALL
  USING (has_admin_access(auth.uid(), workspace_id));

-- User goal progress policies
CREATE POLICY "Users can view their own progress"
  ON public.user_goal_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.user_goal_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert progress"
  ON public.user_goal_progress FOR INSERT
  WITH CHECK (true);

-- Ranking history policies
CREATE POLICY "Members can view ranking history"
  ON public.ranking_history FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can insert ranking history"
  ON public.ranking_history FOR INSERT
  WITH CHECK (true);

-- Push subscriptions policies
CREATE POLICY "Users can manage their own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_weekly_goals_week ON public.weekly_goals(workspace_id, week_start);
CREATE INDEX idx_user_goal_progress_goal ON public.user_goal_progress(goal_id, user_id);
CREATE INDEX idx_ranking_history_user ON public.ranking_history(workspace_id, user_id, recorded_at);
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id, is_active);

-- Function to update goal progress
CREATE OR REPLACE FUNCTION public.update_goal_progress(
  p_workspace_id UUID,
  p_user_id UUID,
  p_goal_type TEXT,
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_goal_id UUID;
  v_target INTEGER;
  v_current INTEGER;
  v_completed BOOLEAN;
  v_reward_badge TEXT;
BEGIN
  -- Get current week's goal
  SELECT id, target_value, reward_badge INTO v_goal_id, v_target, v_reward_badge
  FROM public.weekly_goals
  WHERE workspace_id = p_workspace_id
    AND goal_type = p_goal_type
    AND week_start = date_trunc('week', CURRENT_DATE)::DATE
    AND is_active = true;
  
  IF v_goal_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Update or insert progress
  INSERT INTO public.user_goal_progress (goal_id, user_id, current_value)
  VALUES (v_goal_id, p_user_id, p_increment)
  ON CONFLICT (goal_id, user_id)
  DO UPDATE SET 
    current_value = user_goal_progress.current_value + p_increment,
    updated_at = now()
  RETURNING current_value, completed INTO v_current, v_completed;
  
  -- Check if goal was just completed
  IF v_current >= v_target AND NOT v_completed THEN
    -- Mark as completed
    UPDATE public.user_goal_progress
    SET completed = true, completed_at = now()
    WHERE goal_id = v_goal_id AND user_id = p_user_id;
    
    -- Award badge if specified
    IF v_reward_badge IS NOT NULL THEN
      PERFORM award_badge(p_user_id, p_workspace_id, v_reward_badge);
    END IF;
    
    -- Create notification
    INSERT INTO public.notifications (user_id, workspace_id, type, title, message, metadata)
    VALUES (
      p_user_id,
      p_workspace_id,
      'badge_earned',
      'Meta semanal concluída!',
      'Parabéns! Você atingiu sua meta semanal.',
      jsonb_build_object('goal_id', v_goal_id, 'goal_type', p_goal_type)
    );
  END IF;
END;
$$;

-- Trigger to update card goals
CREATE OR REPLACE FUNCTION public.update_card_goals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cards created goal
  IF TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL THEN
    PERFORM update_goal_progress(NEW.workspace_id, NEW.created_by, 'cards_created', 1);
  END IF;
  
  -- Cards completed goal
  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.owner_id IS NOT NULL THEN
    PERFORM update_goal_progress(NEW.workspace_id, NEW.owner_id, 'cards_completed', 1);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_card_update_goals
  AFTER INSERT OR UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_card_goals();

-- Trigger to update time goals
CREATE OR REPLACE FUNCTION public.update_time_goals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hours INTEGER;
BEGIN
  v_hours := FLOOR(NEW.duration_seconds / 3600);
  IF v_hours > 0 THEN
    PERFORM update_goal_progress(NEW.workspace_id, NEW.user_id, 'hours_logged', v_hours);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_time_entry_update_goals
  AFTER INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_time_goals();

-- Trigger to update comment goals
CREATE OR REPLACE FUNCTION public.update_comment_goals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.cards
  WHERE id = NEW.card_id;
  
  PERFORM update_goal_progress(v_workspace_id, NEW.user_id, 'comments_made', 1);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_update_goals
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comment_goals();