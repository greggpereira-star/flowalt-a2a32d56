-- Banco de Ideias — fila de pedidos para o agente de copy (plano B).
-- A equipe pede análise/roteiros pelo Flowalt; o agente processa a fila fora do app e grava o resultado.
-- Segurança: membros do workspace leem e criam pedidos (como donos do pedido); só o servidor atualiza o status.

CREATE TABLE IF NOT EXISTS public.idea_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  reference_id  uuid NOT NULL REFERENCES public.idea_references(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('analise', 'roteiros')),
  client_id     uuid,                      -- obrigatório para 'roteiros'
  options       jsonb,                     -- quantidade, duração, objetivo, formato, instruções
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'pronto', 'erro')),
  error         text,
  result        jsonb,                     -- ex.: lacunas do briefing
  requested_by  uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  CONSTRAINT idea_requests_roteiros_cliente CHECK (kind <> 'roteiros' OR client_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_idea_requests_status ON public.idea_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_idea_requests_ref ON public.idea_requests (reference_id, created_at DESC);

-- Evita pedido repetido enquanto o anterior ainda não terminou.
CREATE UNIQUE INDEX IF NOT EXISTS uq_idea_requests_aberto
  ON public.idea_requests (reference_id, kind, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('pendente', 'processando');

ALTER TABLE public.idea_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS idea_requests_select ON public.idea_requests;
CREATE POLICY idea_requests_select ON public.idea_requests
  FOR SELECT USING (user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS idea_requests_insert ON public.idea_requests;
CREATE POLICY idea_requests_insert ON public.idea_requests
  FOR INSERT WITH CHECK (
    user_has_workspace_access(workspace_id)
    AND requested_by = auth.uid()
    AND status = 'pendente'
  );

-- Quem pediu pode cancelar enquanto ainda está pendente; admin e coordenação também.
DROP POLICY IF EXISTS idea_requests_delete ON public.idea_requests;
CREATE POLICY idea_requests_delete ON public.idea_requests
  FOR DELETE USING (
    (requested_by = auth.uid() AND status = 'pendente')
    OR user_is_workspace_admin(workspace_id)
    OR has_role(auth.uid(), workspace_id, 'coordinator'::app_role)
  );
