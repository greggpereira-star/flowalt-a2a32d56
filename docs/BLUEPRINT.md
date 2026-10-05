# Blueprint Flowalt V3 — Entrega, Aprovação, Conversa e Inteligência

> Documento de produto e engenharia. Escrito sob quatro visões sêniores: engenharia de software, engenharia de projetos, UX/UI e design de app.
> Data-base dos números: 03/10/2026, workspace ALT AGENCY. Todo número aqui foi medido no banco ou lido no código; o que é estimativa ou hipótese está rotulado.
> Regra deste documento: **nada aqui quebra o que já funciona.** Tudo é aditivo, atrás de flag, com rota paralela e plano de reversão.

---

## 0. Tese em um parágrafo

O Flowalt hoje é um **gestor de produção para agência**: cards que circulam por spaces (Audiovisual, Social Media, Designer...), vinculados a clientes, com agenda e financeiro. É isso que a equipe usa (5 a 7 pessoas por semana). O que falta é a **metade externa do trabalho**: o momento em que a entrega sai da agência, o cliente olha, aprova ou pede ajuste, e a equipe conversa sobre isso. Hoje esse momento acontece fora do sistema (WhatsApp, e-mail), então o Flowalt não enxerga **por que as entregas atrasam**. Os dados mostram o custo: só **7% das entregas saíram no prazo** nos últimos 30 dias (mediana de 5 dias de atraso), e o tempo mediano de entrega é de 8 dias. A V3 fecha esse ciclo: **a aprovação do cliente vira uma etapa do fluxo, a conversa vive junto do card, e a inteligência passa a vigiar o ciclo inteiro.**

---

## 1. Diagnóstico: o que o Flowalt é hoje (fatos medidos)

### 1.1 Uso real
| Fato | Valor | Fonte |
|---|---|---|
| Pessoas ativas por semana | 5 a 7 (de 15 membros) | audit_logs, module_usage, access_logs |
| Workspaces com dados reais | 1 (ALT AGENCY); os outros 11 são resíduos de teste | contagem exata |
| Tabelas no schema `public` | 158 (sem backups), **63 com dados**, 95 vazias | contagem exata |
| Cards | 377 (55 não arquivados, 11 abertos) | banco |
| Cards com cliente | 234 de 377 | banco |
| Distribuição por space | Audiovisual 252, Social Media 154, Designer 61, Coordenação 20, Administrativo 13, Gestão de Tráfego 4, Onboarding de Clientes 0 | card_spaces |
| Clientes ativos | 5 ativos, 1 pausado, 2 encerrados (tabela `client_cards`; a tabela `clients` está vazia) | banco |
| Módulos mais acessados (30 dias) | dashboard 58, calendar 47, financial 38, people_analytics 10, coordination 9 | module_usage |
| Comentários em card | 309 (75 com menção) | banco |
| Notificações | 507 (card_overdue 280, assignment 118, mention 54) | banco |

### 1.2 Entrega e prazo (30 dias)
- 44 entregas, 33 demandas novas, **7% no prazo** (3 de 43 com prazo), mediana de atraso 5,3 dias.
- Tempo mediano de entrega: 8 dias (p90 de 29 dias).
- 11 cards abertos; 3 atrasados; 7 fora do SLA da etapa; 9 sem movimento há mais de 14 dias.
- As entregas costumam ser baixadas em lote (vários cards no mesmo dia).
- **Horas registradas: zero** nos cards ativos (o cronômetro foi liberado em 02/10 e ainda não pegou).

### 1.3 Ciclo de trabalho (o que existe e o que está torto)
- O fluxo tem 6 etapas: Backlog, A Fazer, Em Produção, Revisão, **Aprovação**, Concluído. As etapas **A Fazer, Revisão e Aprovação têm SLA configurado** (48h/120h, 24h/72h, 48h/120h) e as colunas de gates (briefing obrigatório, checklist mínimo, sem dependências). **Nenhum limite de WIP está definido.**
- **Existe uma etapa "Aprovação" no fluxo.** Hoje ela é interna. É o encaixe natural para a aprovação do cliente.
- Há **dois vocabulários para o mesmo estado**: `status` do card (enum: backlog, briefing, todo, in_progress, review, approved, delivered, archived; os que existem hoje nos cards são backlog, briefing, review, approved, delivered e archived) e `current_stage` (backlog, planejamento ou a_fazer, em_producao, revisao, aprovacao, concluido). A sincronização acontece **só no navegador** (`hooks/useWorkflow.ts`, `lib/cardStatusMapping.ts`); o banco não tem restrição nem gatilho que a garanta. Divergências confirmadas no banco:
  - 6 cards `delivered` fora da etapa `concluido` (2 deles sem `completed_at`);
  - 2 cards `approved` na etapa `em_producao`;
  - 4 cards `briefing` em `planejamento`, porque não existe etapa `briefing`;
  - 14 cards arquivados com um UUID no lugar do nome da etapa, e 7 sem etapa;
  - o nome da 2ª etapa varia entre workflows (`a_fazer` em 3, `planejamento` em 1).
  Isso precisa ser reconciliado antes de qualquer automação.
