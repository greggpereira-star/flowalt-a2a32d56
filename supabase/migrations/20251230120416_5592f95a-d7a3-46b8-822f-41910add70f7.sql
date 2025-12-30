-- Tabela de níveis do sistema
CREATE TABLE public.user_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  total_score integer NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  level_name text NOT NULL DEFAULT 'Iniciante',
  next_level_score integer NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- RLS para user_levels
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own level"
ON public.user_levels FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Members can view workspace levels"
ON public.user_levels FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can manage levels"
ON public.user_levels FOR ALL
USING (true);

-- Tabela de histórico de notificações de email
CREATE TABLE public.email_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS para email_notifications
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email notifications"
ON public.email_notifications FOR SELECT
USING (has_admin_access(auth.uid(), workspace_id));

CREATE POLICY "System can insert email notifications"
ON public.email_notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update email notifications"
ON public.email_notifications FOR UPDATE
USING (true);

-- Função para calcular nível baseado em pontuação
CREATE OR REPLACE FUNCTION calculate_user_level(score integer)
RETURNS TABLE(level integer, level_name text, next_level_score integer)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF score < 100 THEN
    RETURN QUERY SELECT 1, 'Iniciante'::text, 100;
  ELSIF score < 300 THEN
    RETURN QUERY SELECT 2, 'Aprendiz'::text, 300;
  ELSIF score < 600 THEN
    RETURN QUERY SELECT 3, 'Colaborador'::text, 600;
  ELSIF score < 1000 THEN
    RETURN QUERY SELECT 4, 'Profissional'::text, 1000;
  ELSIF score < 1500 THEN
    RETURN QUERY SELECT 5, 'Especialista'::text, 1500;
  ELSIF score < 2500 THEN
    RETURN QUERY SELECT 6, 'Expert'::text, 2500;
  ELSIF score < 4000 THEN
    RETURN QUERY SELECT 7, 'Mestre'::text, 4000;
  ELSIF score < 6000 THEN
    RETURN QUERY SELECT 8, 'Grão-Mestre'::text, 6000;
  ELSIF score < 10000 THEN
    RETURN QUERY SELECT 9, 'Lenda'::text, 10000;
  ELSE
    RETURN QUERY SELECT 10, 'Imortal'::text, 99999;
  END IF;
END;
$$;

-- Função para atualizar nível do usuário
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_level record;
BEGIN
  SELECT * INTO new_level FROM calculate_user_level(NEW.total_score);
  
  NEW.current_level := new_level.level;
  NEW.level_name := new_level.level_name;
  NEW.next_level_score := new_level.next_level_score;
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar nível automaticamente
CREATE TRIGGER update_user_level_trigger
BEFORE INSERT OR UPDATE OF total_score ON public.user_levels
FOR EACH ROW
EXECUTE FUNCTION update_user_level();

-- Função para adicionar pontos ao usuário
CREATE OR REPLACE FUNCTION add_user_score(
  p_user_id uuid,
  p_workspace_id uuid,
  p_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_levels (user_id, workspace_id, total_score)
  VALUES (p_user_id, p_workspace_id, p_points)
  ON CONFLICT (user_id, workspace_id)
  DO UPDATE SET total_score = user_levels.total_score + p_points;
END;
$$;

-- Trigger para adicionar pontos quando completar metas
CREATE OR REPLACE FUNCTION on_goal_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  goal_record record;
BEGIN
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    SELECT wg.reward_points, wg.workspace_id INTO goal_record
    FROM weekly_goals wg
    WHERE wg.id = NEW.goal_id;
    
    IF goal_record.reward_points IS NOT NULL THEN
      PERFORM add_user_score(NEW.user_id, goal_record.workspace_id, goal_record.reward_points);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_goal_completed_trigger
AFTER UPDATE ON public.user_goal_progress
FOR EACH ROW
EXECUTE FUNCTION on_goal_completed();

-- Trigger para adicionar pontos ao ganhar badge
CREATE OR REPLACE FUNCTION on_badge_earned_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM add_user_score(NEW.user_id, NEW.workspace_id, 50);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_badge_earned_score_trigger
AFTER INSERT ON public.user_badges
FOR EACH ROW
EXECUTE FUNCTION on_badge_earned_score();