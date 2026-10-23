-- Realtime: os responsaveis de uma demanda (card_members) entram na publicacao supabase_realtime.
--
-- Hoje, quando alguem troca o responsavel de uma demanda, o monitor e as telas de demandas so percebem na proxima busca
-- (ate 60 s). Com a tabela na publicacao, o hook useRealtimeCards recebe o evento e atualiza na hora.
--
-- Leitura protegida: card_members tem RLS ligado e a politica de SELECT restringe a quem pode ver o card; o Realtime aplica
-- a politica por usuario, entao ninguem recebe evento de uma demanda que nao poderia ler.
--
-- Custo: a tabela tem ~570 vinculos e recebe alteracoes quando se atribui ou troca responsavel. Cada alteracao vira um evento
-- apenas para quem esta com uma tela de demandas aberta (e o hook agrupa mudancas seguidas em uma atualizacao).
--
-- Aditiva e reversivel.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261022110000_realtime_responsaveis_das_demandas.sql"
--
-- Reversao:
--   alter publication supabase_realtime drop table public.card_members;

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'card_members'
  ) then
    alter publication supabase_realtime add table public.card_members;
  end if;
end $$;

commit;