- **Arquivar apaga o contexto:** `archived` volta para `backlog` no mapeamento, então o card arquivado perde onde estava. Hoje 85% dos cards (322 de 377) estão arquivados, e arquivar mistura "limpar o quadro" com "concluir".
- **Gates:** do `em_producao` em diante exigem briefing, checklist e ausência de dependências; `revisao` e `aprovacao` exigem checklist em 100%. Mas os gates de briefing são **dispensados para owner, admin, finance e coordinator**, então na prática só o papel `member` é bloqueado. O gate de dependências nunca bloqueia (0 dependências), e `allow_auto_transition` é sempre falso.
- **Automações rodam no navegador:** o gatilho do banco só registra em `automation_logs`; quem executa a ação (mudar status, urgência, comentar, notificar) é `lib/automationEngine.ts`, no cliente. Se ninguém estiver com a tela aberta, a automação não roda. A tabela de automações está vazia.
- **Não há evento de card no barramento:** `domain_events` é 90% telemetria de social; nenhum evento de card. Os webhooks de saída têm 0 assinaturas, então nunca disparam.
- Dependências: 0. Sprints: 0. Início planejado (`start_date`): 0. Horas estimadas: 0 nos cards abertos. Por isso Gantt e Capacidade não têm base real.
- Atribuição de responsável vem de `card_members`; `owner_id` é legado.

### 1.4 O que está construído mas dormente
AltControl (propostas, contratos, aprovação, assinatura: 10+ páginas, 15+ tabelas, **0 linhas**), Social/agendamento Meta (tabela de posts com 46 campos, calendário, fila, diagnóstico: **0 posts**), Banco de Ideias, Inventário, Pluggy/DDA/faturas, Integrações/webhooks, Push (infra pronta, ninguém inscrito), cards "kits" e modelos de checklist (tabelas existem, sem uso).

> **Leitura estratégica:** o Flowalt já tem **muita infraestrutura de cliente externo construída e parada** (token público, assinatura, e-mail, aprovação, social). A V3 não parte do zero: ela **reaproveita e liga** essas peças ao ciclo de produção, que é o que a equipe usa todo dia.

### 1.5 Dívidas e riscos técnicos relevantes
| Item | Risco | Observação |
|---|---|---|
| Home com consulta a cada 1 segundo | Carga por aba aberta | `pages/Index.tsx`, `refetchInterval: 1000` |
| Edge functions sem agendador | `overdue-cards-check`, `social-scheduler`, `token-refresh`, `cleanup-job`, `compute-snapshots` **não rodam sozinhas** (só 2 jobs de cron existem) | alerta de atraso depende disso |
| Tabelas de backup sem RLS | 15 tabelas com dados de produção | verificar permissões de acesso |
| ~150 funções `SECURITY DEFINER` | Superfície de ataque | auditar `EXECUTE` e `search_path` |
| Buckets públicos/sem limite | `client-logos`, `social-media`, `mindmap-attachments` | políticas amplas |
| `audit_logs` 13 MB, `access_logs` 11 MB, sem retenção | Crescimento sem limite | ruído em `domain_events` (90% telemetria) |
| Testes | 2 arquivos, nenhum script `test` | regressão invisível |
| TypeScript permissivo | `strictNullChecks` desligado, 339 usos de `any` | |
| 47 arquivos acima de 600 linhas | Manutenção | maiores: `PlatformConnectionWizard` 1.697, `CostCenterManager` 1.639 |
| Rotas legadas | `/dashboard-legacy`, `/home-legacy`, `/dashboard-v2` duplicado | |
| RPC `compute_dashboard_snapshot` | Define atraso errado, ainda em produção | consumidores não mapeados |
| Migrações aplicadas manualmente, sem CI | Sem trilha de auditoria | |
| **Política `cards_view_via_spaces`** | **Anula a visibilidade `restricted`**: ela libera a leitura do card para qualquer membro do workspace e as políticas somam com OR. Os 377 cards estão todos como `inherit`, então hoje não há vazamento prático, mas **a restrição prometida na tela não funciona**. | Corrigir antes de qualquer card ter conteúdo exposto a cliente ou restrito por pessoa |
| Atribuição em dois modelos | `owner_id` (264 arquivados sem) e `card_members` (501 linhas); não há "responsável principal" | afeta a quem notificar o ajuste do cliente |
| Campos que ninguém preenche | prazo ausente em 60 cards; horas estimadas ausentes; 11 lançamentos de tempo para 377 cards | SLA, capacidade e esforço ficam sem base |

### 1.6 UX: o que o usuário sente
- A tela mais usada (o card) é um diálogo gigante; **o checklist, que é o recurso mais usado, fica abaixo de propriedades, cronômetro e briefing**, abaixo da dobra.
- A busca global e o atalho existem, mas **não há botão visível** no cabeçalho.
- Ações rápidas existem só no Dashboard, não globalmente.
- **Mobile só tem o menu hambúrguer**; não há navegação inferior.
- Três famílias de fonte (Nexa, Archivo, Poppins); manifest com cor azul e app indigo; ícone "maskable" igual ao normal.
- Termos em inglês misturados (Dashboard, Analytics, Ranking, Time).
- Dois centros de notificação (Notificações e Alertas Unificados), com sobreposição.
- Poucos `aria-label` para o tamanho do app (cerca de 68 em mais de 400 arquivos).

---

## 2. Guardrails: como "não quebrar nada"

Regras que valem para **todas** as ondas. Vieram das decisões registradas nos relatórios do projeto (as seções § do blueprint original) e do que aprendemos nas últimas semanas.

