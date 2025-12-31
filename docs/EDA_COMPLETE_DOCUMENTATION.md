# FlowAlt EDA - Documentação Completa

## 📋 Visão Geral

Este documento consolida a arquitetura **Event-Driven Architecture (EDA)** implementada no FlowAlt, cobrindo todos os módulos: Financeiro, Inventário, Cards, Colaboradores e Observabilidade.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Components                            │
│  (React Hooks: useCards, useInventory, useFinancial, etc.)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ Commands (mutations)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Database                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Tables     │  │   Triggers   │  │   Functions  │          │
│  │  (Entities)  │──│ (Event Emit) │──│  (RPC/CQRS)  │          │
│  └──────────────┘  └──────┬───────┘  └──────────────┘          │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │              domain_events (Event Store)          │           │
│  │  - event_type, aggregate_type, aggregate_id      │           │
│  │  - payload, metadata, correlation_id             │           │
│  └──────────────────────────────────────────────────┘           │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │           Read Models (Views/Materialized)        │           │
│  │  - inventory_stock_summary                        │           │
│  │  - financial_alerts_summary                       │           │
│  │  - system_health_view                             │           │
│  │  - inventory_exec_kpis                            │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Edge Functions                             │
│  - compute-snapshots (scheduled)                                 │
│  - webhook-retry (scheduled)                                     │
│  - overdue-cards-check (scheduled)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Módulos Implementados

### 1. Inventário (Sprint 1-2)

#### Entidades
- `inventory_items` - Itens do inventário
- `inventory_units` - Unidades serializadas
- `inventory_movements` - Movimentações
- `card_kits` - Itens associados a cards
- `maintenance_records` - Manutenções
- `depreciation_schedules` - Depreciação
- `subscription_licenses` - Licenças SaaS

#### Eventos
| Event Type | Trigger |
|------------|---------|
| InventoryItemCreated | INSERT inventory_items |
| InventoryItemUpdated | UPDATE inventory_items |
| InventoryMovementCreated | INSERT inventory_movements |
| MaintenanceRecordCreated | INSERT maintenance_records |
| DepreciationScheduleCreated | INSERT depreciation_schedules |

#### Views
- `inventory_stock_summary` - Estoque consolidado
- `warranty_status_view` - Status de garantias
- `inventory_exec_kpis` - KPIs executivos

#### Hooks
```typescript
import { useInventory, useStockOperations } from '@/hooks/useInventory';
import { useStockSummary } from '@/hooks/useStockSummary';
import { useInventoryExecKPIs } from '@/hooks/useInventoryKPIs';
```

---

### 2. Financeiro (Sprint 3-4)

#### Entidades
- `transactions` - Receitas e despesas
- `invoices` - Faturas
- `bank_reconciliations` - Conciliação bancária
- `financial_audit_trail` - Auditoria financeira
- `collaborator_payroll` - Folha de pagamento

#### Eventos
| Event Type | Trigger |
|------------|---------|
| TransactionCreated | INSERT transactions |
| TransactionPaid | UPDATE status → 'paid' |
| InvoiceCreated | INSERT invoices |
| PayrollGenerated | INSERT collaborator_payroll |

#### Views
- `financial_alerts_summary` - Alertas consolidados
- `card_financial_history_view` - Histórico por card

#### Hooks
```typescript
import { useFinancial } from '@/hooks/useFinancial';
import { useFinancialKPIs } from '@/hooks/useFinancialKPIs';
import { useFinancialAuditTrail } from '@/hooks/useFinancialAudit';
```

---

### 3. Colaboradores (Sprint 5)

#### Entidades
- `collaborator_details` - Dados cadastrais
- `collaborator_benefits` - Benefícios
- `collaborator_absences` - Ausências
- `collaborator_payroll` - Folha de pagamento
- `collaborator_audit` - Auditoria

#### Eventos
| Event Type | Trigger |
|------------|---------|
| CollaboratorCreated | INSERT collaborator_details |
| CollaboratorUpdated | UPDATE collaborator_details |
| AbsenceRequested | INSERT collaborator_absences |
| PayrollProcessed | INSERT collaborator_payroll |

#### Hooks
```typescript
import { useCollaborators } from '@/hooks/useCollaborators';
import { useCollaboratorPayroll } from '@/hooks/useCollaboratorPayroll';
```

---

### 4. Integração com Cards (Sprint 6)

