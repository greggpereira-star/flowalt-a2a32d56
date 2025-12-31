# SPRINT 1 - Fundação Financeira & Domínio

## 📋 Resumo Técnico

Sprint 1 implementa a **arquitetura EDA (Event-Driven Architecture)** para o módulo Financeiro & Almoxarifado do Flowalt.

### Entregáveis

- ✅ Modelagem completa do domínio (7 entidades principais)
- ✅ Migrations com índices otimizados
- ✅ Triggers de auditoria automática
- ✅ Função `emit_domain_event` para emissão padronizada
- ✅ Views materializadas (read models)
- ✅ Hooks React para consumo de eventos
- ✅ Documentação Command → Event → Read Model

---

## 🗂️ ERD - Entidades do Domínio

```
┌─────────────────────┐     ┌─────────────────────┐
│   inventory_items   │────<│   inventory_units   │
├─────────────────────┤     ├─────────────────────┤
│ id                  │     │ id                  │
│ workspace_id        │     │ item_id             │
│ code                │     │ serial_number       │
│ name                │     │ current_status      │
│ category            │     │ warranty_start_date │
│ current_stock       │     │ warranty_end_date   │
│ min_stock           │     │ warranty_provider   │
│ is_serialized       │     └─────────────────────┘
│ purchase_value      │
│ depreciation_method │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐     ┌─────────────────────┐
│ inventory_movements │────>│      card_kits      │
├─────────────────────┤     ├─────────────────────┤
│ id                  │     │ id                  │
│ movement_type       │     │ card_id             │
│ item_id             │     │ item_id             │
│ unit_id             │     │ quantity_required   │
│ quantity            │     │ status              │
│ card_id             │     │ checkout_date       │
│ occurred_at         │     │ return_date         │
└─────────────────────┘     └─────────────────────┘
         │
         │ triggers
         ▼
┌─────────────────────┐
│    domain_events    │
├─────────────────────┤
│ id                  │
│ event_type          │
│ aggregate_type      │
│ aggregate_id        │
│ payload             │
│ metadata            │
│ correlation_id      │
│ version             │
│ is_processed        │
└─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ maintenance_records │     │depreciation_schedule│
├─────────────────────┤     ├─────────────────────┤
│ id                  │     │ id                  │
│ item_id             │     │ item_id             │
│ unit_id             │     │ month_ref           │
│ cost                │     │ depreciation_amount │
│ is_warranty_claim   │     │ accumulated_deprec  │
│ is_resolved         │     │ book_value          │
└─────────────────────┘     └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│subscription_licenses│     │    transactions     │
├─────────────────────┤     ├─────────────────────┤
│ id                  │     │ id                  │
│ vendor              │     │ type (income/expense)│
│ product_name        │     │ amount              │
│ billing_cycle       │     │ status              │
│ seats_total         │     │ card_id             │
│ seats_used          │     │ category_id         │
│ renewal_date        │     │ cost_center_id      │
└─────────────────────┘     └─────────────────────┘
```

---

## 📨 Commands & Events

### Inventory Item

| Action (Command)      | Event Emitido          | Trigger             |
|-----------------------|------------------------|---------------------|
| Criar item            | InventoryItemCreated   | Automático          |
| Atualizar item        | InventoryItemUpdated   | Automático          |
| Deletar item          | InventoryItemDeleted   | Automático          |

### Inventory Movement

| Action (Command)       | Event Emitido              | Trigger             |
|------------------------|----------------------------|---------------------|
| Registrar movimento    | InventoryMovementCreated   | Automático          |
| (consequência)         | InventoryStockChanged      | Automático          |

### Maintenance Record

| Action (Command)       | Event Emitido                | Trigger             |
|------------------------|------------------------------|---------------------|
| Criar manutenção       | MaintenanceRecordCreated     | Automático          |
| Atualizar manutenção   | MaintenanceRecordUpdated     | Automático          |
| Resolver manutenção    | MaintenanceRecordResolved    | Automático          |

### Transaction