**Isolamento e segurança (inegociáveis)**
1. Toda tabela nova tem `workspace_id` e RLS que exige membro do workspace. Políticas somam com OR: uma política com só `user_id = auth.uid()` vaza entre tenants (já aconteceu em `time_entries`).
2. Papéis existentes: owner, admin, coordinator, finance, member, viewer. Dados sensíveis só para owner e finance. Aprovação de cliente **não cria papel novo de login**: o cliente age por link assinado.
3. **A RLS de `altcontrol_approval_requests` não será alterada** (decisão de 16/08/2026: aprovador pode ser externo).
4. O controle de acesso do front (`usePermissions`) é só UX. A proteção real é a RLS.
5. Teste de isolamento só vale se plantar dado em outro tenant, dentro de transação com ROLLBACK.
6. Função pública (cliente sem login) usa credencial de serviço, **valida tudo dentro da função** e nunca devolve dados de outros registros.

6b. **Visibilidade de card:** o Flowalt tem `visibility` (`inherit`, `restricted`, `public`), mas a política `cards_view_via_spaces` anula `restricted`. **Nenhum conteúdo "restrito" ou voltado a cliente pode depender dessa coluna até a política ser corrigida** (Onda 0). A Sala de Aprovação não depende dela: o cliente nunca consulta a tabela `cards`, só a função pública.

**Mudança segura**
7. **Aditivo por padrão:** tabelas e colunas novas com valor padrão que preserva o comportamento atual (ex.: `comments.visibility` com padrão `internal`). Nenhuma coluna existente é removida ou renomeada.
8. **Atrás de flag:** usar `useFeatureFlags` (tabela com `rollout_percentage`) por workspace. Ligar primeiro só para o Gregg.
9. **Rota paralela:** telas novas em rotas novas; a antiga permanece até a nova provar valor (o mesmo método do Dashboard V2).
10. **Backup antes de cada migração** de dados; migração com `BEGIN/COMMIT`, `CREATE OR REPLACE`, e um **script de reversão** versionado junto.
11. **Typecheck correto:** `npx tsc -p tsconfig.app.json --noEmit` (o comando sem `-p` não checa nada) e `npm run build`; só então publicar.
12. **Reutilizar, não duplicar:** `ClientHealthWidget` (não criar outra fórmula de saúde do cliente), `getCardStatusLabel` (rótulos de etapa por workspace), Recharts, `GlobalModalContext`, `notifications`, `send-email-notification`, o padrão de `public-proposal`.
13. **Não preservar nada que o código não sustenta:** afirmar só o que o banco comprova; atraso = `due_date < now()` excluindo entregue e arquivado; separar "período escolhido" de "agora".
14. **Dados na VPS:** nada é apagado sem pedido explícito (seis projetos dividem a máquina). Backups antigos são arquivados, não removidos.
15. **Migrações com DDL sensível** (políticas, gatilhos) são aplicadas **pelo Gregg no terminal**, porque o classificador do Claude Code bloqueia o envio direto. O fluxo é: eu gero o `.sql`, ele roda `ssh mchat-vps "docker exec -i supabase-db psql ..." < arquivo.sql`.

---

## 3. Visão de produto: sete pilares

```
            EQUIPE                      CLIENTE                    GESTOR
   ┌─────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
   │  Card (checklist,   │   │  Sala de Aprovação   │   │  Radar de Risco +    │
   │  conversa do card,  │──▶│  (link, sem login)   │──▶│  "Precisa de decisão"│
   │  cronômetro)        │   │  Portal (fase 5)     │   │  Relatório do cliente│
   └─────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
             │                          │                           │
             └──────── CONVERSAS (canais, DM, threads) ─────────────┘
             └──────── FLUXO: Aprovação vira etapa; SLA vigiado ─────┘
             └──────── INTELIGÊNCIA em cada passo ───────────────────┘
```

| # | Pilar | Resumo | Peças que já existem |
|---|---|---|---|
| A | **Sala de Aprovação** | Cliente abre um link, vê a peça, aprova ou pede ajuste. A decisão vira etapa do fluxo. | `/p/:token`, `public-proposal`, assinatura com hash/IP, e-mail Resend, etapa "Aprovação" com SLA |
| B | **Conversas** | Chat de equipe (canais por cliente e space, mensagens diretas) + conversa do card (interna e com cliente) | `comments` com menção, `notifications`, Realtime, `mention-list` |
| C | **Feed e Calendário Editorial** | Prévia do feed em grade, ciclo mensal por cliente, "posts gaveta", agendamento Meta | `social_posts` (46 campos), `SocialCalendar`, `social-scheduler` |
| D | **Onboarding em esteira** | Primeiros 30 dias do cliente com etapas e cadências 15/30 | space "Onboarding de Clientes", `kit_templates`, `stage_checklist_templates`, card criado na assinatura |
| E | **Playbooks e Processos** | Procedimento anexado à etapa; "como fazemos" ao alcance do card | `ProcessMappingCanvas`, `process_templates` |
| F | **Portal do Cliente + marca** | Painel do cliente com pendências, histórico, calendário; identidade visual da agência | `workspace` (logo), `client-logos` |
| G | **Inteligência** | Radar de risco, copiloto de decisão, automações, relatório automático | `card-ai-assistant`, `overdue-cards-check`, Coordenação v2, `card_automations` |
| — | **Fundação** | Higiene, segurança, performance, testes | ver Onda 0 |

---

## 4. As quatro visões

### 4.1 Engenharia de software

**Princípio de arquitetura:** o Flowalt continua sendo SPA (React + Supabase). Três tipos de peça nova: (1) **tabelas e RLS** para o dado, (2) **edge functions** apenas onde o cliente não tem login ou há trabalho assíncrono, (3) **hooks e telas** no padrão existente (`['entidade', workspaceId, ...]`, `enabled: !!workspaceId`, toast em erro).

