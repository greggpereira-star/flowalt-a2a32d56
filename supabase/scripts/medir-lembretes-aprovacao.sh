#!/usr/bin/env bash
# Mede o que a rotina de lembretes faria agora, sem enviar nem gravar nada (ignora o horario comercial).
set -euo pipefail
KEY="$(grep -E '^SERVICE_ROLE_KEY=' /opt/flowalt-supabase/.env | head -1 | cut -d= -f2- | tr -d '"')"
curl -s -m 60 -X POST 'http://localhost:8000/functions/v1/approval-reminders?dry_run=1&force=1' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{}'
echo
