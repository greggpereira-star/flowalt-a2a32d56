-- Onda 0 (blueprint V3): a visibilidade "restricted" de um card passa a valer.
--
-- Problema: a politica cards_view_via_spaces liberava a leitura de qualquer card para qualquer membro do
-- workspace que tenha acesso ao espaco do card. Como politicas de RLS somam com OR, ela anulava o filtro de
-- cards_select_no_recursion, que ja exclui os cards "restricted" de quem nao e admin, dono, criador ou membro do card.
--
-- Efeito hoje: nenhum, porque os cards estao todos como "inherit". O efeito aparece assim que alguem marcar um
-- card como restrito (ou assim que a Sala de Aprovacao depender disso).
--
-- Teste feito em transacao com ROLLBACK (05/10/2026): com um card restrito, Ana e Brendon (membros sem vinculo)
-- enxergavam o card antes (count 1) e deixam de enxergar depois (count 0); Matheus (membro do card) e o criador
-- continuam enxergando. Para cards "inherit" nada muda: cards_select_no_recursion ja os libera para membros.
--
-- Aplicar (DDL de seguranca, a pedido do guardrail 15 do blueprint):
--   ssh mchat-vps "docker exec -i supabase-db psql -U postgres" < supabase/migrations/20261005150000_cards_respeita_visibilidade_restrita.sql
--
-- Reversao (se algo inesperado aparecer):
--   create policy cards_view_via_spaces on public.cards for select using (exists (
--     select 1 from card_spaces cs join spaces s on s.id = cs.space_id
--     join workspace_members wm on wm.workspace_id = s.workspace_id
--     where cs.card_id = cards.id and wm.user_id = auth.uid()));

begin;
drop policy if exists cards_view_via_spaces on public.cards;
commit;
