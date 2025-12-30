import { useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export type AppRole = 'super_admin' | 'owner' | 'admin' | 'coordinator' | 'member' | 'viewer';

// Role hierarchy - higher index = more permissions
const ROLE_HIERARCHY: AppRole[] = ['viewer', 'member', 'coordinator', 'admin', 'owner', 'super_admin'];

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
  
  // Financial
  canViewFinancial: boolean;
  canManageFinancial: boolean;
  
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
  
  // Super admin only
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

      // Financial - admin and owner only
      canViewFinancial: isOwnerOrAdmin,
      canManageFinancial: isOwnerOrAdmin,

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

      // Super admin
      isSuperAdmin,
    };
  }, [currentRole]);
}

// Component to conditionally render based on permissions
export function useRequirePermission(permission: keyof Permissions): boolean {
  const permissions = usePermissions();
  return permissions[permission];
}
