ALTER TABLE public.workspace_members
ADD CONSTRAINT workspace_members_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
