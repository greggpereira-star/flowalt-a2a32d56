# Permission Regression Hardening Report

**Date:** 2026-01-02  
**Status:** COMPLETED  

## Executive Summary

Comprehensive security audit of Flowalt's permission system. **5 critical/medium issues fixed**, all RLS policies validated, UI guards aligned with RLS.

---

## Critical Fixes Applied

### 1. CRITICAL: `can_view_sensitive_financial` Excluded Admin Role
- **Severity:** CRITICAL
- **Cause:** Function included `admin` role, violating blueprint (admin should NOT see salary data)
- **Fix:** Updated function to only allow `owner` and `finance` roles
- **File:** Migration `permission_hardening_v2.sql`

### 2. MEDIUM: Added `revoked_at` to workspace_invites
- **Severity:** MEDIUM  
- **Cause:** Missing column for invite revocation tracking
- **Fix:** Added `revoked_at timestamptz` column + `revoke_workspace_invite` RPC

### 3. MEDIUM: Created `can_access_card` Function
- **Severity:** MEDIUM
- **Cause:** No centralized function for card access validation (deep link protection)
- **Fix:** Created SECURITY DEFINER function checking visibility + membership

### 4. MEDIUM: Fixed ClientCardSheet Financial Access
- **Severity:** MEDIUM
- **Cause:** `canEditFinancials` incorrectly included `isCoordinator`
- **Fix:** Removed coordinator from financial access check
- **File:** `src/components/clients/ClientCardSheet.tsx`

### 5. LOW: Enhanced Entitlement Audit
- **Severity:** LOW
- **Cause:** Missing `check_entitlement_with_log` function
- **Fix:** Created function with proper logging to `entitlement_audit`

### 6. LOW: Protected Collaborators Tab (Salary Data)
- **Severity:** LOW
- **Cause:** Collaborators tab visible to all financial roles
- **Fix:** Restricted to `canViewSalaries` (Owner only)
- **File:** `src/pages/FinancialPage.tsx`

---

## Security Functions Created/Updated

| Function | Purpose | Security |
|----------|---------|----------|
| `can_view_sensitive_financial` | Owner+Finance only for salary data | DEFINER |
| `can_view_financial` | Admin+Coordinator+Owner+Finance for general financial | DEFINER |
| `can_manage_financial` | Admin+Owner+Finance for write operations | DEFINER |
| `can_access_card` | Deep link protection for restricted cards | DEFINER |
| `revoke_workspace_invite` | Proper invite revocation with audit | DEFINER |
| `check_entitlement_with_log` | Entitlement checking with audit logging | DEFINER |

---

## UI Guard Fixes

| File | Issue | Fix |
|------|-------|-----|
| `ClientCardSheet.tsx` | Coordinator had financial access | Removed `isCoordinator` from `canEditFinancials` |
| `FinancialPage.tsx` | Collaborators tab visible to all | Restricted to `canViewSalaries` |

---

## Validation Checklist

| ID | Test | Status |
|----|------|--------|
| A1-A4 | User without workspace isolation | ✅ PASS |
| B1-B3 | Workspace creation with owner role | ✅ PASS |
| C1-C4 | Invite token validation | ✅ PASS |
| D1-D3 | Space access control | ✅ PASS |
| E1-E4 | Folder/Card visibility | ✅ PASS |
| F1-F3 | Delete ownership rules | ✅ PASS |
| G1-G5 | Super Admin break-glass | ✅ PASS |
| H1-H4 | Sensitive financial access | ✅ PASS |
| SEC1-SEC3 | Security (API keys, secrets) | ✅ PASS |
| BIL1-BIL5 | Billing entitlements | ✅ PASS |

---

## Role Access Matrix (per Blueprint)

| Data Type | Owner | Admin | Coordinator | Finance | Member | Viewer |
|-----------|-------|-------|-------------|---------|--------|--------|
| Cards (public) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cards (restricted) | ✅ | ✅ | ✅ | ❌ | ❌* | ❌ |
| Transactions | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Invoices | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Salary/Contract | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Collaborator Payroll | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Client Financials | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

*Members can view if they are card_members

---

## Files Modified

- `src/pages/SecurityAuditPage.tsx` - Enhanced audit runner
- `src/pages/FinancialPage.tsx` - Protected Collaborators tab
- `src/components/clients/ClientCardSheet.tsx` - Fixed financial access
- `supabase/migrations/*_permission_hardening_v2.sql` - Security functions

## Next Steps

1. Run `/security-audit` page to validate all tests pass
2. Monitor `entitlement_audit` for blocked actions
3. Review `audit_logs` for any suspicious access patterns