#### Views
- `card_kit_summary_view` - Resumo de kit por card
- `card_financial_history_view` - Histórico financeiro
- `card_movements_history_view` - Histórico de movimentações

#### Funções RPC
```sql
-- Calcular custo do kit de um card
SELECT calculate_card_kit_cost(p_card_id);

-- Resumo financeiro de um card
SELECT * FROM get_card_financial_summary(p_card_id);
```

#### Hooks
```typescript
import { 
  useCardKitCost, 
  useCardFinancialSummary,
  useCardKitTimeline 
} from '@/hooks/useCardKit';
```

---

### 5. Painel Executivo (Sprint 7)

#### Funções RPC
```sql
-- KPIs executivos consolidados
SELECT * FROM compute_executive_kpis(p_workspace_id);

-- Snapshot diário
SELECT * FROM compute_daily_snapshot(p_workspace_id);
```

#### Views
- `inventory_exec_kpis` - KPIs de inventário
- `system_health_view` - Saúde do sistema

#### Hooks
```typescript
import { useExecutiveKPIs, useKPITrends } from '@/hooks/useExecutiveKPIs';
import { useInventoryExecKPIs } from '@/hooks/useInventoryKPIs';
```

---

### 6. Observabilidade (Sprint 8)

#### Entidades
- `system_metrics` - Métricas do sistema
- `dashboard_snapshots` - Snapshots de dashboard
- `application_logs` - Logs estruturados
- `access_logs` - Logs de acesso

#### Funções RPC
```sql
-- Registrar métrica
SELECT record_metric(p_workspace_id, p_metric_type, p_metric_name, p_metric_value);

-- Métricas agregadas
SELECT * FROM get_aggregated_metrics(p_workspace_id, p_metric_type, p_start_date, p_end_date);
```

#### Hooks
```typescript
import { 
  useSystemMetrics,
  useDashboardSnapshots,
  useApplicationLogs,
  useRecordMetric,
  useLogWriter,
  useSystemHealth
} from '@/hooks/useObservability';

import { useAccessLogging } from '@/hooks/useAccessLogging';
```

---

## 🔐 Segurança

### RLS (Row Level Security)
Todas as tabelas possuem RLS habilitado com políticas baseadas em `workspace_id`:

```sql
CREATE POLICY "Users can view own workspace data"
ON public.table_name FOR SELECT
USING (workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));
```

### Auditoria
- `financial_audit_trail` - Auditoria financeira com anomaly detection
- `collaborator_audit` - Auditoria de dados de colaboradores
- `access_logs` - Logs de acesso a áreas sensíveis
- `application_logs` - Logs estruturados com correlation_id

### Correlation IDs
Todas as operações são rastreadas com correlation IDs para debugging distribuído:

```typescript
import { getCurrentCorrelationId, getSessionId } from '@/lib/correlationId';
```

---

## 📈 Edge Functions

### compute-snapshots
Computa snapshots diários para todos os workspaces ativos.

**Trigger:** Cron (diário) ou manual

```bash
# Invocar manualmente
curl -X POST https://[project].supabase.co/functions/v1/compute-snapshots \
  -H "Authorization: Bearer [anon-key]"
```

### webhook-retry
Reprocessa webhooks que falharam.

**Trigger:** Cron (5 em 5 minutos)

### overdue-cards-check
Verifica cards com prazo vencido e envia notificações.

**Trigger:** Cron (diário)

---

## 📋 Checklist de Aceite

| Critério | Status |
|----------|--------|
| Event Store centralizado (domain_events) | ✅ |
| CQRS - Separação Command/Query | ✅ |
| Multi-tenant com workspace_id | ✅ |
| RLS em todas as tabelas | ✅ |
| Auditoria automática | ✅ |
| Correlation IDs | ✅ |
| Views como Read Models | ✅ |
| Edge Functions documentadas | ✅ |
| Hooks React documentados | ✅ |
| KPIs executivos | ✅ |
| Observabilidade (logs/métricas) | ✅ |

---

## 🚀 Próximos Passos

1. **Alertas em tempo real** - Notificações push para eventos críticos
2. **Dashboard de observabilidade** - Visualização de métricas e logs
3. **Replay de eventos** - Reconstituição de estado a partir do event store
4. **Event sourcing completo** - Migração para event sourcing puro
5. **CDC (Change Data Capture)** - Streaming de eventos para sistemas externos
