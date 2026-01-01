
-- Criar policy de SELECT para cards
-- Membros do workspace podem ver os cards do workspace
CREATE POLICY "Members can view workspace cards" 
ON public.cards 
FOR SELECT 
USING (is_workspace_member(auth.uid(), workspace_id));