| Action (Command)       | Event Emitido          | Trigger             |
|------------------------|------------------------|---------------------|
| Criar transação        | TransactionCreated     | Automático          |
| Atualizar transação    | TransactionUpdated     | Automático          |
| Pagar transação        | TransactionPaid        | Automático          |
| Cancelar transação     | TransactionCancelled   | Automático          |
| Deletar transação      | TransactionDeleted     | Automático          |

### Depreciation Schedule

| Action (Command)       | Event Emitido                | Trigger             |
|------------------------|------------------------------|---------------------|
| Gerar depreciação      | DepreciationScheduleCreated  | Automático          |

---

## 🔄 Fluxo Action → Command → Event → Read Model

```
┌──────────────────┐
│   UI Component   │
│  (React Hook)    │
└────────┬─────────┘
         │ action: createMovement({ type: 'OUT', itemId, qty })
         ▼
┌──────────────────┐
│  useCreateMove   │ ─────────────────────┐
│  (Command)       │                      │
└────────┬─────────┘                      │
         │ INSERT into inventory_movements│
         ▼                                │
┌──────────────────┐                      │
│    PostgreSQL    │                      │
│    Triggers      │                      │
└────────┬─────────┘                      │
         │                                │
    ┌────┴────┐                           │
    ▼         ▼                           │
┌────────┐ ┌────────┐                     │
│ Event  │ │ Stock  │                     │
│ Store  │ │ Update │                     │
└────┬───┘ └────┬───┘                     │
     │          │                         │
     ▼          ▼                         │
┌──────────────────┐                      │
│  domain_events   │                      │
│  (Event Log)     │                      │
└────────┬─────────┘                      │
         │                                │
         ▼                                │
┌──────────────────┐                      │
│   Read Models    │◄─────────────────────┘
│  (Views/Hooks)   │    invalidateQueries
└──────────────────┘
```

---

## 📊 Read Models (Views)

### inventory_stock_summary

Consolidação de estoque com status calculado:

```sql
SELECT * FROM inventory_stock_summary WHERE workspace_id = $1;
```

Campos:
- `stock_status`: 'available' | 'low_stock' | 'out_of_stock' | 'maintenance'
- `units_in_stock`, `units_checked_out`, `units_in_maintenance`

### financial_alerts_summary

Contagem de alertas por severidade:

```sql
SELECT * FROM financial_alerts_summary WHERE workspace_id = $1;
```

---

## 🔧 Hooks Disponíveis

### Eventos de Domínio

```typescript
import { useDomainEvents, useAggregateHistory, useEventStats } from '@/hooks/useDomainEvents';

// Buscar eventos recentes
const { data: events } = useDomainEvents({ 
  aggregateType: 'InventoryItem',
  limit: 50 
});

// Timeline de um item específico
const { data: history } = useAggregateHistory('InventoryItem', itemId);

// Estatísticas de eventos
const { data: stats } = useEventStats();
```

### Read Models

```typescript
import { useStockSummary, useCriticalStock } from '@/hooks/useStockSummary';
import { useAlertsSummary, useHasCriticalAlerts } from '@/hooks/useAlertsSummary';

// Estoque consolidado
const { data: stock } = useStockSummary();

// Itens críticos
const { data: critical } = useCriticalStock();

// Resumo de alertas
const { hasCritical, totalActive } = useHasCriticalAlerts();
```

---

## ✅ Checklist de Aceite Sprint 1

| Critério                                    | Status |
|---------------------------------------------|--------|
| Nenhuma escrita direta em read model        | ✅     |
| Multi-tenant isolado (workspace_id)         | ✅     |
| Auditoria funcional (financial_audit_trail) | ✅     |
| Eventos emitidos automaticamente            | ✅     |
| RLS aplicado em todas as tabelas            | ✅     |
| Índices para performance                    | ✅     |
| Hooks React documentados                    | ✅     |

---

## 🔐 Segurança

- Todas as funções usam `SECURITY DEFINER` com `SET search_path = public`
- Views usam `SECURITY INVOKER` para respeitar RLS
- Multi-tenant enforced via `workspace_id` em todas as queries
- Auditoria automática com `user_id` capturado via `auth.uid()`

---

## 📅 Próximos Passos (Sprint 2)

1. Implementar validação de disponibilidade antes de checkout
2. Adicionar jobs automáticos para alertas
3. Melhorar UI de movimentações
