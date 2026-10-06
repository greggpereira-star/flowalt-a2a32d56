#!/usr/bin/env bash
# Agenda a rotina de lembretes e expiracao da Sala de Aprovacao (pg_cron + pg_net).
#
# Roda a cada 30 minutos, de segunda a sexta, das 9h as 18h de Sao Paulo (12h as 21h UTC; a propria funcao
# confere o horario de Sao Paulo de novo). A chave de servico e lida de /opt/flowalt-supabase/.env e fica
# gravada no comando do job (tabela cron.job, so acessivel ao superusuario do banco).
#
# Uso:    bash supabase/scripts/agendar-lembretes-aprovacao.sh
# Remover: docker exec -i supabase-db psql -U postgres -c "select cron.unschedule('approval-reminders')"
set -euo pipefail
KEY="$(grep -E '^SERVICE_ROLE_KEY=' /opt/flowalt-supabase/.env | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$KEY" ] || { echo "SERVICE_ROLE_KEY nao encontrada"; exit 1; }
docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 -v key="$KEY" <<'SQL'
select cron.schedule(
  'approval-reminders',
  '*/30 12-21 * * 1-5',
  format(
    $cmd$select net.http_post(
      url := 'http://kong:8000/functions/v1/approval-reminders',
      headers := jsonb_build_object('apikey', %L, 'Authorization', %L, 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )$cmd$, :'key', 'Bearer ' || :'key')
);
SQL
echo "Agendado. Conferir: docker exec -i supabase-db psql -U postgres -c \"select jobname, schedule, active from cron.job\""
