-- Onda 6: limite de rodadas de ajuste contratado, por cliente.
-- Hoje o contrato guarda o escopo so em texto livre (scope_limits, vazio em todos os clientes). Para o radar comparar
-- as rodadas de um card com o combinado, o limite precisa ser um numero. Nulo = nao definido: nenhum alerta e gerado.
-- Rodadas contam por card (peca): e o numero de vezes que a peca voltou para ajuste.
alter table public.client_cards
  add column if not exists revision_rounds_limit integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_cards_revision_rounds_limit_chk') then
    alter table public.client_cards
      add constraint client_cards_revision_rounds_limit_chk check (revision_rounds_limit is null or revision_rounds_limit >= 0);
  end if;
end $$;

comment on column public.client_cards.revision_rounds_limit is
  'Rodadas de ajuste contratadas por peca. Nulo = nao definido (sem alerta).';
