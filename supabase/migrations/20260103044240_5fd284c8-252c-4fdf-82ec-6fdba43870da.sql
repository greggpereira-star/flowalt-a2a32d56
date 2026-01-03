
-- Corrigir search_path nas funções que faltou
CREATE OR REPLACE FUNCTION public.generate_social_post_fingerprint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.content_fingerprint := encode(
    sha256(
      (COALESCE(NEW.caption, '') || 
       COALESCE(NEW.platform, '') || 
       COALESCE(NEW.content_type, '') || 
       COALESCE(NEW.card_id::text, '') ||
       COALESCE(NEW.media_urls::text, '[]') ||
       COALESCE(to_char(NEW.scheduled_at, 'YYYY-MM-DD HH24:MI'), ''))::bytea
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_social_post_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  valid_transitions JSONB := '{
    "draft": ["pending_approval", "scheduled", "archived"],
    "pending_approval": ["scheduled", "draft", "archived"],
    "scheduled": ["publishing", "error", "draft", "archived"],
    "publishing": ["published", "error", "failed"],
    "published": ["archived"],
    "failed": ["scheduled", "draft", "archived"],
    "error": ["scheduled", "draft", "archived"],
    "archived": []
  }'::JSONB;
  allowed_targets JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  allowed_targets := valid_transitions -> OLD.status;
  
  IF allowed_targets IS NULL OR NOT (allowed_targets ? NEW.status) THEN
    RAISE EXCEPTION 'Transição de status inválida: % -> %. Transições permitidas: %', 
      OLD.status, NEW.status, allowed_targets;
  END IF;
  
  INSERT INTO domain_events (workspace_id, event_type, entity_type, entity_id, payload, actor_id)
  VALUES (
    NEW.workspace_id,
    'social_post.status_changed',
    'social_post',
    NEW.id,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'card_id', NEW.card_id,
      'platform', NEW.platform
    ),
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
  
  RETURN NEW;
END;
$$;
