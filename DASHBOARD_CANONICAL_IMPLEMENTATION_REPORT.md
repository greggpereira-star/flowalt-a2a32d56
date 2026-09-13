# Dashboard Canônico — Relatório de Implementação

Rota: `/dashboard-v2` (paralela; `/dashboard` antigo segue intacto)
Data: 16/08/2026

---

## 1. Arquitetura

### Reutilizado (não recriado)

| Peça | Por quê |
|---|---|
| `ClientHealthWidget` | Já tem regra de score consolidada (§26: não criar fórmula paralela) |
| `usePermissions` | Régua de 7 papéis já existente (§2) |
| `getCardStatusLabel` | Rótulos de etapa por workspace, renomeáveis pelo time |
| Recharts | Já instalado e em uso (§58) |
| `GlobalModalContext` | Modal de lançamento financeiro |
| shadcn/ui | Card, Badge, Button, DropdownMenu, Skeleton, Progress, Tooltip |

### Criado

```
lib/dashboard/
  dashboard-types.ts        contratos (§79-83)
  dashboard-priority.ts     engine de prioridade e alertas (§15, §19, §28)

hooks/dashboard/
  useDashboardFilters.ts    período + escopo (§8)
  useDashboardData.ts       8 queries paralelas (§34)

components/dashboard/
  DashboardKpiCard.tsx      card genérico de KPI
  DashboardKpiGrid.tsx      os 5 indicadores
  QuickActionMenu.tsx       ação rápida com RBAC (§45)
  OverdueCardsWidget.tsx    fila de atrasados
  today/TodayFocusPanel.tsx as 4 áreas do Foco de Hoje (§14-18)
  charts/DashboardCharts.tsx horas por dia + distribuição por status
  bottlenecks/SpaceBottleneckWidget.tsx gargalos (§29-31)

pages/DashboardV2.tsx       composição
```

### RPC existente descartado — com justificativa

`compute_dashboard_snapshot` **não foi usado**. Ele define atraso como:

```sql
status != 'delivered' AND due_date < CURRENT_DATE
```

Dois defeitos: compara `timestamptz` com `CURRENT_DATE` (um card que vence hoje
às 16:00 não conta como atrasado às 16:01, contrariando §11) e inclui
`archived` na contagem. O `total_hours_week` também ignora timer em andamento.

**Pendência**: o RPC continua em produção e não foi rastreado quem o consome.
Pode estar alimentando outra tela com número errado.

---

## 2. Dados por widget

| Widget | Fonte | Recorte |
|---|---|---|
| Total de Cards / Em Produção | `cards` | Retrato atual do workspace |
| Atrasados | `cards` | `due_date < now()`, exclui delivered/archived |
| Horas | `time_entries` | Período + timer ativo até agora |
| Agenda de Hoje | `events` | Sempre hoje, ignora o período |
| Próximas entregas | `cards` | `due_date >= now()`, 3 primeiras |
| Aprovações | `altcontrol_approval_requests` | `!inner` na proposta do workspace |
| Distribuição por status | `cards` | Retrato atual |
| Gargalos | `cards` + `spaces` | Abertos por espaço, com taxa |
| Saúde dos clientes | widget existente | Regra própria preservada |

### Período vs. agora

Duas noções de tempo separadas de propósito. Volume e comparações usam o
período escolhido; atraso, vencimento e próxima reunião usam o instante real.
Sem isso, escolher "mês passado" faria a tela afirmar que existem 22 cards
atrasados naquela época como se fossem pendências de agora.

### Delta sem histórico

O KPI de atrasados **não tem delta**. Não existe histórico de atrasados no
banco; comparar pendências de agora com cards antigos produzia `+2600%`.
Melhor não afirmar do que afirmar errado (§86).

---

## 3. Segurança

### Isolamento entre tenants — testado com dado plantado

Método: inserir linhas em workspace do qual o usuário não é membro, dentro de
transação com `ROLLBACK`, e verificar visibilidade.