#### Modelo de dados proposto (esboço; DDL final sai por onda)

**Aprovação**
```
approval_requests
  id, workspace_id, card_id, client_id,
  token_hash (sha256; o token em si só vai no link),
  status: pending | approved | changes_requested | expired | canceled,
  round int (1, 2, 3...),
  title, message, requested_by,
  due_at, expires_at, reminded_at,
  decided_at, decided_by_name, decided_by_email, decision_ip, decision_ua,
  certificate_hash, created_at
approval_items
  id, request_id, kind: image|video|document|text|link,
  storage_path, caption, version, sort_order
approval_events           -- trilha de auditoria, não telemetria
  id, request_id, type: sent|viewed|commented|approved|changes_requested|reminder|expired,
  actor_kind: member|client, actor_label, payload jsonb, ip, ua, created_at
```
Reaproveita o desenho de `altcontrol_proposal_docs` (token, visualizações, assinatura, hash). O token **nunca é gravado em claro**.

**Conversa do card (mudança mínima em tabela existente)**
```
comments  (+ visibility text default 'internal' CHECK in ('internal','client'),
           + parent_id uuid null  -- thread,
           + author_kind text default 'member',
           + external_author_name text null)
```
Padrão `internal` preserva 100% do comportamento atual. O que é `client` aparece na Sala de Aprovação.

**Conversas (chat)**
```
chat_channels  id, workspace_id, kind: workspace|space|client|private|dm, ref_id, name, is_private, created_by
chat_members   channel_id, user_id, role, last_read_at, muted
chat_messages  id, channel_id, author_id, body, mentions uuid[], reply_to, card_id null,
               attachments jsonb, created_at, edited_at, deleted_at
chat_reactions message_id, user_id, emoji
```
Tempo real com `postgres_changes` filtrado por `channel_id`. **Mensagem direta e canal privado: nem owner nem admin leem** (decisão de privacidade a confirmar, ver §10).

**Marca e portal**
```
workspace_branding  workspace_id, display_name, logo_url, primary_hsl, accent_hsl, email_footer, custom_domain null
client_portal_access  id, workspace_id, client_id, email, magic_token_hash, last_seen_at, revoked_at
```

**Fluxo (reconciliação, aditiva)**
- Criar a função `stage_to_status(stage_slug)` e passar a manter `status` **derivado** da etapa por gatilho, só depois de mapear e corrigir os desvios existentes (há cards com status e etapa inconsistentes). Primeiro um relatório de divergência, depois a correção.

#### Funções de borda (edge functions)
| Função | Faz | Credencial |
|---|---|---|
| `public-approval` (nova, modelada em `public-proposal`) | `get`, `view`, `comment`, `approve`, `request_changes` por token | serviço, `verify_jwt=false`; valida token, expiração, estado e limites de taxa |
| `approval-reminders` (nova) | lembretes escalonados e expiração | agendada por `pg_cron` |
| `send-email-notification` (existente) | e-mails de pedido, lembrete, decisão | Resend (já configurado) |
| `overdue-cards-check`, `social-scheduler`, `social-token-refresh`, `cleanup-job`, `compute-snapshots` (existentes) | **passar a rodar por `pg_cron`** | hoje não rodam sozinhas |

#### Segurança do link público
Token de 32+ bytes aleatórios; só o hash no banco; expira (padrão 14 dias); **limite de tentativas por IP**; resposta idêntica para token inválido ou expirado (não revela existência); nunca lista outros itens; registra IP e agente; arquivos servidos por **URL assinada de curta duração** em bucket privado novo (`approvals`, com limite de tamanho). Revogável pelo gestor.

#### Desempenho
- Remover o `refetchInterval` de 1 segundo da Home (substituir por Realtime já existente).
- Passar `(select auth.uid())` nas políticas das tabelas novas (evita reavaliar por linha).
- Índices: `approval_requests (workspace_id, status)`, `chat_messages (channel_id, created_at desc)`, `chat_members (user_id)`.
- Retenção: `access_logs` 90 dias, `domain_events` sem telemetria de visualização.

---

### 4.2 Engenharia de projetos

#### Ondas (cada onda entrega valor sozinha e pode parar ali)

**Onda 0: Fundação (primeiro, porque protege todo o resto)**
- Versionar este blueprint e as regras em `docs/BLUEPRINT.md` no repositório.
- Cron para as 5 edge functions que não rodam; checar que `overdue-cards-check` volta a gerar o alerta de atraso.
- Corrigir a Home (consulta de 1 s), rotas duplicadas (`/dashboard-v2`), manifest (cor e ícone maskable), fontes (3 para 2).
- Script `npm test` e primeiros testes das regras puras (`metrics.ts`, `coordMetrics.ts`).
- Auditoria de permissões `EXECUTE` das funções sensíveis; revisar acesso às tabelas de backup.
- **Reconciliar `status` e `current_stage`:** primeiro um relatório (as divergências listadas na §1.3), depois a correção dos casos, e só então um gatilho no banco que mantenha `status` derivado da etapa (hoje a sincronização é só no navegador). Corrigir os 14 UUIDs no lugar do nome da etapa e padronizar `a_fazer` × `planejamento`.
- **Corrigir a política `cards_view_via_spaces`** para respeitar `restricted` (testar com dado plantado em outro tenant e com um `member` sem vínculo ao card). Mudança de segurança: aplicada pelo Gregg.
- **Barramento de eventos de card:** emitir `card.stage_changed`, `card.approved`, `card.changes_requested` em `domain_events` (hoje não há nenhum), para alimentar automações e webhooks sem depender do navegador aberto.
- **Mover a execução de automações para o servidor** (hoje só roda com a tela aberta): função de borda acionada pelo evento, mantendo `automationEngine.ts` como regra de domínio compartilhada.
- *Critério de pronto:* nenhuma tela mudou para o usuário; build limpo; jobs rodando; zero divergência entre `status` e etapa.
- *Tamanho:* M.

