-- Onda 0 (blueprint V3): reconcilia status x etapa nos casos que a evidencia resolve sem duvida.
--
-- 1) SALYSSA - IDENTIDADE VISUAL: status "delivered" com completed_at preenchido (28/09), mas etapa "planejamento".
--    Entregue e concluido: a etapa correta e "concluido".
-- 2) 14 cards arquivados com o UUID da etapa Backlog no lugar do nome: troca pelo nome ("backlog").
--
-- NAO mexe em (precisam de decisao humana, ver relatorio da Onda 0):
--   - M&K - MODELO LOIRA (COMPLETO): status "approved", etapa "em_producao", atualizado hoje.
--   - Stories 2 - M&K: status "briefing" em "planejamento" (nao existe etapa "briefing"; e o desenho atual).
--   - 7 arquivados sem etapa.
--
-- session_replication_role = replica evita disparar gatilhos (updated_at, notificacoes, automacoes, historico),
-- para a correcao nao alterar datas nem gerar eventos de mentira.

begin;
set local session_replication_role = replica;

update public.cards
   set current_stage = 'concluido'
 where id = 'b2f0ac22-96d3-4fa2-a89e-50acb937a9f4'
   and status = 'delivered' and current_stage = 'planejamento';

update public.cards
   set current_stage = 'backlog'
 where current_stage = 'c639bf2f-8cad-4149-86cd-f28a72204513'
   and status = 'archived';

commit;
