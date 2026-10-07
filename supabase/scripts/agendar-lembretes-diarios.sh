#!/usr/bin/env bash
# Agenda o resumo diario de lembretes (pg_cron + pg_net): segunda a sexta, 9h de Sao Paulo (12h UTC; a propria funcao
# confere o horario de Sao Paulo de novo). A chave de servico e lida de /opt/flowalt-supabase/.env e fica gravada no
# comando do job (tabela cron.job, so acessivel ao superusuario do banco).
#
# Antes de agendar, veja o que seria enviado, sem gravar nada (so conta):
#   bash supabase/scripts/medir-lembretes-diarios.sh
# Uso:     bash supabase/scripts/agendar-lembretes-diarios.sh
# Remover: docker exec -i supabase-db psql -U postgres -c "select cron.unschedule('lembretes-diarios')"
set -euo pipefail
KEY="$(grep -E '^SERVICE_ROLE_KEY=' /opt/flowalt-supabase/.env | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$KEY" ] || { echo "SERVICE_ROLE_KEY nao encontrada"; exit 1; }
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -v key="$KEY" <<'SQL'
select cron.schedule(
  'lembretes-diarios',
  '0 12 * * 1-5',
  format(
    $cmd$select net.http_post(
      url := 'http://kong:8000/functions/v1/lembretes-diarios',
      headers := jsonb_build_object('apikey', %L, 'Authorization', %L, 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )$cmd$, :'key', 'Bearer ' || :'key')
);
SQL
echo "Agendado. Conferir: docker exec -i supabase-db psql -U postgres -c \"select jobname, schedule, active from cron.job\""
