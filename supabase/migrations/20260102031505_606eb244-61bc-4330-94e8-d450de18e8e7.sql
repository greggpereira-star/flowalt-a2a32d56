-- =============================================
-- Tabelas de configuração do sistema - Somente super_admin pode modificar
-- =============================================

-- entitlement_registry - INSERT/UPDATE/DELETE para super_admin
CREATE POLICY "entitlement_registry_insert_policy"
ON public.entitlement_registry
FOR INSERT
WITH CHECK (is_platform_super_admin(auth.uid()));

CREATE POLICY "entitlement_registry_update_policy"
ON public.entitlement_registry
FOR UPDATE
USING (is_platform_super_admin(auth.uid()));

CREATE POLICY "entitlement_registry_delete_policy"
ON public.entitlement_registry
FOR DELETE
USING (is_platform_super_admin(auth.uid()));

-- plan_entitlements - INSERT/UPDATE/DELETE para super_admin
CREATE POLICY "plan_entitlements_insert_policy"
ON public.plan_entitlements
FOR INSERT
WITH CHECK (is_platform_super_admin(auth.uid()));

CREATE POLICY "plan_entitlements_update_policy"
ON public.plan_entitlements
FOR UPDATE
USING (is_platform_super_admin(auth.uid()));

CREATE POLICY "plan_entitlements_delete_policy"
ON public.plan_entitlements
FOR DELETE
USING (is_platform_super_admin(auth.uid()));

-- space_templates - INSERT/UPDATE/DELETE para super_admin
CREATE POLICY "space_templates_insert_policy"
ON public.space_templates
FOR INSERT
WITH CHECK (is_platform_super_admin(auth.uid()));

CREATE POLICY "space_templates_update_policy"
ON public.space_templates
FOR UPDATE
USING (is_platform_super_admin(auth.uid()));

CREATE POLICY "space_templates_delete_policy"
ON public.space_templates
FOR DELETE
USING (is_platform_super_admin(auth.uid()));