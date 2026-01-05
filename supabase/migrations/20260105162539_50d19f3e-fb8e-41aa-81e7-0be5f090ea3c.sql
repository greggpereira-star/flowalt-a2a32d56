-- Fix functions without search_path that are related to social posts
-- These are critical for security

-- Fix audit_social_post_changes
CREATE OR REPLACE FUNCTION public.audit_social_post_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO domain_events (workspace_id, event_type, aggregate_type, aggregate_id, payload)
  VALUES (
    COALESCE(NEW.workspace_id, OLD.workspace_id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'social_post.created'
      WHEN 'UPDATE' THEN 'social_post.updated'
      WHEN 'DELETE' THEN 'social_post.deleted'
    END,
    'social_post',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'operation', TG_OP,
      'old_data', CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
      'new_data', CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix generate_social_post_fingerprint
CREATE OR REPLACE FUNCTION public.generate_social_post_fingerprint()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Generate a fingerprint for duplicate detection
  NEW.content_fingerprint := md5(
    COALESCE(NEW.caption, '') || 
    COALESCE(NEW.platform, '') || 
    COALESCE(NEW.content_type, '') ||
    COALESCE(array_to_string(NEW.hashtags, ','), '')
  );
  RETURN NEW;
END;
$$;

-- Fix update_social_platform_assets_updated_at
CREATE OR REPLACE FUNCTION public.update_social_platform_assets_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;