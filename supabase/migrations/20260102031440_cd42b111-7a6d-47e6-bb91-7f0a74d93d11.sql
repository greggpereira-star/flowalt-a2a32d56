-- =============================================
-- Mais políticas faltantes
-- =============================================

-- attachments - falta UPDATE
CREATE POLICY "attachments_update_policy"
ON public.attachments
FOR UPDATE
USING (user_id = auth.uid());

-- user_badges - falta UPDATE
CREATE POLICY "user_badges_update_policy"
ON public.user_badges
FOR UPDATE
USING (user_id = auth.uid());

-- automation_logs - falta INSERT (para sistema gravar logs)
CREATE POLICY "automation_logs_insert_policy"
ON public.automation_logs
FOR INSERT
WITH CHECK (true);

-- webhook_deliveries - falta INSERT/UPDATE
CREATE POLICY "webhook_deliveries_insert_policy"
ON public.webhook_deliveries
FOR INSERT
WITH CHECK (true);

CREATE POLICY "webhook_deliveries_update_policy"
ON public.webhook_deliveries
FOR UPDATE
USING (true);