-- Trigger para notificar level up
CREATE OR REPLACE FUNCTION notify_level_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_level INTEGER;
  new_level INTEGER;
  level_info RECORD;
BEGIN
  old_level := COALESCE(OLD.current_level, 0);
  new_level := NEW.current_level;
  
  -- Check if level increased
  IF new_level > old_level THEN
    -- Get level info
    SELECT * INTO level_info FROM calculate_user_level(NEW.total_score);
    
    -- Create notification
    INSERT INTO notifications (user_id, workspace_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      NEW.workspace_id,
      'level_up',
      'Level Up! 🆙',
      'Você subiu para o nível ' || new_level || ' - ' || level_info.level_name || '!',
      jsonb_build_object(
        'old_level', old_level,
        'new_level', new_level,
        'level_name', level_info.level_name,
        'total_score', NEW.total_score
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for level up notifications
DROP TRIGGER IF EXISTS on_level_up_trigger ON user_levels;
CREATE TRIGGER on_level_up_trigger
AFTER UPDATE OF current_level ON user_levels
FOR EACH ROW
EXECUTE FUNCTION notify_level_up();

-- Enable realtime for user_levels
ALTER TABLE user_levels REPLICA IDENTITY FULL;

-- Create table for analytics snapshots
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, snapshot_date)
);

-- RLS for analytics_snapshots
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view analytics"
ON analytics_snapshots FOR SELECT
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "System can manage analytics"
ON analytics_snapshots FOR ALL
USING (true);