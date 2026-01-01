import { useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// Updated to include 'finance' role as per blueprint
export type AppRole = 'super_admin' | 'owner' | 'admin' | 'coordinator' | 'finance' | 'member' | 'viewer';

// Role hierarchy - higher index = more permissions
// Note: 'finance' has specific access to financial data but not general admin powers
const ROLE_HIERARCHY: AppRole[] = ['viewer', 'member', 'finance', 'coordinator', 'admin', 'owner', 'super_admin'];

export interface Permissions {
  // Core permissions
  canViewDashboard: boolean;
  canViewCards: boolean;
  canCreateCards: boolean;
  canEditCards: boolean;
  canDeleteCards: boolean;
  
  // Time tracking
  canTrackTime: boolean;
  canViewTeamTime: boolean;
  
  // Coordination
  canViewCoordination: boolean;
  canManageSprints: boolean;
  
  // Financial (Owner + Finance only - NOT coordinator)
  canViewFinancial: boolean;
  canManageFinancial: boolean;
  
  // Salary/Payroll (Owner only - super sensitive)
  canViewSalaries: boolean;
  
  // Client financials (Owner + Finance only)
  canViewClientFinancials: boolean;
  
  // Partners (Sócios)
  canViewPartners: boolean;
  
  // Gamification
  canManageGamification: boolean;
  
  // Settings
  canViewSettings: boolean;
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canManageApiKeys: boolean;
  canManageWebhooks: boolean;
  canManageAutomations: boolean;
  
  // Invite permissions
  canInviteMembers: boolean;
  canPromoteToOwner: boolean;
  
  // Role checks
  isOwner: boolean;
  isAdmin: boolean;
  isCoordinator: boolean;
  isFinance: boolean;
  isSuperAdmin: boolean;
}

export function usePermissions(): Permissions {
  const { currentRole } = useWorkspace();

  return useMemo(() => {
    const role = currentRole as AppRole | null;
    
    const hasRole = (requiredRole: AppRole): boolean => {
      if (!role) return false;
      const currentIndex = ROLE_HIERARCHY.indexOf(role);
      const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
      return currentIndex >= requiredIndex;
    };

    const isOwnerOrAdmin = hasRole('admin');
    const isCoordinator = hasRole('coordinator');
    const isMember = hasRole('member');
    const isViewer = hasRole('viewer');
    const isSuperAdmin = role === 'super_admin';
    const isOwner = role === 'owner' || isSuperAdmin;
    const isFinance = role === 'finance';
    
    // Financial access: Owner + Finance only (NOT coordinator per blueprint)
    const hasFinanceAccess = isOwner || isFinance || isSuperAdmin;
    
    // Salary access: Owner only (super sensitive)
    const hasSalaryAccess = isOwner || isSuperAdmin;

    return {
      // Core - everyone can view if they have any role
      canViewDashboard: isViewer,
      canViewCards: isViewer,
      canCreateCards: isMember,
      canEditCards: isMember,
      canDeleteCards: isOwnerOrAdmin,

      // Time tracking
      canTrackTime: isMember,
      canViewTeamTime: isCoordinator,

      // Coordination - coordinators and above
      canViewCoordination: isCoordinator,
      canManageSprints: isOwnerOrAdmin,

      // Financial - Owner + Finance only (NOT coordinator per blueprint STEP 7)
      canViewFinancial: hasFinanceAccess,
      canManageFinancial: hasFinanceAccess,
      
      // Salary/Payroll - Owner only
      canViewSalaries: hasSalaryAccess,
      
      // Client financials - Owner + Finance only
      canViewClientFinancials: hasFinanceAccess,

      // Partners - owner only (sócios)
      canViewPartners: isOwner,

      // Gamification
      canManageGamification: isOwnerOrAdmin,

      // Settings
      canViewSettings: isMember,
      canManageWorkspace: isOwnerOrAdmin,
      canManageMembers: isOwnerOrAdmin,
      canManageApiKeys: isOwnerOrAdmin,
      canManageWebhooks: isOwnerOrAdmin,
      canManageAutomations: isOwnerOrAdmin,
      
      // Invite permissions
      canInviteMembers: isOwnerOrAdmin, // owner, admin, coordinator can invite
      canPromoteToOwner: isOwner, // only owners can promote to owner

      // Role checks
      isOwner,
      isAdmin: isOwnerOrAdmin,
      isCoordinator,
      isFinance,
      isSuperAdmin,
    };
  }, [currentRole]);
}

// Component to conditionally render based on permissions
export function useRequirePermission(permission: keyof Permissions): boolean {
  const permissions = usePermissions();
  return permissions[permission];
}
