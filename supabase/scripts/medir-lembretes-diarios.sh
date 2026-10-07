#!/usr/bin/env bash
# Mede o que o resumo diario enviaria agora, sem gravar nada (dry_run=1) e ignorando o horario (force=1).
set -euo pipefail
KEY="$(grep -E '^SERVICE_ROLE_KEY=' /opt/flowalt-supabase/.env | head -1 | cut -d= -f2- | tr -d '"')"
curl -s -m 60 -X POST 'http://localhost:8000/functions/v1/lembretes-diarios?dry_run=1&force=1' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{}'
echo
