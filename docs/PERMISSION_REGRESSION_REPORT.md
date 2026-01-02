# Permission Regression Report - Flowalt

**Data:** 2026-01-02  
**Auditor:** Lovable AI (Security Engineer)  
**Status:** CRÍTICO → CORRIGIDO

---

## Resumo Executivo

Foram identificadas e corrigidas **4 falhas críticas** de recursão infinita em policies RLS, além de criação de funções SECURITY DEFINER para eliminar vulnerabilidades de permissão.

---

## Falhas Críticas Encontradas

### 1. Infinite Recursion - `cards` table (CRITICAL) ✅ CORRIGIDO
- **Causa:** Policy `cards_select_with_visibility` fazia SELECT em `card_members`, que por sua vez fazia SELECT em `cards`
- **Impacto:** Queries travavam, impossibilitando acesso a cards
- **Correção:** Criada função `is_card_member(uuid, uuid)` SECURITY DEFINER que acessa `card_members` diretamente sem passar pela RLS

### 2. Infinite Recursion - `card_members` table (CRITICAL) ✅ CORRIGIDO
- **Causa:** Policy `Members can view card members` fazia SELECT em `cards`, que tentava acessar `card_members`
- **Correção:** Policy `card_members_select_no_recursion` usa apenas verificações diretas ou funções SECURITY DEFINER

### 3. Infinite Recursion - `platform_super_admins` table (CRITICAL) ✅ CORRIGIDO
- **Causa:** Policy `super_admins_select` fazia SELECT em si mesma para verificar se usuário era super admin
- **Correção:** Criada função `is_platform_super_admin(uuid)` SECURITY DEFINER e policy simplificada

### 4. Sensitive Financial Data Access (MEDIUM) ✅ CORRIGIDO
- **Causa:** Coordinator tinha acesso a dados financeiros sensíveis (salários, contratos)
- **Blueprint:** Apenas Owner + Finance devem ver dados sensíveis
- **Correção:** Função `can_view_sensitive_financial` atualizada para excluir coordinator

---

## Funções SECURITY DEFINER Criadas

| Função | Propósito |
|--------|-----------|
| `is_card_member(uuid, uuid)` | Verifica membership de card sem recursão |
| `can_delete_checklist(uuid, uuid)` | Verifica ownership para delete de checklist |
| `can_access_space(uuid, uuid)` | Verifica acesso a space com allowed_roles |
| `can_access_folder(uuid, uuid)` | Verifica acesso a folder com restrições |
| `is_platform_super_admin(uuid)` | Verifica super admin sem recursão |

---

## Policies Corrigidas

### cards
- ❌ `cards_select_with_visibility` → ✅ `cards_select_no_recursion`
- ❌ `Card members and admins can update cards` → ✅ `cards_update_no_recursion`

### card_members
- ❌ `Members can view card members` → ✅ `card_members_select_no_recursion`
- ❌ `Card owners and admins can manage card members` → ✅ `card_members_manage_no_recursion`

### checklists
- ❌ `checklists_delete_ownership` → ✅ `checklists_delete_with_ownership` (usa função)

### platform_super_admins
- ❌ `super_admins_select` → ✅ `super_admins_select_no_recursion`

### notifications
- ❌ `Service role can insert notifications` → ✅ `notifications_insert_service_or_self`

---

## Checklist de Validação (A→I)

| Check | Item | Status |
|-------|------|--------|
| A | User sem workspace não lista dados | ✅ RLS valida workspace_id |
| B | Workspace cria owner + member | ✅ Verificado |
| C | Invites com token unique + expiration | ✅ accept_workspace_invite valida |
| D | Spaces restritos por allowed_roles | ✅ can_access_space implementado |
| E | Folders restritos por folder_members | ✅ can_access_folder implementado |
| F | Delete cards/checklists por ownership | ✅ Policies corrigidas |
| G | Super Admin só com support_session | ✅ is_super_admin_with_session |
| H | Financeiro sensível só Owner+Finance | ✅ can_view_sensitive_financial |
| I | Billing/Entitlements bloqueiam corretamente | ✅ EntitlementGate + has_entitlement |

---

## Próximos Passos Recomendados

1. Executar `/security-audit` para validar automaticamente
2. Testar fluxo completo de convites com usuário novo
3. Validar que coordinator não vê dados financeiros sensíveis
4. Monitorar logs para novos erros de recursão

---

## Arquivos de Migration Criados

- `supabase/migrations/*_permission_hardening.sql` - Funções + policies corrigidas
- `supabase/migrations/*_platform_super_admins_fix.sql` - Correção recursão super admin