**Onda 1: Sala de Aprovação + Conversa do card**
- Tabelas de aprovação, `comments.visibility/parent_id`, bucket privado, função pública, tela de pedido no card, página do cliente, notificações e e-mail.
- Etapa "Aprovação" passa a abrir o pedido; aprovar leva a "Concluído"; ajustes voltam a "Em Produção" com a rodada anotada.
- Widget "Aprovações pendentes" na Home e na Coordenação.
- *Flag:* `client_approval`. *Reversão:* desligar a flag; as tabelas ficam sem uso.
- *Dependência:* nenhuma além da Onda 0. *Tamanho:* G.

**Onda 2: Conversas (chat de equipe)**
- Canais automáticos por cliente e space, mensagens diretas, menção, reações, anexos, não lidas, "transformar mensagem em card".
- Áudio e busca profunda ficam para depois.
- *Flag:* `team_chat`. *Tamanho:* G.

**Onda 3: Feed e Calendário Editorial**
- Visão "Feed" em grade 3×3, ciclo mensal por cliente, posts gaveta, aprovação em lote do ciclo (reusa a Sala de Aprovação).
- **Verificar antes** por que há 0 posts (conexão com a Meta ativa?). Só então ligar o agendamento.
- *Flag:* `editorial_feed`. *Tamanho:* G.

**Onda 4: Onboarding em esteira e Playbooks**
- Modelo de onboarding por tipo de cliente (etapas, cadências 15 e 30 dias, checklist), quadro compilado de todos os clientes, aba "Playbook" por etapa.
- *Tamanho:* M.

**Onda 5: Portal do Cliente + marca**
- Página do cliente com pendências, histórico, calendário e relatório mensal; entrada por link mágico; marca da agência em links e e-mails.
- *Dependência:* Ondas 1 e 3. *Tamanho:* G.

**Onda 6: Inteligência**
- Radar de risco preditivo, copiloto de decisão, automações por regra, relatório automático (detalhes em §4.5).
- Começa **junto** das ondas 1 a 5 em versão simples e evolui.

> Os tamanhos são relativos (M, G); não são prazos. A estimativa em semanas depende de quanto da equipe valida cada onda. Sugestão: **uma onda por vez, em produção com flag, com uma semana de uso real antes da seguinte.**

#### Riscos de projeto
| Risco | Probabilidade | Mitigação |
|---|---|---|
| A equipe não adota (hoje usa 5 a 7 pessoas e o cronômetro está parado) | Alta | Entregar primeiro o que **alivia** (Sala de Aprovação elimina vai-e-volta de WhatsApp); treino de 15 min; medir adoção |
| Cliente não abre o link | Média | Lembretes escalonados; e-mail com a peça visível; aprovação em 1 clique |
| Vazar comentário interno ao cliente | Média, impacto alto | Padrão `internal`; badge visível "o cliente vê isto"; teste de isolamento dedicado |
| Quebrar fluxo atual | Média | Flags, rotas paralelas, reversão por onda |
| Meta bloqueia o agendamento | Desconhecida | Verificar conexão antes; Onda 3 entrega o feed mesmo sem agendar |
| Escopo cresce | Alta | Cada onda tem critério de pronto; o que não cabe vira "fase 2" |

---

### 4.3 UX/UI

#### Jornadas

**Cliente (a mais importante, hoje inexistente)**
1. Recebe e-mail: "3 peças esperam sua aprovação" com miniaturas.
2. Abre o link no celular, sem login. Vê a peça grande, a legenda e a data prevista.
3. Toca **Aprovar** ou **Pedir ajuste**. Em ajuste, escreve (ou marca um ponto na imagem).
4. Vê a confirmação com o recibo ("aprovado por Fulano, em 05/10 às 14:32").
5. Se não responde, recebe lembrete no dia seguinte (e-mail; WhatsApp depois).

**Equipe**
1. Na etapa "Aprovação", o card oferece **"Enviar ao cliente"**: escolhe peças, mensagem e prazo, vê a **prévia "como o cliente verá"**.
2. Acompanha: enviado, visto, comentado, decidido (linha do tempo no card).
3. Ajuste pedido: o card volta a "Em Produção" com a rodada "Ajuste 2" e a nota do cliente; o responsável é notificado.
4. Conversa interna acontece **no mesmo card**, separada da conversa com o cliente por um seletor óbvio.

**Gestor**
1. Abre a Home e vê: o que precisa de decisão, aprovações pendentes há mais de 48 h, conversas sem resposta, clientes com risco.
2. Entra em Coordenação para o detalhe.

