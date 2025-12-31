import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

interface FolderPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageViews: boolean;
  canManageChecklist: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Hook to check folder-specific permissions based on ownership and role.
 * 
 * Rules:
 * - Admin/Owner/Coordinator: Full access to all folders
 * - Collaborator (member): Only access to folders where owner_id = their user_id
 */
export function useFolderPermissions(folderOwnerId: string | null | undefined): FolderPermissions {
  const { user } = useAuth();
  const permissions = usePermissions();

  return useMemo(() => {
    const userId = user?.id;
    const isAdmin = permissions.canManageWorkspace; // admin, owner, coordinator
    const isOwner = folderOwnerId === userId;
    
    // Shared folders (no owner) are accessible by everyone
    const isSharedFolder = folderOwnerId === null || folderOwnerId === undefined;
    
    // Can view if: admin OR owner OR shared folder
    const canView = isAdmin || isOwner || isSharedFolder;
    
    // Can edit if: admin OR owner
    const canEdit = isAdmin || isOwner;
    
    // Can delete if: admin only (even owner can't delete their own folder without admin)
    // Updated: owner can delete their own folder
    const canDelete = isAdmin || isOwner;
    
    // Can manage views (create/edit/delete) if: admin OR owner
    const canManageViews = isAdmin || isOwner;
    
    // Can manage checklist if: admin OR owner
    const canManageChecklist = isAdmin || isOwner;

    return {
      canView,
      canEdit,
      canDelete,
      canManageViews,
      canManageChecklist,
      isOwner,
      isAdmin,
    };
  }, [user?.id, folderOwnerId, permissions.canManageWorkspace]);
}

/**
 * Hook to check if current user has admin-level access
 */
export function useIsAdmin(): boolean {
  const permissions = usePermissions();
  return permissions.canManageWorkspace;
}
