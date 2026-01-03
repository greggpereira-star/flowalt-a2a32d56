# Social Media Module - QA Checklist

## Matriz de Permissões (Roles × Planos × Estados)

### Legenda
- ✅ Permitido
- ❌ Bloqueado
- 🔒 Bloqueado por Plano
- 🔑 Bloqueado por Role
- ⚠️ Bloqueado por Estado

### Status de Implementação
- **PASS** - Implementado e funcionando
- **FAIL** - Implementado mas com erro
- **WAITING_SECRETS** - Aguardando configuração de secrets

---

## 1. Ações por Role

| Ação | Owner | Admin | Coordinator | Collab (com card) | Collab (sem card) |
|------|-------|-------|-------------|-------------------|-------------------|
| connect | ✅ | ✅ | ✅ | ❌ | ❌ |
| fetch_assets | ✅ | ✅ | ✅ | ❌ | ❌ |
| select_asset | ✅ | ✅ | ✅ | ❌ | ❌ |
| test | ✅ | ✅ | ✅ | ❌ | ❌ |
| refresh | ✅ | ✅ | ✅ | ❌ | ❌ |
| disconnect | ✅ | ✅ | ❌ | ❌ | ❌ |
| smoke_test | ✅ | ✅ | ❌ | ❌ | ❌ |
| publish | ✅ | ✅ | ✅ | ✅* | ❌ |
| metrics_sync | ✅ | ✅ | ✅ | ✅* | ❌ |

*Requer permissão no card específico

### GOX Messages por Role
- **Elevated roles não permitido**: "Apenas Owner, Admin ou Coordinator podem gerenciar conexões de plataformas."
- **Smoke test restrito**: "Apenas Owner ou Admin podem executar o Smoke Test."
- **Sem permissão no card**: "Você não tem permissão para acessar este card."

---

## 2. Ações por Plano

| Ação | Free | Pro | Enterprise |
|------|------|-----|------------|
| connect (1 plataforma) | ✅ | ✅ | ✅ |
| connect (múltiplas) | ❌ | ✅ | ✅ |
| publish | 🔒 | ✅ | ✅ |
| metrics_basic | 🔒 | ✅ | ✅ |
| metrics_advanced | 🔒 | 🔒 | ✅ |
| reports | 🔒 | 🔒 | ✅ |
| smoke_test | 🔒 | ✅ | ✅ |

### GOX Messages por Plano
- **Publicação bloqueada**: "Publicação em redes sociais disponível no plano Pro ou Enterprise."
- **Métricas bloqueadas**: "Métricas de redes sociais disponíveis no plano Pro ou Enterprise."
- **Múltiplas plataformas**: "Conexão com múltiplas plataformas disponível no plano Pro ou Enterprise."

---

## 3. Estados de Conexão

| Estado | Descrição | Ações Permitidas | Próxima Ação |
|--------|-----------|------------------|--------------|
| `disconnected` | Sem conexão | connect | - |
| `pending_assets` | OAuth ok, sem asset | fetch_assets, select_asset | Selecionar ativo |
| `connected` | Pronto para uso | publish, metrics, test, refresh | - |
| `expiring` | Token expira em < 7 dias | refresh, publish, metrics | Renovar token |
| `expired` | Token expirado | refresh, reconnect | Renovar ou reconectar |
| `error` | Erro na conexão | reconnect, test | Verificar e reconectar |

### GOX Messages por Estado
- **Sem asset selecionado**: "Selecione uma Página/Conta/Canal antes de concluir a conexão."
- **Token expirado**: "Token expirado. Clique em Renovar para continuar usando."
- **Token expirando**: "Seu token expira em breve. Recomendamos renovar."
- **Erro na conexão**: "Erro na conexão. Verifique as credenciais e tente novamente."

---

## 4. Validação de Secrets

| Plataforma | Secrets Necessários | Status |
|------------|---------------------|--------|
| Meta (Facebook/Instagram) | `META_APP_ID`, `META_APP_SECRET` | WAITING_SECRETS |
| YouTube (Google) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | WAITING_SECRETS |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | WAITING_SECRETS |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | WAITING_SECRETS |
| Twitter/X | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | WAITING_SECRETS |
| Encryption | `TOKEN_ENCRYPTION_KEY` | WAITING_SECRETS |

### GOX Messages para Secrets
- **Secrets ausentes**: "Integração não configurada. Fale com o admin para adicionar as credenciais."
- **Encryption key faltando**: "Chave de criptografia não configurada. Contate o suporte."

---

## 5. Smoke Test Steps

| Step | Descrição | Validação |
|------|-----------|-----------|
| 0. Job Creation | Criar entrada em social_jobs | job_id retornado |
| 1. Secrets Check | Verificar secrets configurados | Todos presentes |
| 2. Token Validation | Verificar token válido | Não expirado |
| 3. Asset Check | Verificar asset selecionado | platform_account_id preenchido |
| 4. Connection Test | Testar API real | Resposta 200 |
| 5. Publish (se !dry_run) | Publicar post de teste | platform_post_id retornado |
| 6. Metrics Sync | Buscar métricas | Dados retornados |
| 7. Finalize | Atualizar job status | status = completed |