#### Arquitetura de informação (navegação)
```
Início     → o que preciso fazer hoje (tarefas, aprovações, conversas, agenda)
Trabalho   → Tarefas · Kanban por space · Calendário editorial · Tempo
Conversas  → Canais · Mensagens diretas · Não lidas          (novo)
Clientes   → Lista · Cliente (visão 360, aba Portal)
Gestão     → Coordenação · Analytics · Equipe · Financeiro · AltControl
Mais       → Ranking · Ideias · Integrações · Configurações
```
Mobile ganha **barra inferior** com cinco destinos: Início, Tarefas, **Conversas**, **Aprovações**, Mais. O botão **"+"** global (ação rápida: novo card, novo pedido de aprovação, nova mensagem) e o **botão de busca (⌘K) visível** no cabeçalho.

#### Telas-chave (wireframes)

**1) Sala de Aprovação, visão do cliente (mobile)**
```
┌──────────────────────────────┐
│ [logo agência]   Mela & Kera │
│ 3 peças aguardam você        │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │        [ PEÇA ]        │  │   toque para ampliar
│  │   Carrossel · 4 telas  │  │
│  └────────────────────────┘  │
│  Dia dos Pais · 08/08 18:00  │
│  "Legenda do post aqui..."   │
│  Versão 2 · Ajuste 1 feito   │
│                              │
│  [ ✔ Aprovar ]               │
│  [ ✎ Pedir ajuste ]          │
│  💬 Conversa (2)             │
└──────────────────────────────┘
   Prazo da agência: 06/08  ·  expira em 12 dias
```

**2) Card, nova ordem (desktop)**
```
┌────────────────────────────────────────────────────────────┐
│ Título · space · etapa ▸ Aprovação        [Enviar ao cliente]│
├────────────────────────────┬───────────────────────────────┤
│ ✔ Checklist (4/6)          │ CONVERSA   [Interna | Cliente]│
│ Descrição                  │  ...mensagens...              │
│ Entregáveis / anexos       │  [escreva · @ · 📎]           │
│ ── Detalhes (recolhível) ──│ ───────────────────────────── │
│ Propriedades · Briefing    │ APROVAÇÃO  Rodada 2 · Visto   │
│ Cronômetro · Financeiro    │  ✔ Enviado ✔ Visto ○ Decidido │
│ IA · Histórico             │                               │
└────────────────────────────┴───────────────────────────────┘
```
O que a equipe mais usa (checklist, descrição, conversa) sobe; o que é configuração desce e recolhe.

**3) Início do gestor**
```
┌ Precisa de decisão (5) ──────────┐ ┌ Aprovações pendentes (3) ─────┐
│ ⚠ BE LOUNGE · 79 d de atraso     │ │ Mela & Kera · há 3 dias       │
│ ⚠ ADV FLAVIO · 32 d              │ │ Salyssa · há 1 dia            │
└──────────────────────────────────┘ └───────────────────────────────┘
┌ Conversas não lidas (4) ─────────┐ ┌ Hoje ─────────────────────────┐
│ #cliente-gol-burger · 2          │ │ Entregas, reuniões, prazos    │
└──────────────────────────────────┘ └───────────────────────────────┘
```

**4) Conversas**
```
┌ Canais ───────┬───────────────────────────────────────────┐
│ # operação  2 │ # criação                       👥 6       │
│ 🔒 adm        │  Bruno  11:33 @Gustavo escuta esse áudio   │
│ # criação     │  Fernanda 12:54  📎 briefing.pdf   🔥1     │
│ ── Clientes ──│  Gustavo 15:22 ↩ Já ajustei a chamada      │
│ # Mela&Kera 3 │ ─────────────────────────────────────────  │
│ # Gol Burger  │ [ mensagem... @ 📎 😊 ]    [ → card ]      │
└───────────────┴───────────────────────────────────────────┘
```
"→ card" transforma a mensagem em tarefa já vinculada ao cliente.

#### Princípios de microinteração
- **Estado sempre visível:** enviado, visto, decidido, com horário. O cliente nunca fica sem saber o que aconteceu.
- **Um toque para o essencial:** aprovar em um toque; ajustar com texto livre ou ponto marcado na imagem.
- **Prevenir o vazamento:** o campo de conversa mostra, em cor e rótulo, **quem verá** (Interna ou Cliente). Padrão sempre Interna.
- **Vazio útil:** nenhuma tela vazia sem dizer o que fazer a seguir (o app já usa `EmptyState` em cerca de 99 pontos).
- **Português consistente:** Início, Painel, Análises, Ranking, Tempo; fim de termos em inglês.
- **Acessibilidade:** `aria-label` em todo botão só com ícone; alvo de toque de 44 px; contraste AA; foco visível; texto alternativo.

---

### 4.4 Design de app (identidade, componentes, mobile)

**Tokens e tipografia**
- Manter os tokens HSL atuais (primária indigo 235 72% 55%, `--radius` 0.75rem) e **alinhar o `theme_color` do manifest** a eles.
- **Duas fontes** em vez de três (uma para títulos, uma para texto). Propor: manter a de marca nos títulos e uma sem serifa legível para a interface. A Nexa não tem licença web (registrado na memória do projeto), então a decisão final de marca é do Gregg.
- Escala de espaçamento e raios únicos; sombras apenas em camadas elevadas.

**Componentes novos (todos sobre shadcn existente)**
| Componente | Uso |
|---|---|
| `ApprovalStatusPill` | enviado, visto, ajuste, aprovado, expirado |
| `AudiencePicker` | alternador Interna/Cliente na conversa |
| `ArtViewer` | zoom, carrossel, vídeo, anotação por ponto |
| `FeedGrid` | grade 3×3 do perfil |
| `ChannelList`, `MessageBubble`, `Composer` | Conversas |
| `Timeline` | histórico do pedido (enviado, visto, decidido) |
| `RiskBadge` | risco previsto do card |
| `CycleHeader` | cliente + ciclo + prazo |

