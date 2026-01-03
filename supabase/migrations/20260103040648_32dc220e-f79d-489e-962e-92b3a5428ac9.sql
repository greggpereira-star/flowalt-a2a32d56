
-- Criar trigger de auditoria para social_posts
DROP TRIGGER IF EXISTS audit_social_posts_v2 ON public.social_posts;

CREATE TRIGGER audit_social_posts_v2
AFTER INSERT OR UPDATE OR DELETE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.audit_social_post_changes_v2();
