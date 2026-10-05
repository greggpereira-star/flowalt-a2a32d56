-- Tres tabelas estavam com RLS ligado e NENHUMA politica (acesso negado a todos os usuarios):
-- space_custom_field_definitions, card_custom_fields e folder_templates.
-- Efeito visivel: sumia o bloco "Campos Social Media" (Data de Postagem) do card e o quadro de Postagens
-- ficava sem datas. Politicas abaixo seguem o padrao de comments/checklists.

-- Definicoes dos campos por tipo de space: membros leem, admins gerenciam
CREATE POLICY "space_custom_field_definitions_select_members"
  ON public.space_custom_field_definitions FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "space_custom_field_definitions_admin_manage"
  ON public.space_custom_field_definitions FOR ALL TO authenticated
  USING (has_admin_access(auth.uid(), workspace_id))
  WITH CHECK (has_admin_access(auth.uid(), workspace_id));

-- Valores dos campos no card: quem enxerga o card (a RLS de cards continua valendo na subconsulta)
CREATE POLICY "card_custom_fields_select"
  ON public.card_custom_fields FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c
                 WHERE c.id = card_custom_fields.card_id AND is_workspace_member(auth.uid(), c.workspace_id)));
CREATE POLICY "card_custom_fields_insert"
  ON public.card_custom_fields FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cards c
                      WHERE c.id = card_custom_fields.card_id AND is_workspace_member(auth.uid(), c.workspace_id)));
CREATE POLICY "card_custom_fields_update"
  ON public.card_custom_fields FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c
                 WHERE c.id = card_custom_fields.card_id AND is_workspace_member(auth.uid(), c.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cards c
                      WHERE c.id = card_custom_fields.card_id AND is_workspace_member(auth.uid(), c.workspace_id)));
CREATE POLICY "card_custom_fields_delete"
  ON public.card_custom_fields FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cards c
                 WHERE c.id = card_custom_fields.card_id AND is_workspace_member(auth.uid(), c.workspace_id)));

-- Templates de pasta: mesma regra da migracao 20260102061121 (que se perdeu)
CREATE POLICY "folder_templates_select_authenticated"
  ON public.folder_templates FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
-- O app grava os campos com upsert(onConflict: 'card_id,field_key'); sem esta restricao o ON CONFLICT falha
-- ("there is no unique or exclusion constraint matching the ON CONFLICT specification") e a data de postagem nao salva.
CREATE UNIQUE INDEX IF NOT EXISTS card_custom_fields_card_id_field_key_key
  ON public.card_custom_fields (card_id, field_key);
CREATE UNIQUE INDEX IF NOT EXISTS space_custom_field_definitions_ws_type_key_key
  ON public.space_custom_field_definitions (workspace_id, space_type, field_key);
-- Quem pode CRIAR e EDITAR itens do checklist (admin, dono, criador ou membro do card) tambem precisa poder EXCLUIR.
-- Antes a exclusao so valia para admin, dono do card ou responsavel pelo item; para os demais o DELETE afetava 0 linhas, sem erro.
CREATE OR REPLACE FUNCTION public.can_delete_checklist(_user_id uuid, _checklist_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.checklists ch
    JOIN public.cards c ON c.id = ch.card_id
    WHERE ch.id = _checklist_id
    AND (
      has_admin_access(_user_id, c.workspace_id)
      OR ch.assignee_id = _user_id
      OR c.owner_id = _user_id
      OR c.created_by = _user_id
      OR EXISTS (SELECT 1 FROM public.card_members cm WHERE cm.card_id = c.id AND cm.user_id = _user_id)
    )
  )
$function$;