| Tabela | Resultado |
|---|---|
| `cards` | isolado |
| `events` | isolado |
| `spaces` | isolado (30 linhas reais de outros tenants, 0 visíveis) |
| `time_entries` | **vazava — corrigido** |
| `altcontrol_approval_requests` | RLS frouxa; hook barra pelo `!inner` |

**Falha encontrada e corrigida**: a política
`"Users can manage their own time entries"` autorizava por `user_id =
auth.uid()` sem verificar workspace. Como políticas somam com `OR`, bastava ela
para expor registro de outro tenant. Agora exige dono **e** membro.

Um primeiro teste, que apenas listou o que o usuário vê hoje, deu falso
negativo: como não existem cards nem eventos fora do ALT AGENCY, o resultado
veio limpo por ausência de dados. A falha só apareceu plantando dados.

**Decisão tomada (16/08/2026, Gregg): NÃO alterar esta RLS.**

`altcontrol_approval_requests` libera por `approver_id = auth.uid()` sem checar
o workspace. Isso é **intencional**: aprovador de proposta pode ser externo ao
workspace — cliente, sócio ou terceiro designado. Exigir `is_workspace_member`
tiraria dessa pessoa o acesso justamente ao que ela precisa aprovar.

Não confundir com o caso do `time_entries`, que tinha a mesma forma e foi
corrigido: registro de tempo nunca deve cruzar tenant, aprovação externa sim.

O Dashboard não depende dessa política — a consulta usa
`altcontrol_proposals!inner(workspace_id)`, que restringe ao workspace atual
independentemente do que a RLS permita.

### RBAC

Visibilidade por papel via `usePermissions`: Saúde dos Clientes exige
`canViewClientFinancials`; Gargalos exige `canViewCoordination`; o menu de ação
rápida filtra item a item. É RBAC de interface — a proteção de dados é a RLS.

---

## 4. Performance

8 queries paralelas (`useQueries`), sem cascata. Keys sempre com `workspaceId`
e recorte (§35). `staleTime`: pendências 30s, cards e horas 45s, agenda e
aprovações 60s, espaços 10min, período anterior 5min.

---

## 5. QA executado

**Responsividade** (§70) — 1920, 1440, 1280, 1143, 1024, 768, 430, 390:
sem rolagem horizontal, sem elemento fora da borda. KPIs: 5 → 2 → 1 coluna.
Divergência da §59: em `lg` são 2 colunas, não 3+2 — com a sidebar aberta,
5 cards ficariam com ~150px e cortariam valores.

**Casos de borda** (§69) — 7 cards sem prazo não contam como atrasados;
0 timers ativos; 0 eventos hoje (empty state); 3 espaços sem cards abertos
ficam fora do gargalo (evita divisão por zero); 6 status no donut.

**Não executado**: troca de workspace pela interface (usuário pertence a 1),
papel `member` na tela, clique nas 6 ações do menu.

---

## 6. Pendências

| Item | Spec |
|---|---|
| Filtros de pasta, view, cliente, colaborador | §39 (só espaço implementado) |
| Reordenação de blocos por papel | §38 (só visibilidade) |
| `waitingApproval` nos gargalos | §30 (fixo em 0) |
| Meta de horas | §12 (não existe no banco) |
| Rotas `?new=` do menu podem não abrir formulário | §45 |
| Erros de console `ERR_BLOCKED_BY_CLIENT` | §73 (provável bloqueador de anúncios, não confirmado) |
| Auditoria de quem consome `compute_dashboard_snapshot` | — |

## 7. Recomendação

Manter `/dashboard-v2` em paralelo até que 2–3 pessoas do time, incluindo
alguém com papel `member`, tenham usado. Isso cobre de uma vez o QA de papel,
as rotas do menu e a leitura dos números pela operação — verificações que
nenhum typecheck substitui.