**Mobile e PWA**
- Barra inferior de 5 destinos com contador de não lidas e de aprovações.
- Sala de Aprovação otimizada para o celular do cliente (peça na largura inteira, botões fixos no rodapé).
- Corrigir o manifest (ícone maskable com zona segura, cor do tema). Habilitar **push** (infra pronta) com um convite claro, pois hoje há zero inscritos.
- Offline: leitura de conversas e cards já visitados (o service worker atual cobre os assets; não os dados).

**Marca branca (em níveis)**
1. Nível 1: logo, nome e cor da agência em links e e-mails públicos.
2. Nível 2: Portal com a identidade da agência.
3. Nível 3: domínio próprio (ex.: `aprova.agencia.com.br`) e app instalável com ícone da agência.
Começa no nível 1; os demais só se houver demanda.

**Movimento**
Transições curtas (150 a 200 ms) em abrir painel, trocar aba e entrada de mensagem. Respeitar `prefers-reduced-motion`.

---

### 4.5 Inteligência (o que torna o Flowalt "esperto", sem exagero de IA)

Regra de projeto: **inteligência explicável primeiro** (regras e estatística sobre dados reais), modelo de linguagem só onde ajuda a escrever ou resumir. Toda sugestão mostra a razão.

| Recurso | O que faz | Como (sem ML pesado) |
|---|---|---|
| **Radar de risco do card** | Marca cards que provavelmente vão atrasar | Compara o tempo na etapa com a **mediana histórica daquele space e tipo**; considera prazo, SLA da etapa, dias sem movimento e carga do responsável. Tudo já está no banco (`card_stage_history`, `stage_entered_at`, `due_date`). |
| **Copiloto "Precisa de decisão"** | Lista priorizada para o gestor | Evolução da Coordenação v2: soma atrasos, SLA, **aprovações paradas**, **cliente sem resposta**, **conversa sem resposta**, responsável que saiu da equipe. |
| **Sugestão de responsável** | Indica quem pegar um card | Pela carga atual (cards abertos, prazos das próximas semanas) e histórico de entrega naquele tipo. |
| **Rodadas de ajuste e escopo** | Alerta quando o cliente passa do combinado | Conta rodadas por cliente; compara com o limite contratado (campo novo no cadastro do cliente); sugere conversa comercial no financeiro. |
| **Saúde do cliente enriquecida** | Dá mais sinais ao `ClientHealthWidget` | Soma tempo de resposta do cliente, rodadas de ajuste e aprovações paradas **à fórmula existente** (não cria fórmula paralela). |
| **Briefing e checklist inteligentes** | Gera checklist e subtarefas | Do briefing + modelo do tipo de card (usa `card-ai-assistant` e `stage_checklist_templates`). |
| **Revisão assistida da legenda** | Aponta erros antes de enviar ao cliente | Ortografia, links quebrados, hashtags, tamanho por rede (regra pura) + sugestão de reescrita por IA, sempre opcional. |
| **Resumo de conversa** | Resume um canal ou card longo | Modelo de linguagem, sob demanda, com o texto sempre visível. |
| **Relatório mensal do cliente** | Entregas, aprovações, prazos e métricas | Montado de dados reais; entregue como página/PDF pelo Portal; rascunho para o gestor revisar antes de enviar. |
| **Automações por regra** | "Quando entrar em Aprovação, enviar ao cliente" | Usa `card_automations` (existe, sem uso) e os gatilhos de etapa já previstos (`allow_auto_transition`). |
| **Lembretes inteligentes** | Cobra o cliente no momento certo | Escalonado (D+1, D+2, D+4) com pausa em fim de semana; parado no recebimento de resposta. |
| **Aprovação tácita (opcional, por cliente)** | "Sem resposta em 48 h, considera aprovado" | **Desligado por padrão**, exige aceite no contrato, grava motivo e prova no histórico. Só se o Gregg decidir. |

---

## 5. Como cada pilar se encaixa no fluxo atual

```
 Backlog ─▶ A Fazer ─▶ Em Produção ─▶ Revisão ─▶ APROVAÇÃO ─▶ Concluído
  (interna)             (checklist)    (interna)   ▲   │  │
                                                   │   │  └─ aprovado ─▶ Concluído
                                                   │   └──── ajuste (Rodada n) ─▶ Em Produção
                                                   └── Sala de Aprovação (cliente, por link)
```
- **A etapa "Aprovação" já existe** (SLA 48 h de alerta, 120 h crítico). O pedido ao cliente nasce quando o card entra nela.
- O **SLA passa a ter sentido de verdade** porque o relógio da etapa é a espera pelo cliente. A Coordenação v2 já mostra isso.
- **Gate opcional:** "sem peça anexada não entra em Aprovação" (usa `requires_*` já existente).
- `status` e `current_stage` são reconciliados na Onda 0 para que as automações não divirjam.

---

## 6. Métricas de sucesso (linha de base medida)

