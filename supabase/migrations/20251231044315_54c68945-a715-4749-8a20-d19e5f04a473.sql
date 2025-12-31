-- Allow moving from Planejamento/A Fazer back to Backlog (backward transition)
INSERT INTO public.workflow_transitions (workflow_id, from_stage_id, to_stage_id, is_forward, is_backward)
SELECT
  ws_from.workflow_id,
  ws_from.id,
  ws_to.id,
  false,
  true
FROM public.workflow_stages ws_from
JOIN public.workflow_stages ws_to
  ON ws_to.workflow_id = ws_from.workflow_id
WHERE ws_from.slug = 'planejamento'
  AND ws_to.slug = 'backlog'
  AND NOT EXISTS (
    SELECT 1
    FROM public.workflow_transitions t
    WHERE t.workflow_id = ws_from.workflow_id
      AND t.from_stage_id = ws_from.id
      AND t.to_stage_id = ws_to.id
  );