-- Quem concluiu o card.
-- Ate aqui so existia QUANDO (completed_at); sem o QUEM nenhuma analise por pessoa era possivel
-- e o feed de atividade mostrava "Alguem concluiu ...".

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cards.completed_by IS
  'Quem moveu o card para entregue. NULL = desconhecido (motor de automacoes, API, ou conclusao antiga que o historico nao permitiu reconstituir).';

-- O gatilho que ja carimbava completed_at passa a carimbar tambem o autor.
CREATE OR REPLACE FUNCTION public.set_card_completed_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- Rede de seguranca no banco: alem da UI, escrevem em cards a public-api, o
  -- motor de automacoes e correcoes manuais. A regra de conclusao nao pode
  -- depender de cada caminho lembrar dela.
  if TG_OP = 'INSERT' then
    if NEW.status = 'delivered' and NEW.completed_at is null then
      NEW.completed_at := now();
      NEW.completed_by := coalesce(NEW.completed_by, auth.uid());
    end if;
    return NEW;
  end if;

  if NEW.status is distinct from OLD.status then
    if NEW.status = 'delivered' then
      -- respeita data explicita (backfill, importacao)
      if NEW.completed_at is null then
        NEW.completed_at := now();
      end if;
      -- auth.uid() e nulo em caminhos sem usuario (automacao, service role): nesse caso fica desconhecido
      NEW.completed_by := coalesce(NEW.completed_by, auth.uid());
    elsif NEW.status <> 'archived' then
      -- reabriu: a data antiga mentiria, e o autor antigo tambem. Arquivar preserva,
      -- porque arquivar e o "excluir" do app, nao um retrocesso no fluxo.
      NEW.completed_at := null;
      NEW.completed_by := null;
    end if;
  end if;

  return NEW;
end;
$function$;

-- Reconstitui o autor das conclusoes antigas pelo historico: primeiro a transicao para a etapa
-- "concluido" (card_stage_history.triggered_by), depois o log de auditoria (status -> delivered).
-- Onde as duas fontes existem elas coincidem. Sem disparar gatilhos (nao mexe em updated_at nem
-- em metas), por isso o replica role so durante esta atualizacao.
SET session_replication_role = replica;

UPDATE public.cards c
SET completed_by = x.autor
FROM (
  SELECT c2.id,
         coalesce(est.triggered_by, aud.user_id) AS autor
  FROM public.cards c2
  LEFT JOIN LATERAL (
    SELECT h.triggered_by FROM public.card_stage_history h
    WHERE h.card_id = c2.id AND h.to_stage = 'concluido' AND h.triggered_by IS NOT NULL
    ORDER BY h.created_at DESC LIMIT 1
  ) est ON true
  LEFT JOIN LATERAL (
    SELECT a.user_id FROM public.audit_logs a
    WHERE a.entity_type = 'cards' AND a.entity_id = c2.id AND a.action = 'update'
      AND a.new_data->>'status' = 'delivered' AND (a.old_data->>'status') IS DISTINCT FROM 'delivered'
      AND a.user_id IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1
  ) aud ON true
  WHERE c2.completed_at IS NOT NULL AND c2.completed_by IS NULL
) x
WHERE c.id = x.id AND x.autor IS NOT NULL;

RESET session_replication_role;