| Métrica | Hoje | Meta sugerida (a validar com o Gregg) |
|---|---|---|
| Entregas no prazo (30 dias) | **7%** | 50% em 90 dias após a Onda 1 |
| Tempo mediano de entrega | 8 dias | menos de 6 |
| Cards abertos fora do SLA | 7 de 11 | menos de 3 |
| Horas registradas | 0 | 50% dos cards ativos |
| Pessoas ativas por semana | 5 a 7 | 100% da equipe operacional |
| Peças enviadas ao cliente pelo Flowalt | 0 | 80% das de Social Media |
| Tempo até a decisão do cliente | não medido | mediana abaixo de 24 h |
| Rodadas de ajuste por peça | não medido | menos de 2 |
| Notificações de atraso por dia (ruído) | 280 no total | menos, com agrupamento |

---

## 7. Plano de testes e segurança por onda

1. **RLS:** teste de isolamento plantando dados em um segundo workspace, em transação com ROLLBACK, para cada tabela nova.
2. **Função pública:** testes de contrato (token válido, expirado, revogado, de outro registro, repetido) e de limite de taxa.
3. **Vazamento interno/cliente:** teste que garante que `comments.visibility='internal'` nunca sai pela função pública.
4. **Regressão:** `npm test` (a criar) cobrindo as regras puras; typecheck correto; build; verificação visual na sessão logada.
5. **Reversão:** script de volta por onda; flag desligada deixa o sistema como antes.
6. **LGPD:** o cliente é informado do registro de IP e agente na tela; política de privacidade atualizada; retenção definida.

---

## 8. O que NÃO fazer
- Não criar papel de login para o cliente nas primeiras ondas (o link assinado basta e é mais seguro).
- Não alterar a RLS de `altcontrol_approval_requests`.
- Não apagar tabelas de backup nem dados; arquivar.
- Não duplicar a fórmula de saúde do cliente.
- Não ligar aprovação tácita nem WhatsApp sem decisão explícita.
- Não migrar as telas antigas de uma vez; sempre rota paralela.

---

## 9. Primeiros 10 passos concretos (Onda 0 e início da Onda 1)

1. Gregg envia o **blueprint original** (as seções § citadas), para conferir este plano contra ele.
2. Versionar `docs/BLUEPRINT.md` com as regras da §2.
3. Agendar por `pg_cron` as 5 edge functions que não rodam; confirmar o alerta de atraso.
4. Remover o polling de 1 s da Home.
5. Relatório de divergência `status` × `current_stage`.
6. Adicionar `npm test` e testes das regras puras.
7. Corrigir manifest (ícone maskable, cor) e reduzir fontes.
8. Migração da Onda 1 (aprovação + `comments.visibility`), aplicada pelo Gregg.
9. Função `public-approval` e a página do cliente, atrás da flag `client_approval`.
10. Piloto com **um cliente** e **um space** (Social Media), uma semana.

---

## 10. Decisões abertas (precisam do Gregg)

1. **Onde começar:** aprovação por link (Onda 1) ou chat da equipe (Onda 2)? *Recomendação: aprovação, porque ataca o atraso medido.*
2. **Quem aprova:** cards de qualquer space ou só Social Media no piloto?
3. **Quem recebe o aviso de ajuste:** responsável do card, gestor ou os dois?
4. **Privacidade do chat:** mensagens diretas e canais privados são lidos por owner/admin? *Recomendação: não.*
5. **Aprovação tácita por prazo:** quer essa opção por cliente, desligada por padrão?
6. **Cliente no chat:** o canal do cliente inclui o próprio cliente (convidado externo) agora ou só depois do Portal?
7. **Marca branca:** nível 1 (logo e cor) basta por agora?
8. **Aviso por WhatsApp:** hoje não há integração; começar só com e-mail?
9. **Fontes:** qual das três manter, dado que a Nexa não tem licença web?
10. **Módulos dormentes** (Inventário, Ideias, Pluggy/DDA, Integrações, AltControl): ocultar, congelar ou priorizar?
11. **Limite de rodadas de ajuste por cliente:** vai existir no contrato? Qual padrão?
12. **Responsável principal do card:** hoje há `owner_id` (legado) e vários `card_members`, sem regra de quem responde. Para o aviso de ajuste do cliente, o primeiro responsável vinculado deve ser o principal?
13. **Arquivar × concluir:** 85% dos cards estão arquivados. Posso separar "concluído" de "arquivado" (arquivar passa a manter a etapa de origem)?

---

## 11. Apêndice: fontes e correções

- O levantamento de dados feito por um dos especialistas usou **contagens estimadas do PostgreSQL**, que estavam desatualizadas e geraram números errados (1 membro, 0 etapas de fluxo). Este documento usa **contagens exatas** feitas por `count(*)` em cada tabela.
- Os relatórios de arquitetura, UX/UI, módulos e fluxo foram produzidos por leitura do código na VPS; pontos não confirmados estão rotulados como "a verificar".
- O README do repositório é um modelo genérico; as regras travadas vêm dos relatórios em `docs/` e `DASHBOARD_CANONICAL_IMPLEMENTATION_REPORT.md`.
- O fluxo de trabalho (§1.3) combina minhas medições diretas (colunas de `workflow_stages`, contagens por status, etapa e SLA) com o relatório do especialista de processos, que acrescentou as divergências entre `status` e etapa, a execução de automações no navegador, a ausência de eventos de card e a política `cards_view_via_spaces`. Esses quatro pontos vêm da leitura do código e de consultas dele; recomendo reconfirmar o da política (§1.5) com um teste de acesso antes de corrigi-la.
- Uma correção minha: o status `in_progress` **existe no enum** do banco; o que não existe é qualquer card usando esse status hoje. A frase "esse status não existe mais" que usei na revisão da Coordenação deve ser lida assim.
