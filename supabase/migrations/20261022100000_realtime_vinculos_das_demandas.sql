-- Realtime: as tabelas que ligam uma demanda ao espaco e a pasta entram na publicacao supabase_realtime.
--
-- Diagnostico (22/10/2026, medido): o quadro de demandas nao atualizava ao vivo. O hook useRealtimeCards assinava cards,
-- card_spaces e card_folders no MESMO canal, mas card_spaces e card_folders nao estavam na publicacao. Nesse caso o Realtime
-- aceita a assinatura (status SUBSCRIBED) e nao entrega evento nenhum, nem o de cards. Medido com um usuario autenticado:
--   canal so com cards                          -> INSERT, UPDATE e DELETE entregues
--   canal igual ao do hook (3 tabelas)          -> SUBSCRIBED e zero eventos
--
-- Por que estas duas: a demanda so aparece no quadro de um espaco depois que existe a linha em card_spaces (o quadro busca
-- com inner join nessa tabela), e o aplicativo cria a demanda em duas etapas (cards e, em seguida, card_spaces). Sem
-- card_spaces na publicacao, uma demanda nova pode chegar ao navegador antes do vinculo e ficar invisivel ate recarregar.
--
-- As politicas de leitura (RLS) das duas tabelas ja restringem a membros do espaco/pasta; o Realtime as aplica por
-- usuario, entao ninguem recebe evento de demanda que nao poderia ler.
--
-- Aditiva e reversivel.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261022100000_realtime_vinculos_das_demandas.sql"
--
-- Reversao:
--   alter publication supabase_realtime drop table public.card_spaces, public.card_folders;

begin;

do $$
declare
  t text;
begin
  foreach t in array array['card_spaces', 'card_folders'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