---

## 6. Domain Events Auditados

| Evento | Trigger | Payload Mínimo |
|--------|---------|----------------|
| `social_platform.oauth_started` | Início OAuth | workspace_id, platform_id, actor_id |
| `social_platform.oauth_completed` | Callback OAuth | workspace_id, platform_id, status |
| `social_platform.assets_fetched` | Buscar assets | workspace_id, platform_id, asset_count |
| `social_platform.asset_selected` | Selecionar asset | workspace_id, platform_id, asset_type, asset_id |
| `social_platform.connection_tested` | Testar conexão | workspace_id, platform_id, status |
| `social_platform.token_refreshed` | Renovar token | workspace_id, platform_id, status |
| `social_platform.disconnected` | Desconectar | workspace_id, platform_id |
| `social_smoke_test.started` | Iniciar smoke test | workspace_id, platform_id, job_id |
| `social_smoke_test.step_completed` | Step concluído | job_id, step_name, status |
| `social_smoke_test.failed` | Falha no smoke test | job_id, step_name, error_code |
| `social_smoke_test.completed` | Smoke test ok | job_id, summary |

---

## 7. Endpoints e Payloads

### Edge Functions

#### `social-oauth-start`
```json
POST /functions/v1/social-oauth-start
{
  "workspace_id": "uuid",
  "platform_id": "meta|youtube|linkedin|tiktok|twitter"
}
Response: { "auth_url": "https://..." }
```

#### `social-oauth-callback`
```
GET /functions/v1/social-oauth-callback?code=...&state=...
Response: HTTP 302 redirect to /marketing/platforms?oauth=success
```

#### `social-connection-assets`
```json
POST /functions/v1/social-connection-assets
{
  "workspace_id": "uuid",
  "platform_connection_id": "uuid"
}
Response: {
  "assets": [
    { "asset_type": "facebook_page", "asset_id": "123", "asset_name": "My Page" }
  ],
  "status": "ok"
}
```

#### `social-asset-select`
```json
POST /functions/v1/social-asset-select
{
  "workspace_id": "uuid",
  "platform_connection_id": "uuid",
  "asset_type": "facebook_page",
  "asset_id": "123"
}
Response: { "ok": true, "selected": { ... } }
```

#### `social-connection-test`
```json
POST /functions/v1/social-connection-test
{
  "workspace_id": "uuid",
  "platform_connection_id": "uuid"
}
Response: { "ok": true, "platform_id": "meta", "account_name": "..." }
```

#### `social-smoke-test`
```json
POST /functions/v1/social-smoke-test
{
  "workspace_id": "uuid",
  "platform_id": "meta",
  "platform_connection_id": "uuid",
  "dry_run": true
}
Response: {
  "ok": true,
  "job_id": "uuid",
  "steps": [
    { "name": "secrets_check", "ok": true, "detail": "..." }
  ],
  "next_action": null
}
```

---

## 8. Fluxo UX

### Conexão de Plataforma (Asset Selection)

1. **Usuário clica "Conectar"** → `social-oauth-start`
2. **Popup OAuth abre** → Usuário autoriza
3. **Callback processa** → `social-oauth-callback`
   - Tokens salvos (encrypted)
   - Status = `pending_assets`
4. **Wizard exibe "Selecionar Ativo"** → `social-connection-assets`
5. **Usuário seleciona Page/Channel** → `social-asset-select`
6. **Teste de conexão** → `social-connection-test`
7. **Status = `connected`** ✅

### Smoke Test (Admin/Owner)

1. **Acessa aba Plataformas** → Vê console de Smoke Test
2. **Seleciona plataforma conectada**
3. **Toggle dry_run (opcional)**
4. **Clica "Rodar Smoke Test"** → `social-smoke-test`
5. **Vê progresso em tempo real** (polling social_jobs)
6. **Resultado final com steps detalhados**

---

## 9. Checklist de Validação

### Pré-Produção

- [ ] Secrets configurados para ao menos 1 plataforma
- [ ] TOKEN_ENCRYPTION_KEY configurado
- [ ] Redirect URIs configurados nos apps das plataformas
- [ ] RLS policies ativas em todas as tabelas

### Funcional

- [ ] OAuth start gera URL válida
- [ ] OAuth callback salva tokens e faz redirect
- [ ] Assets são listados da API real
- [ ] Asset selection persiste no banco
- [ ] Connection test valida asset selecionado
- [ ] Smoke test executa todos os steps
- [ ] Domain events registrados para cada ação

### Segurança

- [ ] Tokens sempre encrypted em repouso
- [ ] RLS impede acesso cross-workspace
- [ ] Entitlements verificados server-side
- [ ] Roles verificados antes de ações sensíveis

---

## 10. Status Atual

| Item | Status |
|------|--------|
| Database migrations | ✅ PASS |
| Edge Functions criadas | ✅ PASS |
| Edge Functions deployadas | ✅ PASS |
| UI - Wizard com assets | ✅ PASS |
| UI - Smoke Test Console | ✅ PASS |
| Secrets configurados | ⏳ WAITING_SECRETS |
| Teste E2E | ⏳ WAITING_SECRETS |

---

*Última atualização: 2026-01-03*
